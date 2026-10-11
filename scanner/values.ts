// Prints the live values of a few game objects and shows each change as it happens.
// Needs an Administrator terminal and the game running, in a battle. Usage: bun run scan:values
//
// Watches:
//   - UserBattleSetting.autoMode: Off / Saving / Full. Toggle auto mode in the game to see it change.
//   - BattleOverDriveManager.state: whether overdrive can be pressed (CanPush). Charge overdrive to see it change.
// No object is searched for. Only the UserData and BattleModule classes are looked up (once, about 4s), then both objects are followed
// from their statics on every tick, so a new battle (or a reloaded user) is picked up with no restart:
//   UserData.instance -> battleSetting          BattleModule.Instance -> overDriveManager
//
// Field offsets are looked up by name in the live class (see "Field offsets and game updates" in scanner/README.md).

import { classNameOf, fieldOf, findClassesMany, liveBattleModule, readStatic } from "./il2cpp.ts";
import { findPid, openProcess, read, readPointer } from "./memory.ts";

const BATTLE_NAMESPACE = "Lily.Battle";
type Field = { name: string; size: 1 | 4; labels?: string[] };
type Spec = { name: string; fields: Field[] };

const AUTO_MODES = ["Off", "Saving", "Full"];
const OVERDRIVE_STATES = ["None", "Charging", "CanPush", "WaitForInvoke", "PlayingEffect", "Playing"];
const OBJECT_SIZE = 0x90;

const settingSpec: Spec = {
  name: "UserBattleSetting",
  fields: [
    { name: "battleSpeed", size: 4 },
    { name: "autoMode", size: 4, labels: AUTO_MODES },
    { name: "lastAutoMode", size: 4, labels: AUTO_MODES },
  ],
};
const overdriveSpec: Spec = {
  name: "BattleOverDriveManager",
  fields: [
    { name: "state", size: 4, labels: OVERDRIVE_STATES },
    { name: "isForbiddenPush", size: 1 },
    { name: "prohibitFromInvoking", size: 1 },
    { name: "currentPoint", size: 4 },
    { name: "currentStockCount", size: 4 },
    { name: "activatedLevel", size: 4 },
  ],
};

const pid = Number(process.argv[2] ?? findPid("HeavenBurnsRed.exe"));
const handle = openProcess(pid);
console.log(`Attached to PID ${pid}`);

const hex = (address: bigint) => `0x${address.toString(16)}`;
const clock = () => new Date().toLocaleTimeString();
const snapshot = (address: bigint) => {
  const bytes = read(handle, address, OBJECT_SIZE);
  return bytes && new DataView(bytes.buffer);
};

/** Each field's value in a snapshot of the object, found by name through the object's own class. */
function fieldValues(spec: Spec, address: bigint, v: DataView): number[] {
  return spec.fields.map((f) => {
    const offset = Number(fieldOf(handle, address, f.name));
    return f.size === 1 ? v.getUint8(offset) : v.getInt32(offset, true);
  });
}
const fieldTexts = (spec: Spec, address: bigint, v: DataView) =>
  fieldValues(spec, address, v).map((n, i) => `${spec.fields[i].name}=${spec.fields[i].labels?.[n] ?? n}`);

console.log("Searching memory for the classes...");
const byName = findClassesMany(handle, [
  ["UserData", null],
  ["BattleModule", BATTLE_NAMESPACE],
]);
const userDataClasses = byName.get("UserData")!;
const moduleClasses = byName.get("BattleModule")!;
console.log(`  UserData: ${userDataClasses.map(hex).join(", ") || "not found"}`);
console.log(`  BattleModule: ${moduleClasses.map(hex).join(", ") || "not found"}`);

/**
 * The live UserBattleSetting: UserData.instance (a static) -> battleSetting (a field inherited from UserDataTable).
 * No object search is needed. A name search for "UserData" can also return unrelated classes, so each class's `instance` is checked.
 */
function liveSetting(): bigint | null {
  for (const klass of userDataClasses) {
    const userData = readStatic(handle, klass, "instance");
    if (!userData || classNameOf(handle, userData) !== "UserData") continue;
    const setting = readPointer(handle, userData + fieldOf(handle, userData, "battleSetting"));
    if (setting && classNameOf(handle, setting) === settingSpec.name) return setting;
  }
  return null;
}

/** The live overdrive manager, followed from BattleModule.Instance. A new battle changes it, with no search. Null outside a battle. */
function liveOverdrive(): bigint | null {
  const module = liveBattleModule(handle, moduleClasses);
  if (!module) return null;
  const manager = readPointer(handle, module + fieldOf(handle, module, "overDriveManager"));
  // A manager freed during a battle swap reads as something else, so check its class before trusting it.
  return manager && classNameOf(handle, manager) === overdriveSpec.name ? manager : null;
}

const last = new Map<bigint, string[]>();
const specOf = new Map<bigint, Spec>();
// The objects being watched, each followed from a static every tick. Null while it can't be reached.
const watched: [spec: Spec, find: () => bigint | null, current: bigint | null][] = [
  [settingSpec, liveSetting, null],
  [overdriveSpec, liveOverdrive, null],
];

console.log("\nWatching for changes (Ctrl+C to stop). A new battle is followed automatically...");
while (true) {
  for (const entry of watched) {
    let now: bigint | null = null;
    try {
      now = entry[1]();
    } catch {
      // An object freed during a battle swap has no readable class. Treat it as missing for this tick.
    }
    if (now === entry[2]) continue;
    entry[2] = now;
    if (now) {
      specOf.set(now, entry[0]);
      last.delete(now);
      console.log(`${clock()}  ${entry[0].name} is now ${hex(now)}`);
    } else console.log(`${clock()}  no ${entry[0].name}`);
  }
  for (const address of watched.flatMap(([, , current]) => (current ? [current] : []))) {
    const spec = specOf.get(address)!;
    const v = snapshot(address);
    if (!v) continue;
    const after = fieldTexts(spec, address, v);
    const before = last.get(address);
    last.set(address, after);
    if (!before) console.log(`${clock()}  ${spec.name} ${hex(address)}  ${after.join(" ")}`);
    else {
      const changed = after.flatMap((text, i) => (text !== before[i] ? [`${before[i]} -> ${text}`] : []));
      if (changed.length) console.log(`${clock()}  ${spec.name} ${hex(address)}  ${changed.join("   ")}`);
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
}
