import { delay } from "@std/async";
import { join } from "node:path";
import { ASSETS_DIR, BASE_WIDTH, MATCH_THRESHOLD, WINDOW_TITLE } from "../config.ts";
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

// Regions are based on 2560x1440 pixel windows and get scaled to the real window width when checked.
export const TURN_READY = condition("turn-ready.png", 2196, 1021, 310, 308);
export const OVERDRIVE_MENU = condition(
  "overdrive-menu.png",
  996,
  1187,
  568,
  160,
);
export const BATTLE_RESULT = condition("battle-result.png", 105, 43, 475, 61);

// Set HBR_DEBUG=1 to print the window size and match score on every check.
const DEBUG = Deno.env.get("HBR_DEBUG") === "1";

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
  const scale = win.width / BASE_WIDTH;
  const frame = captureRegion(
    win.left + Math.round(c.x * scale),
    win.top + Math.round(c.y * scale),
    Math.round(c.width * scale),
    Math.round(c.height * scale),
  );
  const score = matchScore(frame, c.template, scale);
  if (DEBUG) {
    console.log(`[debug] window ${win.left},${win.top} ${win.width}x${win.height} scale ${scale.toFixed(3)} score ${score.toFixed(3)}`);
  }
  return score >= MATCH_THRESHOLD;
}

/** Checks every couple of seconds until the condition is met. There is no timeout on purpose. */
export async function waitFor(c: Condition): Promise<void> {
  while (!(await isMet(c))) {
    await delay(1000);
  }
}
