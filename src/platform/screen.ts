import { gdi32, user32 } from "./win32.ts";

export interface Frame {
  width: number;
  height: number;
  /** BGRA pixels, top row first. Ignore the alpha channel, GDI leaves it at 0. */
  data: Uint8Array;
}

const SRCCOPY = 0x00cc0020;
const DIB_RGB_COLORS = 0;

/** Grabs a region of the screen using GDI. */
export function captureRegion(
  x: number,
  y: number,
  width: number,
  height: number,
): Frame {
  const screenDc = user32.GetDC(0n);
  const memDc = gdi32.CreateCompatibleDC(screenDc);
  const bitmap = gdi32.CreateCompatibleBitmap(screenDc, width, height);
  const old = gdi32.SelectObject(memDc, bitmap);
  try {
    if (!gdi32.BitBlt(memDc, 0, 0, width, height, screenDc, x, y, SRCCOPY)) {
      throw new Error("BitBlt failed");
    }
    // BITMAPINFOHEADER. A negative height makes the rows come out top first.
    const header = new Uint8Array(40);
    const view = new DataView(header.buffer);
    view.setUint32(0, 40, true);
    view.setInt32(4, width, true);
    view.setInt32(8, -height, true);
    view.setUint16(12, 1, true); // planes
    view.setUint16(14, 32, true); // bpp
    const data = new Uint8Array(width * height * 4);
    if (
      gdi32.GetDIBits(
        memDc,
        bitmap,
        0,
        height,
        data,
        header,
        DIB_RGB_COLORS,
      ) !== height
    ) {
      throw new Error("GetDIBits failed");
    }
    return { width, height, data };
  } finally {
    gdi32.SelectObject(memDc, old);
    gdi32.DeleteObject(bitmap);
    gdi32.DeleteDC(memDc);
    user32.ReleaseDC(0n, screenDc);
  }
}
