// Finds the game's live Arbor state machines and prints the name of each one's current state whenever it changes.
// The battle machine is followed from BattleModule, so a retry, win, loss or squad change needs no new memory search.
// Needs an Administrator terminal and the game running. Usage: bun run scan:fsm
//
// The battle machine: BattleModule.Instance -> parent (BattleState) -> battleStateMachine (SubStateModule) -> instance (ArborFSM).
// The game builds a new machine for every battle, retry and squad change, and `instance` always holds the current one.
// The other machines (app, menus) have no such route, so they are found once at startup by searching memory for every object whose first
// word is an ArborFSM class pointer (see "How things are found" in scanner/README.md).

import { mkdirSync, writeFileSync } from "node:fs";
import { fieldOf, fieldOffset, findClasses, findClassesMany, liveBattleModule } from "./il2cpp.ts";
import { findPid, findPointers, openProcess, readList, readManagedString, readPointer } from "./memory.ts";

const FSM_NAMESPACE = "Arbor";

// Only the battle machine has this state. It is how the battle machine is told apart from the other machines.
const COMMAND_SELECT = "コマンド選択";
// If the game has not created the BattleModule class yet (it may only exist after the first battle), look again this often.
const CLASS_RETRY_MS = 5000;

const pid = Number(process.argv[2] ?? findPid("HeavenBurnsRed.exe"));
const handle = openProcess(pid);
console.log(`Attached to PID ${pid}`);

const hex = (address: bigint) => `0x${address.toString(16)}`;
const clock = () => new Date().toLocaleTimeString();

function time<T>(label: string, work: () => T): T {
  const start = performance.now();
  const result = work();
  console.log(`${label} (${((performance.now() - start) / 1000).toFixed(1)}s)`);
  return result;
}

// The classes never move while the game runs, so they are only looked up once.
console.log("Searching memory for the classes...");
// Live machines are ArborFSM, a sealed subclass of ArborFSMInternal. Both keep _CurrentState at the same offset.
const found = time("Found the classes", () =>
  findClassesMany(
    handle,
    ["ArborFSM", "ArborFSMInternal", "State"].map((name) => [name, FSM_NAMESPACE]),
  ),
);
for (const [name, classes] of found) {
  if (classes.length === 0) throw new Error(`Could not find the ${name} class. The class layout may have changed.`);
}
const fsmClasses = [...found.get("ArborFSM")!, ...found.get("ArborFSMInternal")!];
const stateClasses = found.get("State")!;
console.log(`  FSM class ${fsmClasses.map(hex)}, State class ${stateClasses.map(hex)}`);

// Field offsets are looked up by name in the live classes (see "Field offsets and game updates" in scanner/README.md). A name search can also return
// lookalike structures with no fields, so use the first class that has the field. Candidate objects can't be used for this: until
// they are checked, their first word is not known to be a class.
function offsetIn(classes: bigint[], name: string): bigint {
  for (const klass of classes) {
    try {
      return fieldOffset(handle, klass, name);
    } catch {
      /* not this one */
    }
  }
  throw new Error(`No field '${name}' on any of the classes. The class layout may have changed.`);
}
const FSM_CURRENT_STATE = offsetIn(fsmClasses, "_CurrentState"); // ArborFSMInternal
const FSM_STATES = offsetIn(fsmClasses, "_States"); // ArborFSMInternal, a List<State>
const STATE_NAME = offsetIn(stateClasses, "name"); // State

let states = new Set<bigint>();
let machines: bigint[] = [];
let battleMachines = new Set<bigint>();

/** The name of the machine's current state, or null if it isn't a real, running state machine. */
function currentStateName(fsm: bigint): string | null {
  const state = readPointer(handle, fsm + FSM_CURRENT_STATE);
  if (!state || !states.has(state)) return null;
  const namePointer = readPointer(handle, state + STATE_NAME);
  return (namePointer && readManagedString(handle, namePointer)) || "(unnamed)";
}

function listStates(fsm: bigint): string[] {
  const list = readPointer(handle, fsm + FSM_STATES);
  return (
    (list &&
      readList(handle, list)?.map((state) => {
        const namePointer = states.has(state) ? readPointer(handle, state + STATE_NAME) : null;
        return (namePointer && readManagedString(handle, namePointer)) || "(unnamed)";
      })) ||
    []
  );
}

/** Finds every live object of the classes (about 2 to 3 seconds). */
function scan() {
  const objects = findPointers(handle, [...fsmClasses, ...stateClasses]);
  states = new Set(stateClasses.flatMap((c) => objects.get(c) ?? []));
  // Class pointers also appear in other places, so a real machine is one whose _CurrentState is a real State object.
  machines = fsmClasses.flatMap((c) => objects.get(c) ?? []).filter((fsm) => currentStateName(fsm) !== null);
  battleMachines = new Set(machines.filter((fsm) => listStates(fsm).includes(COMMAND_SELECT)));
}

/** Every state each machine has, so the important ones can be found without triggering them in the game. */
function writeStateList() {
  const text = machines.map(
    (fsm) =>
      `${hex(fsm)}  (now: ${currentStateName(fsm)})\n${listStates(fsm)
        .map((n) => `    ${n}`)
        .join("\n")}`,
  );
  mkdirSync("scanner/out", { recursive: true });
  writeFileSync("scanner/out/fsm-states.txt", text.join("\n\n") + "\n");
}

console.log("Searching memory for live objects of both classes...");
time("Searched for objects", scan);
console.log(`  ${machines.length} running state machine(s), ${battleMachines.size} of them battle machine(s):`);
for (const fsm of machines) console.log(`  ${hex(fsm)}  ${currentStateName(fsm)}${battleMachines.has(fsm) ? "   <- battle" : ""}`);
writeStateList();
console.log("\nWrote every machine's full state list to scanner/out/fsm-states.txt");

/** The name of a state machine's current state. Used for the battle machine, which is reached by pointers so needs no check. */
function stateNameOf(fsm: bigint): string | null {
  const state = readPointer(handle, fsm + FSM_CURRENT_STATE);
  const namePointer = state && readPointer(handle, state + STATE_NAME);
  return (namePointer && readManagedString(handle, namePointer)) || null;
}

let battleModuleClasses = findClasses(handle, "BattleModule", "Lily.Battle");
let nextClassSearch = Date.now() + CLASS_RETRY_MS;

/** The current battle machine (with its module, to tell battles apart), or null outside a battle. */
function liveBattleMachine() {
  const module = liveBattleModule(handle, battleModuleClasses);
  const state = module && readPointer(handle, module + fieldOf(handle, module, "parent"));
  const sub = state && readPointer(handle, state + fieldOf(handle, state, "battleStateMachine"));
  const fsm = sub && readPointer(handle, sub + fieldOf(handle, sub, "instance"));
  return module && fsm ? { module, fsm } : null;
}

// The searched machines that are not battle machines. Old battle machines linger in memory, so the searched ones are not watched.
const last = new Map(machines.filter((fsm) => !battleMachines.has(fsm)).map((fsm) => [fsm, currentStateName(fsm)]));
let battle = ""; // "module:machine" of the battle being watched. The module is included because a new machine can reuse an address.
let battleState: string | null = null;

console.log("\nWatching for state changes (Ctrl+C to stop)...");
while (true) {
  for (const [fsm, before] of last) {
    const name = currentStateName(fsm);
    if (name === null || name === before) continue;
    console.log(`${clock()}  ${hex(fsm)}  ${before} -> ${name}`);
    last.set(fsm, name);
  }

  if (battleModuleClasses.length === 0 && Date.now() >= nextClassSearch) {
    battleModuleClasses = findClasses(handle, "BattleModule", "Lily.Battle");
    nextClassSearch = Date.now() + CLASS_RETRY_MS;
  }
  const live = liveBattleMachine();
  const key = live ? `${hex(live.module)}:${hex(live.fsm)}` : "";
  const name = live ? stateNameOf(live.fsm) : null;
  // For a moment after a battle ends, the new BattleState still points at the finished machine. A real new battle never starts in `終了[...]`.
  if (key !== battle && name?.startsWith("終了[")) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    continue;
  }
  if (key !== battle) {
    battle = key;
    battleState = name;
    console.log(`${clock()}  ${live ? `NEW battle machine ${hex(live.fsm)} (${name ?? "no state yet"})` : "no battle machine"}`);
  } else if (live && name !== null && name !== battleState) {
    console.log(`${clock()}  ${hex(live.fsm)}  ${battleState} -> ${name}`);
    battleState = name;
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
}
