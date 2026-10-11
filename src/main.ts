import { select } from "@inquirer/prompts";
import { LOOP_COUNT } from "./config.ts";
import { isElevated } from "./platform/win32.ts";
import { runSheet } from "./routines/run-sheet.ts";
import { listSheets, loadSheet } from "./sheets.ts";

if (!isElevated()) {
  console.log("❌ Administrator rights are required. Please re-run the application as admin.");
  prompt("Press Enter to exit...");
  process.exit(1);
}

let sheets: string[];
try {
  sheets = listSheets();
} catch {
  console.log("❌ Error: Folder 'sheets' does not exist.");
  process.exit(1);
}
if (sheets.length === 0) {
  console.log("❌ Error: No CSV files found in the 'sheets' folder.");
  process.exit(1);
}

let selected: string;
if (sheets.length === 1) {
  selected = sheets[0];
  console.log(`ℹ️ Auto-selecting: ${selected}`);
} else {
  selected = await select({
    message: "Select a CSV script to run",
    choices: sheets,
  });
}

const rounds = loadSheet(selected);
console.log(`\nThe script you selected is: ${selected}`);

for (let i = 1; i <= LOOP_COUNT; i++) {
  console.log(`\n--- Starting Macro Loop ${i}/${LOOP_COUNT} ---`);
  const start = Date.now();
  await runSheet(rounds);
  const seconds = Math.floor((Date.now() - start) / 1000);
  console.log(`⏱️ Macro Loop ${i} finished in: ${Math.floor(seconds / 60)}m ${seconds % 60}s`);
  // TODO: handle rewards, rematch and life stones recharge here.
}
