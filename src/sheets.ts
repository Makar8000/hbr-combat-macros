import { join } from "node:path";
import { parse } from "@std/csv";
import { SHEETS_DIR } from "./config.ts";
import { type GameRound, parseGameRound } from "./models/game-round.ts";

/** Lists the .csv files in the sheets folder. Throws if the folder doesn't exist. */
export function listSheets(): string[] {
  return [...Deno.readDirSync(SHEETS_DIR)]
    .filter((e) => e.isFile && e.name.endsWith(".csv"))
    .map((e) => e.name);
}

export function loadSheet(fileName: string): GameRound[] {
  const text = Deno.readTextFileSync(join(SHEETS_DIR, fileName));
  return parse(text, { skipFirstRow: true }).map(parseGameRound);
}
