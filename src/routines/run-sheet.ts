import { WINDOW_TITLE } from "../config.ts";
import type { GameRound } from "../models/game-round.ts";
import { delay } from "@std/async";
import { activate, findWindow, isForeground } from "../platform/window.ts";
import { playRound } from "./play-round.ts";

/** Focuses the game and plays every round of a sheet in order. */
export async function runSheet(rounds: GameRound[]): Promise<void> {
  const win = findWindow(WINDOW_TITLE);
  if (!win) throw new Error(`Game window '${WINDOW_TITLE}' not found`);
  activate(win);
  await delay(500);
  if (!isForeground(win)) {
    console.log("⚠️ The game window is not in the foreground; keys will go elsewhere.");
  }

  for (const round of rounds) await playRound(round);
}
