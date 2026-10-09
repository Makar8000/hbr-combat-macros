import { join } from "node:path";

export const WINDOW_TITLE = "HeavenBurnsRed";
export const LOOP_COUNT = 1;
export const MATCH_THRESHOLD = 0.8;
export const ASSETS_DIR = join(import.meta.dirname!, "assets");
export const SHEETS_DIR = join(Deno.cwd(), "sheets");
