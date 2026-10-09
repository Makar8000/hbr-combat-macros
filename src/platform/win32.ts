// Native Windows calls. This is the only file that uses Deno.dlopen. Windows x64 only.

export const user32 = Deno.dlopen(
  "user32.dll",
  {
    SendInput: { parameters: ["u32", "buffer", "i32"], result: "u32" },
    MapVirtualKeyW: { parameters: ["u32", "u32"], result: "u32" },
    VkKeyScanW: { parameters: ["u16"], result: "i16" },
    SetProcessDPIAware: { parameters: [], result: "i32" },
    EnumWindows: { parameters: ["function", "isize"], result: "i32" },
    IsWindowVisible: { parameters: ["isize"], result: "i32" },
    GetWindowTextLengthW: { parameters: ["isize"], result: "i32" },
    GetWindowTextW: { parameters: ["isize", "buffer", "i32"], result: "i32" },
    GetClientRect: { parameters: ["isize", "buffer"], result: "i32" },
    ClientToScreen: { parameters: ["isize", "buffer"], result: "i32" },
    GetForegroundWindow: { parameters: [], result: "isize" },
    SetForegroundWindow: { parameters: ["isize"], result: "i32" },
    GetDC: { parameters: ["isize"], result: "isize" },
    ReleaseDC: { parameters: ["isize", "isize"], result: "i32" },
  } as const,
).symbols;

const shell32 = Deno.dlopen("shell32.dll", {
  IsUserAnAdmin: { parameters: [], result: "i32" },
}).symbols;

/** Windows silently drops input sent from a normal process to an elevated one. */
export const isElevated = (): boolean => shell32.IsUserAnAdmin() !== 0;

export const gdi32 = Deno.dlopen(
  "gdi32.dll",
  {
    CreateCompatibleDC: { parameters: ["isize"], result: "isize" },
    CreateCompatibleBitmap: {
      parameters: ["isize", "i32", "i32"],
      result: "isize",
    },
    SelectObject: { parameters: ["isize", "isize"], result: "isize" },
    BitBlt: {
      parameters: [
        "isize",
        "i32",
        "i32",
        "i32",
        "i32",
        "isize",
        "i32",
        "i32",
        "u32",
      ],
      result: "i32",
    },
    GetDIBits: {
      parameters: ["isize", "isize", "u32", "u32", "buffer", "buffer", "u32"],
      result: "i32",
    },
    DeleteObject: { parameters: ["isize"], result: "i32" },
    DeleteDC: { parameters: ["isize"], result: "i32" },
  } as const,
).symbols;

// Size of INPUT on x64: 4 bytes type, 4 bytes padding, 32 bytes union.
// The union is big enough for mouse input too.
export const INPUT_SIZE = 40;
const INPUT_KEYBOARD = 1;

export const KEYEVENTF_EXTENDEDKEY = 0x1;
export const KEYEVENTF_KEYUP = 0x2;
export const MAPVK_VK_TO_VSC = 0;

/** Builds a keyboard INPUT struct with both the virtual key and the scan code set. */
export function keyboardInput(
  vk: number,
  scan: number,
  flags: number,
): Uint8Array {
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
    throw new Error(
      "SendInput failed (is the process blocked by UIPI? run as Administrator)",
    );
  }
}

// Without this, Windows scales coordinates on high DPI screens and the capture regions end up off.
user32.SetProcessDPIAware();
