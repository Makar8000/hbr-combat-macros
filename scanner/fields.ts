// Prints the fields of classes, with offsets, read from the running game's own class data (no dump.cs needed).
// Needs an Administrator terminal and the game running. Usage: deno task scan:fields <ClassName> [<ClassName> ...]
//
// Use it to find what a field is called after a game update, or to explore a class. Properties show as `<name>k__BackingField`.
// If the output is empty or garbage for a class that exists, the Il2CppClass layout in il2cpp.ts has probably changed.

import { classFields, findClassesMany } from "./il2cpp.ts";
import { findPid, openProcess } from "./memory.ts";

const names = Deno.args;
if (names.length === 0) throw new Error("Usage: deno task scan:fields <ClassName> [<ClassName> ...]");

const handle = openProcess(findPid("HeavenBurnsRed.exe"));
const found = findClassesMany(handle, names.map((name) => [name, null]));

for (const name of names) {
  // The name string also turns up in other structures that look like a class but have no fields.
  const classes = found.get(name)!.map((klass) => [klass, classFields(handle, klass)] as const).filter(([, fields]) => fields.length > 0);
  console.log(`\n${name}: ${classes.length} class(es)`);
  for (const [klass, fields] of classes) {
    console.log(`  0x${klass.toString(16)}: ${fields.length} field(s)`);
    for (const f of fields) {
      console.log(`    ${f.isStatic ? "static " : "       "}0x${f.offset.toString(16).padStart(3, "0")}  ${f.name}  (${f.owner})`);
    }
  }
}
