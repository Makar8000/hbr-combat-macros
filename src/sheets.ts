import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Papa from "papaparse";
import { SHEETS_DIR } from "./config.ts";
import { type GameRound, parseGameRound } from "./models/game-round.ts";

/** Lists the .csv files in the sheets folder. Throws if the folder doesn't exist. */
export function listSheets(): string[] {
  return readdirSync(SHEETS_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".csv"))
    .map((e) => e.name);
}

export function loadSheet(fileName: string): GameRound[] {
  const text = readFileSync(join(SHEETS_DIR, fileName), "utf8");
  // The BOM strip is for sheets saved by Excel.
  const { data } = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ""), { header: true, skipEmptyLines: true });
  return data.map(parseGameRound);
}
