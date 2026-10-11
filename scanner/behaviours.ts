// Checks whether a state could be told apart by the class of its behaviours instead of by its name.
// Needs an Administrator terminal and the game running, in a battle. Usage: deno task scan:behaviours
//
// For every state of the battle machine (BattleModule.Instance -> parent -> battleStateMachine -> instance) it prints the name and the
// classes in State._Behaviours, then a summary: states with no behaviours, and classes shared by several states (which could not
// identify one of them). Writes the same text to scanner/out/behaviours.txt.

import { classNameOf, fieldOf, findClasses, liveBattleModule } from "./il2cpp.ts";
import { findPid, openProcess, readList, readManagedString, readPointer } from "./memory.ts";

const pid = Number(Deno.args[0] ?? findPid("HeavenBurnsRed.exe"));
const handle = openProcess(pid);
console.log(`Attached to PID ${pid}`);

const lines: string[] = [];
const out = (line: string) => {
  lines.push(line);
  console.log(line);
};
const follow = (object: bigint, name: string) => readPointer(handle, object + fieldOf(handle, object, name)) || null;

const module = liveBattleModule(handle, findClasses(handle, "BattleModule", "Lily.Battle"));
if (!module) throw new Error("BattleModule.Instance is empty. Is the game in a battle?");
const state = follow(module, "parent");
const sub = state && follow(state, "battleStateMachine");
const fsm = sub && follow(sub, "instance");
const list = fsm && follow(fsm, "_States");
const states = (list && readList(handle, list, 500)) || [];
if (states.length === 0) throw new Error("Could not read the battle machine's states.");

const rows = states.map((s) => {
  const name = follow(s, "name");
  const behaviours = follow(s, "_Behaviours");
  const items = (behaviours && readList(handle, behaviours, 100)) || [];
  return {
    name: (name ? readManagedString(handle, name) : null) ?? "?",
    classes: items.map((b) => classNameOf(handle, b) ?? "?"),
  };
});

out(`${rows.length} states in the battle machine:\n`);
for (const r of rows) out(`  ${r.name.padEnd(24)} ${r.classes.length === 0 ? "(no behaviours)" : r.classes.join(", ")}`);

const empty = rows.filter((r) => r.classes.length === 0);
const byFirst = new Map<string, string[]>();
for (const r of rows) if (r.classes[0]) byFirst.set(r.classes[0], [...(byFirst.get(r.classes[0]) ?? []), r.name]);
const shared = [...byFirst].filter(([, names]) => names.length > 1);
const nameCounts = new Map<string, number>();
for (const r of rows) nameCounts.set(r.name, (nameCounts.get(r.name) ?? 0) + 1);

out(`\nStates with no behaviours: ${empty.length}${empty.length ? `  (${empty.map((r) => r.name).join(", ")})` : ""}`);
out(`First-behaviour classes used by more than one state: ${shared.length}`);
for (const [klass, names] of shared) out(`  ${klass}: ${names.join(", ")}`);
const dup = [...nameCounts].filter(([, n]) => n > 1);
out(`State names used more than once: ${dup.length ? dup.map(([n, c]) => `${n} x${c}`).join(", ") : "none"}`);

// The states the scanners rely on, and whether each could be identified by its first behaviour alone.
out("\nThe states the scanners use:");
for (const wanted of ["コマンド選択", "オーバードライブ発動レベル選択", "Result", "Lose", "特殊コマンドの攻撃", "終了[Retry]", "部隊チェンジ開始"]) {
  const r = rows.find((row) => row.name === wanted);
  const first = r?.classes[0];
  const unique = first && byFirst.get(first)!.length === 1;
  out(`  ${wanted.padEnd(18)} ${r ? `${first ?? "(no behaviours)"}  ${unique ? "unique" : "NOT unique"}` : "not in this machine"}`);
}

Deno.mkdirSync("scanner/out", { recursive: true });
Deno.writeTextFileSync("scanner/out/behaviours.txt", lines.join("\n") + "\n");
console.log("\nWrote scanner/out/behaviours.txt");
