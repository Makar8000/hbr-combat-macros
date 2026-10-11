// Read-only access to another process's memory (Windows x64). Run elevated or OpenProcess fails with error 5.

import { dlopen, FFIType } from "bun:ffi";

const { i32, i64, ptr, u32, u64 } = FFIType;

const k32 = dlopen("kernel32.dll", {
  OpenProcess: { args: [u32, i32, u32], returns: i64 },
  ReadProcessMemory: { args: [i64, u64, ptr, u64, ptr], returns: i32 },
  VirtualQueryEx: { args: [i64, u64, ptr, u64], returns: u64 },
  GetLastError: { args: [], returns: u32 },
}).symbols;

const PROCESS_VM_READ_AND_QUERY = 0x0010 | 0x0400;
const MEM_COMMIT = 0x1000;
const PAGE_NOACCESS = 0x01;
const PAGE_GUARD = 0x100;
const MEM_IMAGE = 0x1000000;
const CHUNK = 16 * 1024 * 1024;
const MAX_ADDRESS = 0x7fffffff0000n;

export type Handle = bigint;

/** The PID of the first running process with this exact image name. */
export function findPid(imageName: string): number {
  const out = Bun.spawnSync(["tasklist", "/FI", `IMAGENAME eq ${imageName}`, "/FO", "CSV", "/NH"]);
  const match = out.stdout.toString().match(/^"[^"]+","(\d+)"/m);
  if (!match) throw new Error(`${imageName} is not running`);
  return Number(match[1]);
}

export function openProcess(pid: number): Handle {
  const handle = k32.OpenProcess(PROCESS_VM_READ_AND_QUERY, 0, pid);
  if (!handle) throw new Error(`OpenProcess failed (error ${k32.GetLastError()}). Error 5 means you need an Administrator terminal.`);
  return handle;
}

/** Reads `size` bytes, or returns null if any part is unreadable. */
export function read(handle: Handle, address: bigint, size: number): Uint8Array | null {
  const buffer = new Uint8Array(size);
  const ok = k32.ReadProcessMemory(handle, address, buffer, BigInt(size), new Uint8Array(8));
  return ok ? buffer : null;
}

export function readPointer(handle: Handle, address: bigint): bigint | null {
  const bytes = read(handle, address, 8);
  return bytes && new DataView(bytes.buffer).getBigUint64(0, true);
}

export function readInt32(handle: Handle, address: bigint): number | null {
  const bytes = read(handle, address, 4);
  return bytes && new DataView(bytes.buffer).getInt32(0, true);
}

/** The element pointers of a .NET List<T> object, or null if it doesn't look like one. Layout: _items at +0x10, _size at +0x18, elements from +0x20. */
export function readList(handle: Handle, address: bigint, max = 500): bigint[] | null {
  const items = readPointer(handle, address + 0x10n);
  const size = readInt32(handle, address + 0x18n);
  if (!items || size === null || size < 0 || size > max) return null;
  const elements: bigint[] = [];
  for (let i = 0; i < size; i++) {
    const element = readPointer(handle, items + 0x20n + BigInt(i * 8));
    if (element === null) return null;
    elements.push(element);
  }
  return elements;
}

/** The element pointers of a .NET array of references, or null if it doesn't look like one. Layout: length at +0x18, elements from +0x20. */
export function readArray(handle: Handle, address: bigint, max = 500): bigint[] | null {
  const length = readInt32(handle, address + 0x18n);
  if (length === null || length < 0 || length > max) return null;
  if (length === 0) return [];
  const bytes = read(handle, address + 0x20n, length * 8);
  if (!bytes) return null;
  const view = new DataView(bytes.buffer);
  return Array.from({ length }, (_, i) => view.getBigUint64(i * 8, true));
}

/** A null-terminated ASCII string, up to `max` characters. */
export function readCString(handle: Handle, address: bigint, max = 128): string | null {
  const bytes = read(handle, address, max);
  if (!bytes) return null;
  const end = bytes.indexOf(0);
  return end < 0 ? null : new TextDecoder().decode(bytes.subarray(0, end));
}

/** A .NET string object: 0x10 header words, then an int32 length, then UTF-16 characters. */
export function readManagedString(handle: Handle, address: bigint): string | null {
  const length = readInt32(handle, address + 0x10n);
  if (length === null || length < 0 || length > 256) return null;
  const bytes = read(handle, address + 0x14n, length * 2);
  return bytes && new TextDecoder("utf-16le").decode(bytes);
}

// One buffer for every chunk read, instead of allocating 16 MB each time.
const chunkBuffer = new Uint8Array(CHUNK);
const bytesRead = new Uint8Array(8);

/**
 * Every readable chunk of the process's memory, 8-byte aligned. `data` is reused by the next chunk, so use it before moving on.
 * Code and data images (GameAssembly.dll and friends, hundreds of MB) are skipped unless `everything` is set: they hold no
 * objects or class structs, so for these searches they are only cost.
 */
export function* readableChunks(handle: Handle, everything = false): Generator<{ address: bigint; data: Uint8Array }> {
  const info = new Uint8Array(48);
  const view = new DataView(info.buffer);
  let address = 0n;
  while (address < MAX_ADDRESS && k32.VirtualQueryEx(handle, address, info, 48n)) {
    const base = view.getBigUint64(0, true);
    const size = view.getBigUint64(24, true);
    const protect = view.getUint32(36, true);
    if (
      view.getUint32(32, true) === MEM_COMMIT &&
      protect !== 0 &&
      !(protect & (PAGE_NOACCESS | PAGE_GUARD)) &&
      (everything || view.getUint32(40, true) !== MEM_IMAGE)
    ) {
      for (let offset = 0n; offset < size; offset += BigInt(CHUNK)) {
        const length = size - offset < BigInt(CHUNK) ? Number(size - offset) : CHUNK;
        const data = chunkBuffer.subarray(0, length);
        if (k32.ReadProcessMemory(handle, base + offset, data, BigInt(length), bytesRead)) yield { address: base + offset, data };
      }
    }
    address = base + size;
  }
}

/** For each text, the addresses of every occurrence as a whole null-terminated string. One pass over memory for all of them. */
export function findStrings(handle: Handle, texts: string[], everything = false): Map<string, bigint[]> {
  const patterns = texts.map((text) => ({ text, bytes: new TextEncoder().encode(`${text}\0`), hits: [] as bigint[] }));
  // ponytail: a string straddling a 16 MB chunk edge is missed. Overlap the chunks if that ever matters.
  for (const { address, data } of readableChunks(handle, everything)) {
    for (const { bytes, hits } of patterns) {
      // Start from the first real character. Searching for the leading 0 byte would match almost every byte in memory.
      for (let i = data.indexOf(bytes[0], 1); i >= 0; i = data.indexOf(bytes[0], i + 1)) {
        if (data[i - 1] === 0 && bytes.every((byte, k) => data[i + k] === byte)) hits.push(address + BigInt(i));
      }
    }
  }
  return new Map(patterns.map((p) => [p.text, p.hits]));
}

/** For each target value, the addresses that hold it as an 8-byte aligned pointer. */
export function findPointers(handle: Handle, targets: bigint[], everything = false): Map<bigint, bigint[]> {
  const found = new Map<bigint, bigint[]>(targets.map((t) => [t, []]));
  const lowWords = new Set(targets.map((t) => Number(t & 0xffffffffn)));
  // A cheap first test for every word: almost none match, and a table lookup is much faster than a Set lookup.
  const maybe = new Uint8Array(0x10000);
  for (const low of lowWords) maybe[low & 0xffff] = 1;
  for (const { address, data } of readableChunks(handle, everything)) {
    const words = new Uint32Array(data.buffer, data.byteOffset, data.length >> 2);
    for (let i = 0; i + 1 < words.length; i += 2) {
      if (!maybe[words[i] & 0xffff] || !lowWords.has(words[i])) continue;
      const hits = found.get((BigInt(words[i + 1]) << 32n) | BigInt(words[i]));
      if (hits) hits.push(address + BigInt(i * 4));
    }
  }
  return found;
}
