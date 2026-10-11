import { FFIType, JSCallback } from "bun:ffi";
import { user32 } from "./win32.ts";

export interface GameWindow {
  hwnd: bigint;
  left: number;
  top: number;
  width: number;
  height: number;
}

function visibleWindows(): { hwnd: bigint; title: string }[] {
  const found: { hwnd: bigint; title: string }[] = [];
  const cb = new JSCallback(
    (hwnd: bigint) => {
      if (user32.IsWindowVisible(hwnd) !== 0) {
        const len = user32.GetWindowTextLengthW(hwnd);
        const buf = new Uint16Array(len + 1);
        user32.GetWindowTextW(hwnd, buf, len + 1);
        found.push({
          hwnd,
          title: String.fromCharCode(...buf.subarray(0, len)),
        });
      }
      return 1;
    },
    { args: [FFIType.i64, FFIType.i64], returns: FFIType.i32 },
  );
  user32.EnumWindows(cb.ptr, 0n);
  cb.close();
  return found;
}

/** First visible window whose title contains `title`, ignoring case. */
export function findWindow(title: string): GameWindow | undefined {
  const match = visibleWindows().find((w) => w.title.toUpperCase().includes(title.toUpperCase()));
  if (!match) return undefined;
  // Use the client area (the game picture), without the title bar and borders.
  const rect = new Int32Array(4);
  user32.GetClientRect(match.hwnd, new Uint8Array(rect.buffer));
  const origin = new Int32Array(2); // client (0, 0) in screen coordinates
  user32.ClientToScreen(match.hwnd, new Uint8Array(origin.buffer));
  return {
    hwnd: match.hwnd,
    left: origin[0],
    top: origin[1],
    width: rect[2],
    height: rect[3],
  };
}

export function isForeground(win: GameWindow): boolean {
  return user32.GetForegroundWindow() === win.hwnd;
}

/** Brings the window to the front. Throws if Windows refuses. */
export function activate(win: GameWindow): void {
  if (user32.SetForegroundWindow(win.hwnd) === 0) {
    throw new Error("SetForegroundWindow failed");
  }
}
