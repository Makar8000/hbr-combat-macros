import cvModule from "@techstark/opencv-js";
import { decode } from "fast-png";
import type { Frame } from "../platform/screen.ts";

// deno-lint-ignore no-explicit-any
type Mat = any;

// Depending on the build, this import is the module, a promise, or a module that isn't ready yet.
// deno-lint-ignore no-explicit-any
const cv: any = await (async () => {
  // deno-lint-ignore no-explicit-any
  const mod: any = cvModule instanceof Promise ? await cvModule : cvModule;
  if (!mod.Mat) {
    await new Promise<void>((resolve) => (mod.onRuntimeInitialized = resolve));
  }
  return mod;
})();

export interface Template {
  /** 3-channel BGR. */
  color: Mat;
  /** The PNG's alpha channel, if it has one. Used as the match mask. */
  mask: Mat | null;
}

/** Loads a PNG as a BGR template. If it has an alpha channel, that becomes the match mask. */
export function loadTemplate(path: string): Template {
  const png = decode(Deno.readFileSync(path));
  if (png.depth !== 8 || (png.channels !== 3 && png.channels !== 4)) {
    throw new Error(
      `Unsupported template format (${png.channels}ch, ${png.depth}-bit): ${path}`,
    );
  }
  const src = cv.matFromArray(
    png.height,
    png.width,
    png.channels === 4 ? cv.CV_8UC4 : cv.CV_8UC3,
    png.data,
  );
  const color = new cv.Mat();
  let mask: Mat | null = null;
  if (png.channels === 4) {
    cv.cvtColor(src, color, cv.COLOR_RGBA2BGR);
    const planes = new cv.MatVector();
    cv.split(src, planes);
    mask = planes.get(3).clone();
    planes.delete();
  } else {
    cv.cvtColor(src, color, cv.COLOR_RGB2BGR);
  }
  src.delete();
  return { color, mask };
}

/** How well `template` matches `frame`, from the best spot found (TM_CCOEFF_NORMED, 1 is perfect). */
export function matchScore(frame: Frame, template: Template): number {
  const bgra = cv.matFromArray(
    frame.height,
    frame.width,
    cv.CV_8UC4,
    frame.data,
  );
  const bgr = new cv.Mat();
  const result = new cv.Mat();
  try {
    cv.cvtColor(bgra, bgr, cv.COLOR_BGRA2BGR);
    if (template.mask) {
      cv.matchTemplate(
        bgr,
        template.color,
        result,
        cv.TM_CCOEFF_NORMED,
        template.mask,
      );
    } else {
      cv.matchTemplate(bgr, template.color, result, cv.TM_CCOEFF_NORMED);
    }
    return cv.minMaxLoc(result).maxVal;
  } finally {
    bgra.delete();
    bgr.delete();
    result.delete();
  }
}
