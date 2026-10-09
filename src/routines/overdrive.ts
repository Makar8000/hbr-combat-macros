import { delay } from "@std/async";
import { OVERDRIVE_MENU, waitFor } from "../game/conditions.ts";
import { CONTROLS } from "../game/controls.ts";
import { tapWithDelay } from "../platform/keyboard.ts";

/** Opens the overdrive menu and picks a level. The sign of `level` doesn't matter here. */
export async function overdrive(level: number): Promise<void> {
  const key = Math.abs(level);
  console.log(`⚡ Activating Overdrive Level: ${key}`);
  await tapWithDelay(CONTROLS.overdriveMenu);
  await waitFor(OVERDRIVE_MENU);
  await tapWithDelay(String(key));
  await delay(3000); // wait for the animation
}
