// Shows how the battle's Arbor state machine is reached from BattleModule (the path scan:fsm uses), and what else hangs off BattleModule.
// Needs an Administrator terminal and the game running, in a battle. Usage: deno task scan:modules
//
// Prints every reference field of BattleModule and of each object in its moduleList, as "field -> ClassName", then of its BattleState
// and that state's battleStateMachine. A line marked <== is an Arbor state machine. The last lines check that
// battleStateMachine.instance is the battle machine. Writes the same text to scanner/out/modules.txt.

import { classFields, classNameOf, fieldOf, findClasses, liveBattleModule } from "./il2cpp.ts";
import { findPid, openProcess, readList, readManagedString, readPointer } from "./memory.ts";

const pid = Number(Deno.args[0] ?? findPid("HeavenBurnsRed.exe"));
const handle = openProcess(pid);
console.log(`Attached to PID ${pid}`);

const hex = (address: bigint) => `0x${address.toString(16)}`;
const lines: string[] = [];
const out = (line: string) => {
  lines.push(line);
  console.log(line);
};
const follow = (object: bigint, name: string) => readPointer(handle, object + fieldOf(handle, object, name)) || null;

/** Prints every instance field of an object that points at another object, with that object's class. */
function describe(object: bigint, indent: string) {
  const klass = readPointer(handle, object);
  if (!klass) return;
  for (const field of classFields(handle, klass)) {
    if (field.isStatic) continue;
    const target = readPointer(handle, object + BigInt(field.offset));
    const name = target ? classNameOf(handle, target) : null;
    if (!target || !name) continue;
    const fsm = name.startsWith("ArborFSM") ? "   <==" : "";
    out(`${indent}+0x${field.offset.toString(16)} ${field.owner}.${field.name} -> ${name} ${hex(target)}${fsm}`);
  }
}

console.log("Searching memory for the BattleModule class...");
const module = liveBattleModule(handle, findClasses(handle, "BattleModule", "Lily.Battle"));
if (!module) throw new Error("BattleModule.Instance is empty. Is the game in a battle?");

out(`BattleModule ${hex(module)}`);
describe(module, "  ");

const moduleList = follow(module, "moduleList");
const modules = moduleList ? readList(handle, moduleList, 200) : null;
out(`\nmoduleList: ${modules ? `${modules.length} item(s)` : "unreadable"}`);
for (const item of modules ?? []) {
  out(`  ${classNameOf(handle, item) ?? "?"} ${hex(item)}`);
  describe(item, "      ");
}

// Every module's `parent` is the BattleState, an Arbor state behaviour that owns the battle's sub state machine.
const battleState = follow(module, "parent");
const sub = battleState && follow(battleState, "battleStateMachine");
if (battleState) {
  out(`\nBattleState ${classNameOf(handle, battleState)} ${hex(battleState)} fields:`);
  describe(battleState, "  ");
}
if (sub) {
  out(`\nbattleStateMachine ${classNameOf(handle, sub)} ${hex(sub)} fields:`);
  describe(sub, "  ");
  // The candidate: SubStateModule.instance. It is the battle machine if it is running and has the turn-ready state.
  const fsm = follow(sub, "instance");
  const state = fsm && follow(fsm, "_CurrentState");
  const name = state && follow(state, "name");
  const list = fsm && follow(fsm, "_States");
  const names = ((list && readList(handle, list, 500)) || []).map((s) => readManagedString(handle, follow(s, "name") ?? 0n));
  out(`\ninstance ${fsm ? hex(fsm) : "missing"}  now: ${(name ? readManagedString(handle, name) : null) ?? "?"}`);
  out(`  ${names.length} states, has コマンド選択: ${names.includes("コマンド選択")}`);
}

Deno.mkdirSync("scanner/out", { recursive: true });
Deno.writeTextFileSync("scanner/out/modules.txt", lines.join("\n") + "\n");
console.log("\nWrote scanner/out/modules.txt");
