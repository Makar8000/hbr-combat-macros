// Finding IL2CPP classes, fields and statics in a running game. Read-only. The class layout is for this game's Unity version
// (see "Field offsets and game updates" in scanner/README.md).

import { findPointers, findStrings, type Handle, read, readCString, readPointer } from "./memory.ts";

const CLASS_NAME = 0x10n; // Il2CppClass.name
const CLASS_NAMESPACE = 0x18n; // Il2CppClass.namespaze
const CLASS_STATIC_FIELDS = 0xb8n; // Il2CppClass.static_fields (verified live with BattleModule.Instance)

/**
 * The Il2CppClass addresses with this name and namespace. Empty if the game has not created the class (yet).
 * Pass `null` as the namespace when it isn't known: any class whose namespace pointer reads as a string is accepted.
 */
export function findClasses(handle: Handle, name: string, namespace: string | null): bigint[] {
  return findClassesMany(handle, [[name, namespace]]).get(name)!;
}

/**
 * Several classes in one go: two passes over memory in total, however many classes. Keyed by class name.
 * Memory images are skipped for speed. If any class turns up empty the search is repeated over everything, in case they matter.
 */
export function findClassesMany(handle: Handle, wanted: [name: string, namespace: string | null][]): Map<string, bigint[]> {
  for (const everything of [false, true]) {
    const strings = findStrings(handle, wanted.map(([name]) => name), everything);
    const pointers = findPointers(handle, [...strings.values()].flat(), everything);
    const result = new Map<string, bigint[]>();
    for (const [name, namespace] of wanted) {
      const classes: bigint[] = [];
      for (const string of strings.get(name)!) {
        for (const address of pointers.get(string) ?? []) {
          const klass = address - CLASS_NAME;
          const namespacePointer = readPointer(handle, klass + CLASS_NAMESPACE);
          const found = namespacePointer ? readCString(handle, namespacePointer) : null;
          if (found !== null && (namespace === null || found === namespace)) classes.push(klass);
        }
      }
      result.set(name, classes);
    }
    if (everything || [...result.values()].every((classes) => classes.length > 0)) return result;
  }
  throw new Error("unreachable");
}

/**
 * A static field's value (the pointer stored in it), found by name. Il2CppClass.static_fields points at a block that holds the
 * class's statics, and a static's offset is its position in that block (0 for the first, such as a singleton's Instance).
 * Null before the class is initialised, for a singleton whose object doesn't exist (BattleModule.Instance outside a battle),
 * and for a class without that field: a name search also returns lookalike structures that have no fields.
 */
export function readStatic(handle: Handle, klass: bigint, name: string): bigint | null {
  const field = findField(handle, klass, name);
  const statics = field?.isStatic ? readPointer(handle, klass + CLASS_STATIC_FIELDS) : null;
  const value = statics ? readPointer(handle, statics + BigInt(field!.offset)) : null;
  return value || null;
}

// ponytail: the standard IL2CPP layout, verified against this game with `scan:fields`. Only a Unity upgrade should move it.
const CLASS_PARENT = 0x58n; // Il2CppClass.parent
const CLASS_FIELDS = 0x80n; // Il2CppClass.fields (FieldInfo[])
const FIELD_INFO_SIZE = 0x20; // FieldInfo: name 0x0, type 0x8, parent 0x10, offset 0x18 (int32), token 0x1C
const MAX_FIELDS = 1000; // a safety stop, in case a table never ends
const TYPE_ATTRS = 0x8n; // Il2CppType.attrs (uint16)
const FIELD_ATTRIBUTE_STATIC = 0x10;

export type Field = { name: string; offset: number; isStatic: boolean; owner: string };

/** A class's fields, then its parent's, and so on. Offsets are within the object (statics: within the `static_fields` block). Empty if unreadable. */
export function classFields(handle: Handle, klass: bigint): Field[] {
  const fields: Field[] = [];
  let current: bigint | null = klass;
  for (let depth = 0; current && depth < 16; depth++) {
    const namePointer = readPointer(handle, current + CLASS_NAME);
    const owner = namePointer ? readCString(handle, namePointer, 64) : null;
    const table = readPointer(handle, current + CLASS_FIELDS);
    // The field count at CLASS_FIELD_COUNT is not reliable (too high for some classes, too low for others), so it is not used.
    // Every real FieldInfo points back at its class, so read entries until one doesn't.
    for (let i = 0; table && owner && i < MAX_FIELDS; i++) {
      const bytes = read(handle, table + BigInt(i * FIELD_INFO_SIZE), FIELD_INFO_SIZE);
      if (!bytes) break;
      const view = new DataView(bytes.buffer);
      if (view.getBigUint64(0x10, true) !== current) break;
      const name = readCString(handle, view.getBigUint64(0, true), 128);
      const attrs = read(handle, view.getBigUint64(8, true) + TYPE_ATTRS, 2);
      if (name === null || !attrs) continue;
      const isStatic = (new DataView(attrs.buffer).getUint16(0, true) & FIELD_ATTRIBUTE_STATIC) !== 0;
      fields.push({ name, offset: view.getInt32(0x18, true), isStatic, owner });
    }
    current = readPointer(handle, current + CLASS_PARENT);
  }
  return fields;
}

// Class addresses are fixed for a run, so each class's table is read once.
const fieldCache = new Map<bigint, Field[]>();

/** The offset of a field of a live object, found through the object's own class (every object starts with its class pointer). */
export function fieldOf(handle: Handle, object: bigint, name: string): bigint {
  const klass = readPointer(handle, object);
  if (!klass) throw new Error(`0x${object.toString(16)} is not an object (field '${name}')`);
  return fieldOffset(handle, klass, name);
}

/**
 * The offset of a field by name, looked up in the live class (inherited fields included). Throws if it isn't there.
 * Properties are stored as `<name>k__BackingField`, and some fields as `_name`, so those are tried too.
 */
export function fieldOffset(handle: Handle, klass: bigint, name: string): bigint {
  const field = findField(handle, klass, name);
  if (!field) throw new Error(`No field '${name}' on class 0x${klass.toString(16)}`);
  return BigInt(field.offset);
}

function findField(handle: Handle, klass: bigint, name: string): Field | undefined {
  const names = [name, `<${name}>k__BackingField`, `_${name}`];
  let fields = fieldCache.get(klass);
  if (!fields) fieldCache.set(klass, fields = classFields(handle, klass));
  return fields.find((f) => names.includes(f.name));
}

/**
 * The live BattleModule: the first class whose `Instance` holds a real BattleModule. Null outside a battle, and for a moment
 * between battles (an empty `Instance` means "read again", not "the battle is over"). `classes` are from `findClasses`.
 */
export function liveBattleModule(handle: Handle, classes: bigint[]): bigint | null {
  for (const klass of classes) {
    const module = readStatic(handle, klass, "Instance");
    if (module && classNameOf(handle, module) === "BattleModule") return module;
  }
  return null;
}

/** The class name of a live object (every object starts with its class pointer), or null if it doesn't look like one. */
export function classNameOf(handle: Handle, object: bigint): string | null {
  const klass = readPointer(handle, object);
  const name = klass ? readPointer(handle, klass + CLASS_NAME) : null;
  return name ? readCString(handle, name, 64) : null;
}
