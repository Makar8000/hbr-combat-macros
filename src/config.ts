import { join } from "node:path";
// Text to look for in the game window's title.
export const WINDOW_TITLE = "HeavenBurnsRed";
// How many times to run the sheet.
export const LOOP_COUNT = 1;
// How close a screen match has to be (0 to 1) to count as found.
export const MATCH_THRESHOLD = 0.8;
// Window width the screen regions and template images were made for.
export const BASE_WIDTH = 2560;

// CSV sheets, read from the folder you launch the app in.
export const SHEETS_DIR = join(process.cwd(), "sheets");
