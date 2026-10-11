// Native Windows calls. This is the only file that uses bun:ffi's dlopen. Windows x64 only.
import { dlopen, FFIType } from "bun:ffi";

// Handles (HWND, HDC...) are i64 so they come back as bigint.
const { i16, i32, i64, ptr, u16, u32 } = FFIType;

export const user32 = dlopen("user32.dll", {
  SendInput: { args: [u32, ptr, i32], returns: u32 },
  MapVirtualKeyW: { args: [u32, u32], returns: u32 },
  VkKeyScanW: { args: [u16], returns: i16 },
  SetProcessDPIAware: { args: [], returns: i32 },
  EnumWindows: { args: [ptr, i64], returns: i32 },
  IsWindowVisible: { args: [i64], returns: i32 },
  GetWindowTextLengthW: { args: [i64], returns: i32 },
  GetWindowTextW: { args: [i64, ptr, i32], returns: i32 },
  GetClientRect: { args: [i64, ptr], returns: i32 },
  ClientToScreen: { args: [i64, ptr], returns: i32 },
  GetForegroundWindow: { args: [], returns: i64 },
  SetForegroundWindow: { args: [i64], returns: i32 },
  GetDC: { args: [i64], returns: i64 },
  ReleaseDC: { args: [i64, i64], returns: i32 },
}).symbols;

const shell32 = dlopen("shell32.dll", {
  IsUserAnAdmin: { args: [], returns: i32 },
}).symbols;

/** Windows silently drops input sent from a normal process to an elevated one. */
export const isElevated = (): boolean => shell32.IsUserAnAdmin() !== 0;

export const gdi32 = dlopen("gdi32.dll", {
  CreateCompatibleDC: { args: [i64], returns: i64 },
  CreateCompatibleBitmap: { args: [i64, i32, i32], returns: i64 },
  SelectObject: { args: [i64, i64], returns: i64 },
  BitBlt: { args: [i64, i32, i32, i32, i32, i64, i32, i32, u32], returns: i32 },
  GetDIBits: { args: [i64, i64, u32, u32, ptr, ptr, u32], returns: i32 },
  DeleteObject: { args: [i64], returns: i32 },
  DeleteDC: { args: [i64], returns: i32 },
}).symbols;

// Size of INPUT on x64: 4 bytes type, 4 bytes padding, 32 bytes union.
// The union is big enough for mouse input too.
export const INPUT_SIZE = 40;
const INPUT_KEYBOARD = 1;

export const KEYEVENTF_EXTENDEDKEY = 0x1;
export const KEYEVENTF_KEYUP = 0x2;
export const MAPVK_VK_TO_VSC = 0;

/** Builds a keyboard INPUT struct with both the virtual key and the scan code set. */
export function keyboardInput(vk: number, scan: number, flags: number): Uint8Array {
  const buf = new Uint8Array(INPUT_SIZE);
  const view = new DataView(buf.buffer);
  view.setUint32(0, INPUT_KEYBOARD, true);
  view.setUint16(8, vk, true);
  view.setUint16(10, scan, true);
  view.setUint32(12, flags, true);
  return buf;
}

export function sendInput(input: Uint8Array): void {
  if (user32.SendInput(1, input, INPUT_SIZE) !== 1) {
    throw new Error("SendInput failed (is the process blocked by UIPI? run as Administrator)");
  }
}

// Without this, Windows scales coordinates on high DPI screens and the capture regions end up off.
user32.SetProcessDPIAware();
