import { KEYEVENTF_EXTENDEDKEY, KEYEVENTF_KEYUP, keyboardInput, MAPVK_VK_TO_VSC, sendInput, user32 } from "./win32.ts";

// Virtual key codes. The arrow keys need the extended-key flag.
const SPECIAL_KEYS = {
  alt: { vk: 0x12, flags: 0 },
  enter: { vk: 0x0d, flags: 0 },
  tab: { vk: 0x09, flags: 0 },
  down: { vk: 0x28, flags: KEYEVENTF_EXTENDEDKEY },
  right: { vk: 0x27, flags: KEYEVENTF_EXTENDEDKEY },
} as const;

/** A special key name (see SPECIAL_KEYS) or a single character like "o" or "1". */
export type Key = string;

/** Builds the key down and key up inputs for a key. */
export function keyInputs(key: Key): [Uint8Array, Uint8Array] {
  let vk: number, flags: number;
  if (key in SPECIAL_KEYS) {
    ({ vk, flags } = SPECIAL_KEYS[key as keyof typeof SPECIAL_KEYS]);
  } else {
    // Only single characters that don't need shift (digits and lowercase letters).
    const res = user32.VkKeyScanW(key.charCodeAt(0));
    if (key.length !== 1 || res === -1 || ((res >> 8) & 0xff) !== 0) {
      throw new Error(`Unsupported key: ${key}`);
    }
    vk = res & 0xff;
    flags = 0;
  }
  const scan = user32.MapVirtualKeyW(vk, MAPVK_VK_TO_VSC);
  return [keyboardInput(vk, scan, flags), keyboardInput(vk, scan, flags | KEYEVENTF_KEYUP)];
}

/** Key down, then key up. */
export function tap(key: Key): void {
  const [down, up] = keyInputs(key);
  sendInput(down);
  sendInput(up);
}

export async function tapWithDelay(key: Key, seconds = 0.4): Promise<void> {
  tap(key);
  await Bun.sleep(seconds * 1000);
}
