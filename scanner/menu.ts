// Shows what is highlighted in the open skill menu (a skill, or the Change button of a form-change style), and prints it each time it changes.
// Needs an Administrator terminal and the game running, in a battle. Usage: bun run scan:menu. Open a skill menu, then use Down, Up and Tab.
//
// Everything is followed from BattleModule.Instance, so a retry or a new battle needs no restart and no search for the menu:
//   BattleModule.hudModule -> BattleHudModule.battleMemberHudModule -> BattleMemberHudModule
//     .selectedCharacterData / .selectedSkillIndex / .focusedSkillIndex / .focusedLastSkillIndex     (the game's own bookkeeping)
//     .uiBattleSkillMenu -> .scrollView (the list) -> .list (array of rows) -> row.skillButton -> ._button -> ._isFocused
// Both are printed, to check that the game's `focusedSkillIndex` agrees with the highlight drawn on screen (the `_isFocused` row).
// The open character's form-change state is printed too (see "Form change" in scanner/README.md).

import { fieldOf, findClasses, liveBattleModule } from "./il2cpp.ts";
import { findPid, openProcess, read, readArray, readInt32, readManagedString, readPointer } from "./memory.ts";

const CHANGE_BUTTON = 100; // BattleMemberHudModule.focusedSkillIndex while the Change (form change) button is highlighted

const pid = Number(process.argv[2] ?? findPid("HeavenBurnsRed.exe"));
const handle = openProcess(pid);
console.log(`Attached to PID ${pid}`);

const clock = () => new Date().toLocaleTimeString();
// Field offsets are looked up by name in the live class (see "Field offsets and game updates" in scanner/README.md). Null in, null out.
const at = (object: bigint | null, name: string) => object && object + fieldOf(handle, object, name);
const follow = (object: bigint | null, name: string) => {
  const address = at(object, name);
  return (address && readPointer(handle, address)) || null;
};
const int = (object: bigint | null, name: string) => {
  const address = at(object, name);
  return address ? readInt32(handle, address) : null;
};
const flag = (object: bigint | null, name: string) => {
  const address = at(object, name);
  return address ? read(handle, address, 1)?.[0] === 1 : false;
};

console.log("Searching memory for the BattleModule class...");
const classes = findClasses(handle, "BattleModule", "Lily.Battle");
if (classes.length === 0) throw new Error("Could not find the BattleModule class.");

/** The live BattleMemberHudModule, followed from BattleModule.Instance. Null outside a battle (the instance is empty for a moment between battles). */
function memberHud(): bigint | null {
  return follow(follow(liveBattleModule(handle, classes), "hudModule"), "battleMemberHudModule");
}

/** The skill menu's rows, or [] when the menu object doesn't exist yet. */
function rowsOf(hud: bigint): bigint[] {
  const list = follow(follow(hud, "uiBattleSkillMenu"), "scrollView");
  const array = follow(list, "list"); // a field of the generic XIUIDataListBase, which dump.cs shows as 0x0
  return (array && readArray(handle, array, 30)) || [];
}

// Read live every time: Tab swaps a skill's name, and opening another character rebinds each row to a new entity.
// ponytail: a character with fewer skills than rows leaves the extra rows holding the previous character's data, and no field marks them
// (_focusableList, isLastIndex and enableAutoConfig were tried). Ignore rows past the character's skill count from `scan:skills`.
const nameOf = (row: bigint) => {
  const text = follow(follow(row, "entity"), "skillName");
  return (text && readManagedString(handle, text)) ?? "?";
};
const isFocused = (row: bigint) => flag(follow(follow(row, "skillButton"), "_button"), "_isFocused");

/** The menu's state as printed text. */
function describe(hud: bigint): string {
  const character = follow(hud, "selectedCharacterData");
  const rows = rowsOf(hud);
  const row = rows.findIndex(isFocused);
  const focused = int(hud, "focusedSkillIndex");
  const formLabel = follow(follow(follow(character, "domainCard"), "master"), "AnotherCardFormLabel");
  const formText = formLabel && readManagedString(handle, formLabel);
  const anotherForm = flag(character, "_isAnotherCardForm");
  return [
    `character position ${int(character, "position")}  selectedSkillIndex ${int(hud, "selectedSkillIndex")}  focusedSkillIndex ${focused}${
      focused === CHANGE_BUTTON ? " (Change button)" : focused === 0 ? " (normal attack / nothing)" : ""
    }  focusedLastSkillIndex ${int(hud, "focusedLastSkillIndex")}`,
    `form change: ${formText ? `yes (${formText}), alternate form active: ${anotherForm}` : "no"}`,
    `highlighted row (_isFocused) ${row}${row >= 0 ? `  ${nameOf(rows[row])}` : "  (none)"}`,
    rows.map((r, i) => `[${i}] ${nameOf(r)}`).join(", "),
  ].join("\n    ");
}

console.log("Watching (Ctrl+C to stop). Open a skill menu in a battle...");
let last = "";
while (true) {
  let now = "no battle (BattleModule.Instance is empty)";
  try {
    const hud = memberHud();
    if (hud) now = describe(hud);
  } catch (error) {
    // A freed object during a battle swap, or a field that a game update removed. Either way, show it and keep going.
    now = `unreadable: ${(error as Error).message}`;
  }
  if (now !== last) console.log(`${clock()}  ${now}`);
  last = now;
  await new Promise((resolve) => setTimeout(resolve, 50));
}
