import { delay } from "@std/async";
import { join } from "node:path";
import { ASSETS_DIR, MATCH_THRESHOLD, WINDOW_TITLE } from "../config.ts";
import { captureRegion } from "../platform/screen.ts";
import { activate, findWindow } from "../platform/window.ts";
import { loadTemplate, matchScore, type Template } from "../vision/match-template.ts";

/** An image to look for inside a region of the game window (x/y are offsets from the window's top-left). */
export interface Condition {
  template: Template;
  x: number;
  y: number;
  width: number;
  height: number;
}

const condition = (
  file: string,
  x: number,
  y: number,
  width: number,
  height: number,
): Condition => ({
  template: loadTemplate(join(ASSETS_DIR, file)),
  x,
  y,
  width,
  height,
});

// TODO: These regions are tuned for 2560x1440 window size. Fix them to support any 16:9 resolution.
export const TURN_READY = condition("turn-ready.png", 2196, 1021, 310, 308);
export const OVERDRIVE_MENU = condition(
  "overdrive-menu.png",
  996,
  1187,
  568,
  160,
);
export const BATTLE_RESULT = condition("battle-result.png", 105, 43, 475, 61);

async function isMet(c: Condition): Promise<boolean> {
  const win = findWindow(WINDOW_TITLE);
  if (!win) {
    console.log("❌ Game window not found");
    return false;
  }
  try {
    activate(win);
  } catch {
    // Focusing can fail, but we can still try the capture.
  }
  await delay(1000);
  const frame = captureRegion(win.left + c.x, win.top + c.y, c.width, c.height);
  return matchScore(frame, c.template) >= MATCH_THRESHOLD;
}

/** Checks every couple of seconds until the condition is met. There is no timeout on purpose. */
export async function waitFor(c: Condition): Promise<void> {
  while (!(await isMet(c))) {
    await delay(1000);
  }
}
