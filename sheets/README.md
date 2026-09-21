# Heaven Burns Red - Automation CSV Format Guide

This document describes the structure and parameter specifications required to format your combat macro scripts (`.csv`) for the automation engine.

---

## File Requirements
* **Extension:** Must be saved as `.csv`.
* **Location:** Must be placed inside the `sheets/` folder.
* **Headers:** Column headers are **case-sensitive** and must follow the exact schema below.

---

## CSV Column Schema

```csv
round_number,overdrive_level,position,swap_flag,skill_swap_sequence,skill_target_position,execute
```

### Parameter Specifications

| Column Name | Allowed Formats / Values | Operational Behavior |
| :--- | :--- | :--- |
| **`round_number`** | Numbers or Text strings (e.g., `1`, `Wave 2`, `Phase 1`) | **Purely for console logging output.** It helps you track where the macro is at in your terminal. Text and integers are both fully supported. |
| **`overdrive_level`** | Negative Integers (`-1`, `-2`, `-3`), Positive Integers (`1`, `2`, `3`), `ALT`, or *[Blank]* | **Pre-turn / Post-turn routine:** <br>• **Negative values (`-1`, `-2`, `-3`)**: Activates Overdrive at the **start of the turn** before character actions. Opens menu (`O`) and uses the absolute level key.<br>• **Positive values (`1`, `2`, `3`)**: Activates Overdrive at the **end of the turn** immediately after `execute` sends `Key.enter`.<br>• `ALT`: Triggers any special skill shortcut (ex. Wakki Mecha Demonga) at the start of the turn.<br>• *[Blank]*: Bypasses overdrive sequences entirely. |
| **`position`** | Integers `0` to `6` | **Character Selection:**<br>• `0`: Skips character selection. If `execute` is `TRUE`, it taps `Enter` immediately.<br>• `1` to `6`: Taps that matching key to highlight that specific character slot. |
| **`swap_flag`** | `TRUE` or `FALSE` | **Action Type:**<br>• `TRUE`: Prepares a position swap into the backup rearguard lineup.<br>• `FALSE`: Keeps the character active to prepare an standard combat skill. |
| **`skill_swap_sequence`** | Integer, Decimal (`X.Y`), or *[Blank]* | **Dynamic targeting/menu navigation:**<br>• If `swap_flag` is `TRUE`: Taps this integer number key to choose who to swap in.<br>• If `swap_flag` is `FALSE`: Supports **Decimal Nav paths** for skill types. An `X.Y` format tells the engine to press `Key.down` **X** times, followed by pressing `Key.tab` **Y** times (e.g., `3.1` presses Down 3 times and Tab 1 time). **Note:** For memoria that have transformations (ex. Unison Karen), you will need to add an extra number to account for the "Change" option. |
| **`skill_target_position`**| Integers `1` to `6`, or *[Blank]* | **Friendly Target Assignment:** Taps this number key to target a support skill (buff/heal/shield) onto a specific team slot. Leave completely blank for enemy-targeted attacks. |
| **`execute`** | `TRUE` or `FALSE` | **Turn End Queue:**<br>• `TRUE`: Sends a trailing `Key.enter` stroke to finalize selections and launch the combat round operations.<br>• `FALSE`: Holds the turn timeline phase open, letting you sequence multiple rows of distinct actions or character swaps in the exact same phase. |

---

## Script Configuration Examples

### 1. Complex Same-Turn Queueing
The following script handles a multi-action phase on the same turn. It groups 3 distinct position swaps and an alternate skill check before locking in turn calculation on the final line:

```csv
round_number,overdrive_level,position,swap_flag,skill_swap_sequence,skill_target_position,execute
Wave 1,,1,TRUE,4,,FALSE
Wave 1,,2,TRUE,5,,FALSE
Wave 1,ALT,3,FALSE,3.1,,FALSE
Wave 1,,1,FALSE,2,,FALSE
Wave 1,,3,FALSE,2,2,TRUE
```

### 2. Immediate Pre-Turn Overdrive Sequence
The following script triggers a **Level 3 Overdrive immediately at the start** of the turn (using `-3`), selects character 2, down-scrolls 1 skill selection, targets friendly slot 1, and attacks:

```csv
round_number,overdrive_level,position,swap_flag,skill_swap_sequence,skill_target_position,execute
3,-3,2,FALSE,1,1,TRUE
```

### 3. Delayed Post-Turn Overdrive Sequence
The following script queues up character selection actions, confirms the skill phase, and **instantly fires a Level 2 Overdrive at the end of the turn** (using positive `2`) right as the combat sequence is launched:

```csv
round_number,overdrive_level,position,swap_flag,skill_swap_sequence,skill_target_position,execute
3,2,2,FALSE,1,1,TRUE
```
