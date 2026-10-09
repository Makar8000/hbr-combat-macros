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
  const cb = new Deno.UnsafeCallback(
    { parameters: ["isize", "isize"], result: "i32" } as const,
    (hwnd) => {
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
  );
  user32.EnumWindows(cb.pointer, 0n);
  cb.close();
  return found;
}

/** First visible window whose title contains `title`, ignoring case. */
export function findWindow(title: string): GameWindow | undefined {
  const match = visibleWindows().find((w) => w.title.toUpperCase().includes(title.toUpperCase()));
  if (!match) return undefined;
  // The capture regions are measured from GetWindowRect, not the client area.
  const rect = new Int32Array(4);
  user32.GetWindowRect(match.hwnd, new Uint8Array(rect.buffer));
  const [left, top, right, bottom] = rect;
  return {
    hwnd: match.hwnd,
    left,
    top,
    width: right - left,
    height: bottom - top,
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
