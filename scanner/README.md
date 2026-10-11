# Memory scanner notes

Research into reading the game's state from memory instead of matching screenshots. Nothing here is used by the macro yet.
Everything is **read-only**: it never writes to or injects into the game.

## Basics

- The game is Unity **IL2CPP** (`GameAssembly.dll`, metadata version 31). `global-metadata.dat` is not encrypted.
- Anti-cheat blocks `OpenProcess` unless the terminal is **elevated** (error 5 otherwise). Elevated reads work.
- Addresses change on every launch, so nothing is hardcoded. Classes are found by name each run (see "How things are found").
- Memory reads are a bigger anti-cheat footprint than screen reads. Use a throwaway account.
- `MemoryScrambler.dll` exists in the game, and HP and similar values may be scrambled. Nothing used here (skills, positions, states,
  overdrive, auto mode) was.
- State names are Japanese. Skill names in the skill menu rows are English, but `MasterSkill.Name` is Japanese, so use `Label`.

## Tools

All are read-only. Run them in an **elevated terminal with the game running**. Most take an optional PID as their argument.

| Command                     | What it does                                                                                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bun run scan:fields`     | Prints the fields and offsets of the classes you name (`bun run scan:fields BattleModule MasterCard`), read from the running game.                                                                                           |
| `bun run scan:metadata`   | Parses `global-metadata.dat` into `scanner/out/metadata-dump.txt` (class, field and method names, no offsets). Needs no game.                                                                                                  |
| `bun run scan:fsm`        | Finds the app and menu machines once, writes every state name to `scanner/out/fsm-states.txt`, then prints state changes live. The battle machine is followed from `BattleModule`, so any battle is picked up with no rescans. |
| `bun run scan:values`     | In a battle. Prints `UserBattleSetting` (auto mode, from `UserData.instance`) and the live overdrive manager (state, points, stock), and every change. A new battle is picked up with no restart.                              |
| `bun run scan:skills`     | In a battle. Prints the front and sub lines with `team`, `position`, `initialPosition`, the style, and each character's skills (`Label` / `Id` / `Name`), plus the overdrive state. Prints once and exits.                     |
| `bun run scan:menu`       | In a battle. Prints `focusedSkillIndex` (`100` is the Change button), the `_isFocused` row, the row names, and whether the open character has a form change and which form is active. Works after a retry with no restart.     |
| `bun run scan:modules`    | In a battle. Experiment: prints the objects `BattleModule` and its modules point at, and the path to the battle's state machine. Writes `scanner/out/modules.txt`.                                                             |
| `bun run scan:behaviours` | In a battle. Experiment: prints every state of the battle machine with the classes of its behaviours, and which are unique. Writes `scanner/out/behaviours.txt`.                                                               |

`scanner/memory.ts` (open process, read, walk regions, find strings and pointers) and `scanner/il2cpp.ts` (find classes, read fields and
statics by name) are the shared helpers. `scanner/out/` is git-ignored.

## How things are found

1. `Il2CppClass.name` is at `+0x10`, `.namespaze` at `+0x18` and `.static_fields` at `+0xB8`. To find a class: search memory for its name as
   a null-terminated string, then for a pointer to that string, then `klass = pointer - 0x10`. Check the namespace.
2. `readStatic(klass, "Instance")` reads a singleton's `Instance`. **Everything about the current battle is followed from `BattleModule.Instance`**
   (namespace `Lily.Battle`), and the player's settings from `UserData.instance`. Never search memory for objects when a path exists: old
   battles' objects, managers and UI linger and look real.
3. `BattleModule.Instance` is empty for a moment between battles. Treat an empty value as "read again", not "the battle is over".
4. Only the app and menu Arbor state machines still need an object search, once, at the startup of `scan:fsm`. A class pointer also appears
   in unrelated places, so keep only addresses that look real (a state machine whose `_CurrentState` is a real `State`).
5. A search walks the whole process, so `memory.ts` skips code and data images (`MEM_IMAGE`), reuses one buffer, and tests the low 16 bits
   in a table first. `findClassesMany` finds several classes in two passes in total, and repeats over everything if one comes up empty.
   Measured: a class lookup takes about 4s, `scan:fsm`'s three classes 4 to 9s, and its object search 1 to 3s.

## Field offsets and game updates

Field offsets are **looked up by name in the running game**, so most updates need no edits. Every `Il2CppClass` points (`+0x80`) at a table of
fields, in entries of 0x20 bytes: name pointer `+0x0`, type `+0x8`, owning class `+0x10`, offset (int32) `+0x18`. `classFields` in
`scanner/il2cpp.ts` reads it (parent classes included), and `fieldOf(handle, object, name)` or `fieldOffset(handle, klass, name)` find one field.
`fieldOf` needs only a live object, because every object starts with its class pointer. Verified against every offset in "Offsets reference".

- **Names:** properties are stored as `<name>k__BackingField` and some fields as `_name` (`state` is `_state`), so the lookup tries all three.
- **The entry count is not used.** The count at `+0x120` reads too high on some classes (`BattleModule`) and too low on others (`MasterCard`). Entries
  are read until one whose owning class is not this class.
- **Statics:** `readStatic(handle, klass, "Instance")` finds the static field by name, and its offset is its position in the block at `+0xB8`.
  `liveBattleModule` is the shared way to reach `BattleModule.Instance`.
- **Lookalikes:** searching for a class name also returns structures that look like the class but have no fields. They give empty results and
  are skipped.
- **Generic classes** have real offsets in memory, where `dump.cs` prints `0x0` (`XIUIDataListBase.list` is `0x38`).
- Each class's table is read once and cached. A class that can't be read gives a "No field" error, not a wrong offset.

`bun run scan:fields <ClassName> ...` prints a class's fields and offsets from the running game. It replaces searching `dump.cs`.

**Still hardcoded:** the `Il2CppClass` layout (`name` `0x10`, `namespaze` `0x18`, `parent` `0x58`, `fields` `0x80`, `static_fields` `0xB8`) in
`il2cpp.ts`, and the list, array and string layouts in `memory.ts`. These only change if the game upgrades Unity.

**How an update shows up:**

- A renamed or removed field stops the scanner with `No field 'x' on class 0x...`. Run `scan:fields` on that class to see what it is called now,
  and change the name in the scanner.
- A renamed class stops it with `Could not find the ... class` (`scan:fsm`, `scan:menu`) or finds nothing (`scan:skills`).
- A changed `Il2CppClass` layout shows up everywhere at once: no class or field is found, or reads are garbage. Check `scan:fields BattleModule`.
- Game text changes too. If an update renames a state (for example fixing the `痔` typo in `味方ターンの終了痔`), anything matching the old text
  stops matching, so re-read `scanner/out/fsm-states.txt`.
- `scan:metadata` stops with an error if the metadata version is not 31.

`dump.cs` is no longer needed to read the game. It is still the easiest way to browse (what classes exist, what a class inherits, method names).

**Getting `dump.cs`:** download [Il2CppDumper](https://github.com/Perfare/Il2CppDumper) (net7 win v6.7.46 was used), run `Il2CppDumper.exe`, and pick
`GameAssembly.dll` and then `HeavenBurnsRed_Data\il2cpp_data\Metadata\global-metadata.dat`. Keep the result at `cache/dump.cs` (git-ignored, about 1.8 million lines, so search it with a script rather than opening it in an editor).

## The battle state machine

Battle flow is an **Arbor FSM** (`Arbor.ArborFSM`, a sealed subclass of `ArborFSMInternal`). Its current state name follows the turn cycle and
replaces the screen checks in `src/game/conditions.ts`. There are about 17 machines (app, menus, loading overlays), and exactly one is the
battle's. In a memory search it is the one whose state list contains `コマンド選択` and whose current state is live. Normally, follow the path
below instead.

### Reaching the battle machine

`BattleModule.Instance` -> `parent` (the `BattleState`) -> `battleStateMachine` (a `SubStateModule`) -> `instance` (the `ArborFSM`).
Checked with `scan:modules` in a battle after an earlier battle, after a withdraw and after a retry: each time `instance` was a different
machine in `コマンド選択` with 40 states. So it always holds the current battle's machine, and `scan:fsm` needs no rescans for battles. It
needs the `BattleModule` class search once (about 4s). Before the first battle `BattleModule.Instance` is empty, and `scan:fsm` just says
`no battle machine` until a battle starts.

For a moment after a battle ends, the new `BattleModule` exists while its `BattleState.instance` still points at the finished machine (seen
live: a `終了[Retry]` or `終了[Lose]` machine reported as "new"). A real new battle never starts in `終了[...]`, so `scan:fsm` ignores a
changed machine until it is out of that state. A brand-new machine also has no current state for an instant (`null -> StartEffect`).

Dead ends, so they are not tried again:

- `BattleModule.moduleList` holds the HUD, two initialisers, the view manager and the field module. No machine, and `disposableList` is empty.
  (`scan:modules` still prints it.)
- `BattleState.scriptInstanceList` is empty in a real battle.
- `BattleState._NodeGraph` is the outer `Event` machine that owns the state, and `SubStateModule._subStatePrefab` is the prefab (template).

The app and menu machines have no such route, so `scan:fsm` still finds them once at startup with a memory search and does not rescan.

### A new battle means a new machine

A retry, a squad change, Fight Again and every new battle **create a new battle machine**. The old one is not reusable and is not cleaned up
quickly, so a memory search can find several battle machines in a terminal state (`終了[Lose]`, `終了[Retry]`, `New State`) and exactly one
live one. A finished machine's memory is soon reused, and it then reads as `(unnamed)`, `None` or nonsense text (for example
`<size={0}%>...`), so never trust one for a battle that has ended. Accepting a state only when it exactly equals a known state name filters
these out.

- A new machine can reuse an old machine's address (seen: a retry's replacement took the address of a finished `終了[Lose]` machine), so an
  address says nothing about which battle it belongs to.
- Never cache the battle machine's address for a whole run. Follow the pointers from `BattleModule` each time.

### States

| Screen check   | State                                             |
| -------------- | ------------------------------------------------- |
| Turn ready     | `コマンド選択` (the player can pick skills now)   |
| Overdrive menu | `オーバードライブ発動レベル選択`                  |
| Battle result  | Win: `Result` (after `BattleClear`). Loss: `Lose` |

Other states seen: `次の行動を判定`, `味方ターン開始`, `味方ターンの行動を事前演算`, `味方ターンの行動を実行` (about 8s of animation),
`味方ターンの終了痔` (`痔` is the game's typo for `時`, match the exact text), `敵ターンの開始`, `敵ターンの行動を実行`, `敵ターン終了時`, `Preturn`,
`StartEffect`, `敵の先制行動`, `コマンド選択へ` (about a second before `コマンド選択`), `オーバードライブ開始`, `特殊コマンドの攻撃`, `オート`,
`部隊チェンジ開始`, `PlayerDeath`, `Lose`, `BattleClear`, `Result`, `終了[Retry]` and `終了[Lose]`. The full list is written to
`scanner/out/fsm-states.txt` by `scan:fsm`. `PreResult`, `PostResult` and `終了[Win]` exist but were never seen.

**Sequences vary, so never match a fixed one. Wait for the one state you need.** For example the machine sometimes skips `味方ターンの終了痔`
and `敵ターン終了時`, goes `味方ターンの終了痔` -> `コマンド選択へ` -> `コマンド選択` in a normal turn, or goes straight from the ally
actions to the enemy actions.

### What each action does to the machine

- **Alt skill:** `コマンド選択` -> `特殊コマンドの攻撃` -> `コマンド選択` (about 4s). Same shape as overdrive: the machine leaves command select
  and comes back, so wait for it to leave before waiting for it to return.
- **Overdrive:** `コマンド選択` -> `オーバードライブ発動レベル選択` -> `オーバードライブ開始` -> `コマンド選択`. Cancelling the menu goes straight back to
  `コマンド選択`. A queued post-turn overdrive opens the menu from `味方ターンの終了痔` and then continues to `敵ターンの開始`.
- **Auto toggle:** `コマンド選択` -> `オート` -> `コマンド選択`, under a second, in either direction. `オート` is momentary and does not say which
  way the toggle went (read `autoMode`).
- **Extra turn:** `味方ターンの終了痔` -> `コマンド選択` directly, with no enemy states.
- **Win:** `味方ターンの終了痔` -> `BattleClear` (under a second) -> `Result` (same machine). If the enemy dies before attacking, the enemy states
  never appear. **`Result` is where the player decides what happens next:** the "Fight Again" prompt, the lifestone selection and its
  confirmation all happen inside it, and the machine does not move until they are done (13 to 53s). Fight Again then leaves it with
  `終了[Retry]`, only after the lifestones are confirmed. Not tested: a win followed by going Home.
- **Loss:** `敵ターンの行動を実行` -> `PlayerDeath` -> `Lose` (held about 12s until the player clicks) -> `終了[Lose]`. Withdrawing from command
  select goes `コマンド選択` -> `Lose` -> `終了[Lose]` within a second, so `Lose` alone is not always a screen the player sits on.
- **Retry:** pressed during command select, `コマンド選択` -> `終了[Retry]` directly.
- **Squad change:** `コマンド選択` -> `部隊チェンジ開始` -> `New State`, and the old machine stays on `New State`. The machine has two states
  named `New State`, so the name alone is ambiguous.

## Auto mode (`UserBattleSetting.autoMode`, read with `scan:values`)

| Value | Name     | Meaning                    |
| ----- | -------- | -------------------------- |
| 0     | `Off`    | Manual                     |
| 1     | `Saving` | Auto on, the "normal" auto |
| 2     | `Full`   | Auto on, the "full" auto   |

`lastAutoMode` is the same enum. The object **outlives a battle** (same address and values across a retry).

Reach it with no object search: `UserData.instance` (a static on `UserData`, an `internal` class that extends `UserDataTable`) -> `battleSetting`
(`UserDataTable._battleSetting`, a field inherited from the parent). `UserDataTable` is the only class that holds a `UserBattleSetting`. Found
by reading `dump.cs`, then checked live with `scan:values`.

## Overdrive (`BattleOverDriveManager`, read with `scan:values`)

Reach it with `BattleModule.overDriveManager`, which always points at the current battle's manager.

| Value | Name            | Meaning                                                                                     |
| ----- | --------------- | ------------------------------------------------------------------------------------------- |
| 0     | `None`          | Not in use                                                                                  |
| 1     | `Charging`      | The gauge is filling. Also the state after the bonus turns end                              |
| 2     | `CanPush`       | **Ready. This is when `o` works**                                                           |
| 3     | `WaitForInvoke` | `o` was pressed, but the level menu (`オーバードライブ発動レベル選択`) has not appeared yet |
| 4     | `PlayingEffect` | Animation lock after a level is chosen (battle state `オーバードライブ開始`)                |
| 5     | `Playing`       | Overdrive is active: the player is in its bonus turns                                       |

Lifecycle: `Charging` -> `CanPush` -> (press `o`) `WaitForInvoke` -> (pick a level) `PlayingEffect` -> `Playing` -> `Charging`.
**The charge is `currentPoint`, and each level costs 10,000** (checked: a level 2 use dropped it by 20,000 and set `activatedLevel` to 2), so the
highest usable level is `currentPoint / 10000` rounded down. `currentStockCount` (max 9) and the flags `isForbiddenPush` and `prohibitFromInvoking`
may block `o` even in `CanPush` (not checked). To use it: press `o` while the state is `CanPush`, until it becomes `WaitForInvoke`. Not checked:
whether cancelling the menu returns to `CanPush`.

## The party and its skills (`scan:skills`)

Follow `BattleModule.Instance` -> `characterDataManager` -> `frontPlayerList` (the three on the field, positions 0 to 2) and `subPlayerList`
(the three behind, 3 to 5). Every live character is `team` 1 (`Enemy` = 0, `Player` = 1). Objects are created per battle, so following the
path finds the current ones with no search. Scanning memory for `BattlePlayerData` instead returns stale copies (every character twice, plus
enemy-side objects with no card).

**Positions 0 and 1 are reversed against the screen.** Checked in several arrangements, including swapping only those two: `position` 0 and 1
are always the opposite of the on-screen order, and 2 to 5 match. The number keys follow the screen (`position` 0 = `BIYamawaki` and 1 =
`MSatsuki`: key `1` opened `MSatsuki`, key `2` opened `BIYamawaki`). `initialPosition` has the same reversal. The cause is unknown. Treat it
as an observed rule: **key = `position + 1`, except that positions 0 and 1 trade places.** Verified only for the front line of a six-character
party, on one account. A different party size or mode may differ.

### Skills

- `BattlePlayerData.frontSkillList` -> `BattleSkill.domainSkill` -> `DomainSkill.master` -> `MasterSkill` (namespace `FlatbufferNative`).
- **The order of `frontSkillList` matches the screen.** Index 0 is the normal attack and 1+ are the registered skills, in the order shown.
- **Use `Label`** (an id such as `SSakurabaSkill54`, the id the game uses in its own data) rather than `Name`, which is Japanese.
- To press a skill: the character's key, then Down once per index (see "The skill menu" for the Change button and for checking where you are).
- Skill ids and names do not look scrambled.

### Characters and styles

A character is a **style** (a card), and one character has many. Each `BattlePlayerData` has a `domainCard` whose `master` (`MasterCard`) has
the style `Label` (for example `SSakuraba07`) and `MasterCharacterLabel` (`SSakuraba`). A macro can say "this character" or "this style" and
the scanner finds which party position holds it. These match `cache/styles.json` and `cache/skills.json`, which are the datamines from SeraphDB
(not part of this repo's code):

- `skills.json` has 613 skills with `id`, `label`, `name` (English), `desc`, `sp_cost` and more. `label` is `MasterSkill.Label` and `id` is
  `MasterSkill.Id` (checked: `SSakurabaSkill54` is `46003211` in both).
- `styles.json` has 330 styles for 56 characters, each with `label`, `name`, `chara_label`, `chara`, `role`, `type`, `elements`, `team` and a
  `skills` array (passives included, so it is not the same as the on-screen list).
- **A skill label belongs to exactly one style**, so it identifies the style and the character. Every skill label starts with its
  character's `chara_label`.

### Form change

Some styles can change form (so far only `KAsakura09` is known; in `styles.json` only one style has an `another` set). A macro has to track
two things per character:

| What                         | Where                                                               | Notes                                                                       |
| ---------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Has a form change            | `BattlePlayerData.domainCard` -> `master` -> `AnotherCardFormLabel` | A non-empty string means yes. Checked: set on `KAsakura09`, empty on others |
| The alternate form is active | `BattlePlayerData._isAnotherCardForm` (bool)                        | Read live. `scan:menu` prints it                                            |

In the skill menu the Change button is **the first stop in the Down order**: Down once highlights Change (`focusedSkillIndex` `100`), and
Down twice reaches `frontSkillList[1]`. So skill `N` takes `N + 1` Downs on a style with a form change and `N` otherwise. Tab on a skill swaps
it to its alternate version (a name change in the row, for example `Sanguine Spinel` to `Iolite`).

`scan:menu` prints both (`form change: yes (<label>), alternate form active: <bool>`) and was seen working. Not logged: which key activates
Change, whether the skill list is rebuilt when the form flips, and the exact `_isAnotherCardForm` value after a flip.

## The skill menu (`scan:menu`)

The menu is UI, not a state machine state, so the machine stays on `コマンド選択` throughout. **Use the game's own record:
`BattleMemberHudModule.focusedSkillIndex`**, reached with no search from `BattleModule.Instance` -> `hudModule` -> `battleMemberHudModule`.
It keeps working after a retry (a retry builds a new battle UI).

| `focusedSkillIndex` | Meaning                                                           |
| ------------------- | ----------------------------------------------------------------- |
| `0`                 | The normal attack, or nothing highlighted (a freshly opened menu) |
| `1`, `2`, ...       | `frontSkillList[1]`, `[2]`, ...                                   |
| `100`               | The Change (form change) button                                   |

Its neighbours are `selectedCharacterData` (the character whose menu is open), `selectedSkillIndex` and `focusedLastSkillIndex` (the previous
focus). The highlight does not wrap: Down past the last skill does nothing. Tab does not move it.

**Check where you are instead of counting.** The macro presses Down and reads `focusedSkillIndex` until it equals the target.

### The UI rows (a cross-check, not needed)

The menu holds a fixed set of six row objects (`UIBattleSkillMenu.scrollView.list`). Each row's `OniUIButton._isFocused` is set on the highlighted
row (no row on a freshly opened menu, and it stays set after the menu closes, so it does not say whether the menu is open). Row `r` is
`frontSkillList[r + 1]`. The rows are reused: opening another character rebinds each row's `entity` to that character's skills, and Tab rewrites
the name, so read them live. **Leftover rows:** a character with fewer skills than rows leaves the extra rows showing the previous character's
skills, and nothing marks them (`_focusableList`, `isLastIndex` and `enableAutoConfig` were tried). The macro does not need it, because it only
presses Down up to an index in `frontSkillList`.

Not found: any state-machine or `BattleWaitCommandState` field for the open menu or the highlight (`SelectMember`, `SwitchMember` and
`SelectSkill` take arguments and store nothing).

## Offsets reference

These were read from `cache/dump.cs` (Il2CppDumper v6.7.46) and confirmed live. No scanner uses them: see "Field offsets and game updates".
They are only here to show what each field is and where it sits. Another game version may differ.

| Object                           | Field                                                              | Offset                            |
| -------------------------------- | ------------------------------------------------------------------ | --------------------------------- |
| .NET `List<T>`                   | `_items` / `_size` / elements from                                 | `0x10` / `0x18` / `0x20`          |
| array                            | length / elements from                                             | `0x18` / `0x20`                   |
| managed string                   | length / UTF-16 characters                                         | `0x10` / `0x14`                   |
| `BattleModule`                   | `Instance` (static)                                                | `0x0`                             |
|                                  | `overDriveManager` / `characterDataManager` / `hudModule`          | `0x50` / `0x90` / `0xE0`          |
|                                  | `parent` (its `BattleState`)                                       | `0x10`                            |
| `BattleState`                    | `battleStateMachine` (a `SubStateModule`)                          | `0xA8`                            |
| `SubStateModule`                 | `instance` (the battle's `ArborFSM`)                               | `0x30`                            |
| `BattleCharacterDataManager`     | `frontPlayerList` / `subPlayerList`                                | `0x90` / `0x98`                   |
| `BattleCharacterData`            | `team` / `position` / `initialPosition`                            | `0x20` / `0x24` / `0x28`          |
| `BattlePlayerData`               | `domainCard` / `_isAnotherCardForm` (bool)                         | `0x1E8` / `0x1F0`                 |
|                                  | `frontSkillList` / `_normalSkill`                                  | `0x298` / `0x2A0`                 |
| `DomainCard`                     | `master` (`MasterCard`)                                            | `0x10`                            |
| `MasterCard`                     | `Label` (style) / `MasterCharacterLabel` / `AnotherCardFormLabel`  | `0x18` / `0x30` / `0x148`         |
| `BattleSkill`                    | `domainSkill`, then `DomainSkill.master` (`MasterSkill`)           | `0x10`, then `0x10`               |
| `MasterSkill`                    | `Id` (long) / `Label` / `Name`                                     | `0x10` / `0x18` / `0x20`          |
| `BattleOverDriveManager`         | `state` / `currentPoint` / `currentStockCount` / `activatedLevel`  | `0x10` / `0x2C` / `0x3C` / `0x50` |
|                                  | `isForbiddenPush` / `prohibitFromInvoking` (bools)                 | `0x20` / `0x21`                   |
| `BattleHudModule`                | `battleMemberHudModule`                                            | `0xE0`                            |
| `BattleMemberHudModule`          | `uiBattleSkillMenu`                                                | `0xC8`                            |
|                                  | `selectedCharacterData` / `selectedSkillIndex`                     | `0xD0` / `0xD8`                   |
|                                  | `focusedSkillIndex` / `focusedLastSkillIndex`                      | `0xDC` / `0xE0`                   |
| `UserBattleSetting` (`fbschema`) | `battleSpeed` / `autoMode` / `lastAutoMode`                        | `0x10` / `0x14` / `0x18`          |
| `UserDataTable`                  | `_battleSetting` (`UserData.instance` is its static)               | `0x1B0`                           |
| `ArborFSMInternal`               | `_States` (`List<State>`) / `_CurrentState`                        | `0xD0` / `0xE0`                   |
| `State`                          | `name` (managed string)                                            | `0x50`                            |
|                                  | `_Behaviours` (`List<Object>`)                                     | `0x40`                            |
| `UIBattleSkillMenu`              | `scrollView` (the row list, a `XIUIBattleSkillMenuSkillMenuList`)  | `0xE8`                            |
| row list                         | `list`, an array of rows (generic base, so `dump.cs` prints `0x0`) | `0x38`                            |
| skill menu row                   | `skillButton`, then `_button` (`OniUIButton`), then `_isFocused`   | `0x90`, `0x40`, `0x27`            |
|                                  | `entity`, then `skillName` (English)                               | `0x140`, `0xC8`                   |

## Identifying a state by its behaviour (checked, not needed)

If a game update ever renames the battle machine's states, a state can be recognised by the class of its first behaviour instead
(`State._Behaviours`, a `List<Object>`). `scan:behaviours` printed all 40 states of the battle machine:

- Unique, so usable: `コマンド選択` is `BattleWaitCommandState`, `オーバードライブ発動レベル選択` is `BattleOverDriveLevelSelectState`, `Result` is
  `BattleResultState`, `Lose` is `BattleLoseState`, `特殊コマンドの攻撃` is `BattleSpecialCommandAttackState`, `部隊チェンジ開始` is
  `BattleStartSquadChangeState`.
- Not unique: `終了[Win]`, `終了[Lose]`, `終了[Retry]` and one `New State` all use `StateExit`, so only the name says which kind of exit it
  was. Also `味方ターンの行動を事前演算` and `敵ターンの行動判定` share `BattleActionPoolState`.
- The second `New State` has no behaviours at all.

So it would work as a fallback for the turn-ready, overdrive-menu and Alt-skill states, but not for telling a retry from a loss. The
behaviour classes are code names, so an update could rename them just as it could rename the states. Nothing uses this today.
