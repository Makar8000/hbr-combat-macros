// Lists the characters of the battle in progress with the skills the game holds for each, by id (Label) and display name (Name).
// Needs an Administrator terminal and the game running, in a battle. Usage: bun run scan:skills
//
// Only one memory search is needed (the BattleModule class). Everything else is followed from it, so no stale objects turn up:
//   BattleModule.Instance (static) -> characterDataManager -> frontPlayerList / subPlayerList -> BattlePlayerData
//   BattlePlayerData.frontSkillList -> BattleSkill.domainSkill -> DomainSkill.master -> MasterSkill.Label / Id / Name
//   BattleModule.overDriveManager -> BattleOverDriveManager.state / currentPoint

import { fieldOf, findClasses, liveBattleModule } from "./il2cpp.ts";
import { findPid, openProcess, read, readInt32, readList, readManagedString, readPointer } from "./memory.ts";

const OVERDRIVE_STATES = ["None", "Charging", "CanPush", "WaitForInvoke", "PlayingEffect", "Playing"];

const pid = Number(process.argv[2] ?? findPid("HeavenBurnsRed.exe"));
const handle = openProcess(pid);
console.log(`Attached to PID ${pid}`);

const hex = (address: bigint) => `0x${address.toString(16)}`;

// Field offsets are looked up by name in the live class, so a game update needs no edits here (see "Field offsets and game updates" in scanner/README.md).
const at = (object: bigint, name: string) => object + fieldOf(handle, object, name);
/** The object a reference field points at, or null. */
const follow = (object: bigint, name: string) => readPointer(handle, at(object, name)) || null;
const text = (object: bigint, name: string) => readManagedString(handle, follow(object, name) ?? 0n);

/** "Label / Id / Name" for a BattleSkill object, or why it could not be read. */
function describeSkill(skill: bigint): string {
  const domain = follow(skill, "domainSkill");
  const master = domain && follow(domain, "master");
  if (!master) return `(no master skill, BattleSkill ${hex(skill)})`;
  const idBytes = read(handle, at(master, "Id"), 8);
  const id = idBytes ? new DataView(idBytes.buffer).getBigInt64(0, true) : "?";
  return `${text(master, "Label") ?? "?"}  /  ${id}  /  ${text(master, "Name") ?? "?"}`;
}

/** "style label / character label" from the character's card, e.g. "SSakuraba07 / SSakuraba". */
function describeCard(character: bigint): string {
  const card = follow(character, "domainCard");
  const master = card && follow(card, "master");
  if (!master) return "(no card)";
  return `${text(master, "Label") ?? "?"} / ${text(master, "MasterCharacterLabel") ?? "?"}`;
}

const start = performance.now();
console.log("Searching memory for the BattleModule class...");
const classes = findClasses(handle, "BattleModule", "Lily.Battle");
console.log(`  found in ${((performance.now() - start) / 1000).toFixed(1)}s`);

const module = liveBattleModule(handle, classes);
if (!module) {
  throw new Error("BattleModule.Instance is empty. Is the game in a battle?");
}

const manager = follow(module, "characterDataManager");
if (!manager) throw new Error("BattleModule has no character manager yet.");
console.log(`BattleModule ${hex(module)}, character manager ${hex(manager)}`);

const overdrive = follow(module, "overDriveManager");
if (overdrive) {
  const state = readInt32(handle, at(overdrive, "state"));
  console.log(`Overdrive: ${OVERDRIVE_STATES[state ?? -1] ?? state}, ${readInt32(handle, at(overdrive, "currentPoint"))} points`);
}

for (const [line, field] of [
  ["Front", "frontPlayerList"],
  ["Sub", "subPlayerList"],
] as const) {
  const list = follow(manager, field);
  const members = list ? readList(handle, list, 30) : null;
  if (!members) {
    console.log(`\n${line}: unreadable`);
    continue;
  }
  console.log(`\n${line} line (${members.length}). Skill order is the order of frontSkillList, like the on-screen skill list.`);
  for (const c of members) {
    const skills = readList(handle, follow(c, "frontSkillList") ?? 0n, 30) ?? [];
    console.log(
      `${hex(c)}  team ${readInt32(handle, at(c, "team"))}  position ${readInt32(handle, at(c, "position"))}  initial ${readInt32(
        handle,
        at(c, "initialPosition"),
      )}  style ${describeCard(c)}`,
    );
    const normal = follow(c, "_normalSkill");
    if (normal) console.log(`    normal attack: ${describeSkill(normal)}`);
    for (const [i, skill] of skills.entries()) {
      console.log(`    [${i}] ${describeSkill(skill)}`);
    }
  }
}
