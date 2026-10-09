import { join } from "node:path";
import { parse } from "@std/csv";
import { SHEETS_DIR } from "./config.ts";
import { type GameRound, parseGameRound } from "./models/game-round.ts";

/** File names of all sheets, in directory order. Throws if the folder is missing. */
export function listSheets(): string[] {
  return [...Deno.readDirSync(SHEETS_DIR)]
    .filter((e) => e.isFile && e.name.endsWith(".csv"))
    .map((e) => e.name);
}

export function loadSheet(fileName: string): GameRound[] {
  const text = Deno.readTextFileSync(join(SHEETS_DIR, fileName));
  return parse(text, { skipFirstRow: true }).map(parseGameRound);
}
