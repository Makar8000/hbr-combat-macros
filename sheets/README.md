# HBR Macros - CSV Format Guide

This document describes the structure and parameter specifications required to format your combat macro scripts (`.csv`) for the automation engine.

---

## File Requirements

- **Extension:** Must be saved as `.csv`.
- **Location:** Must be placed inside the `sheets/` folder.
- **Headers:** Column headers are **case-sensitive** and must follow the exact schema below.

---

## CSV Column Schema

```csv
round_number,overdrive_level,position,swap_flag,skill_swap_sequence,skill_target_position,execute
```

### Parameter Specifications

| Column Name                 | Allowed Formats / Values                                                                     | Operational Behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| :-------------------------- | :------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`round_number`**          | Numbers or Text strings (e.g., `1`, `Wave 2`, `Phase 1`)                                     | **Purely for console logging output.** It helps you track where the macro is at in your terminal. Text and integers are both fully supported.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **`overdrive_level`**       | Negative Integers (`-1`, `-2`, `-3`), Positive Integers (`1`, `2`, `3`), `ALT`, or _[Blank]_ | **Pre-turn / Post-turn routine:** <br>• **Negative values (`-1`, `-2`, `-3`)**: Activates Overdrive at the **start of the turn** before character actions. Opens the OD menu (`O`) and activates at the specified level.<br>• **Positive values (`1`, `2`, `3`)**: Activates Overdrive at the **end of the turn** shortly after `execute` sends `Enter`. Does nothing if `execute` is `FALSE`.<br>• `ALT`: Taps `Alt` then `Enter` to trigger a special skill shortcut (ex. Wakki Mecha Demonga) at the start of the turn.<br>• _[Blank]_: Skips overdrive activation.                                                  |
| **`position`**              | Integers `0` to `6`                                                                          | **Character Selection:**<br>• `0`: Skips character selection. If `execute` is `TRUE`, it taps `Enter` immediately to end your turn.<br>• `1` to `6`: Taps that matching key to highlight that specific character slot. Must be a number. A blank or invalid value stops the macro with an error before it starts.                                                                                                                                                                                                                                                                                                       |
| **`swap_flag`**             | `TRUE` or `FALSE`                                                                            | **Action Type:**<br>• `TRUE`: Prepares a position swap into the backup rearguard lineup.<br>• `FALSE`: Keeps the character active to prepare a standard combat skill.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **`skill_swap_sequence`**   | Integer, Decimal (`X.Y`), or _[Blank]_                                                       | **Dynamic targeting/menu navigation:**<br>• If `swap_flag` is `TRUE`: Taps this number key to choose who to swap in (any decimal part is ignored).<br>• If `swap_flag` is `FALSE`: Navigates the skill menu. A plain number `X` presses `Down` **X** times. An `X.Y` format presses `Down` **X** times, followed by `Tab` **Y** times (e.g., `3.1` presses Down 3 times and Tab 1 time). Afterwards it always presses `Enter` to confirm the skill, even if this is blank. **Note:** For memoria that have transformations (ex. Unison Karen), you will need to add an extra number to account for the "Change" option. |
| **`skill_target_position`** | Integers `1` to `6`, or _[Blank]_                                                            | **Friendly Target Assignment:** Taps this number key to target a support skill (buff/heal/shield) onto a specific team slot. Leave completely blank for enemy-targeted attacks. Ignored when `swap_flag` is `TRUE`.                                                                                                                                                                                                                                                                                                                                                                                                     |
| **`execute`**               | `TRUE` or `FALSE`                                                                            | **Turn End Queue:**<br>• `TRUE`: Sends a trailing `Enter` stroke to finalize selections and launch the combat round operations.<br>• `FALSE`: Holds the turn timeline phase open, letting you sequence multiple rows of distinct actions or character swaps in the exact same phase.                                                                                                                                                                                                                                                                                                                                    |

---

## Script Configuration Examples

### 1. Complex Same-Turn Queueing

The following script handles a multi-action phase on the same turn. It queues 2 position swaps, then 3 skills (the first one using the `ALT` shortcut), before locking in
turn calculation on the final line:

```csv
round_number,overdrive_level,position,swap_flag,skill_swap_sequence,skill_target_position,execute
Wave 1,,1,TRUE,4,,FALSE
Wave 1,,2,TRUE,5,,FALSE
Wave 1,ALT,3,FALSE,3.1,,FALSE
Wave 1,,1,FALSE,2,,FALSE
Wave 1,,3,FALSE,2,2,TRUE
```

### 2. Immediate Pre-Turn Overdrive Sequence

The following script triggers a **Level 3 Overdrive immediately at the start** of the turn (using `-3`), selects character 2, down-scrolls 1 skill
selection, targets friendly slot 1, and attacks:

```csv
round_number,overdrive_level,position,swap_flag,skill_swap_sequence,skill_target_position,execute
3,-3,2,FALSE,1,1,TRUE
```

### 3. Delayed Post-Turn Overdrive Sequence

The following script queues up character selection actions, confirms the skill phase, and **fires a Level 2 Overdrive at the end of the
turn** (using positive `2`) shortly after the combat sequence is launched:

```csv
round_number,overdrive_level,position,swap_flag,skill_swap_sequence,skill_target_position,execute
3,2,2,FALSE,1,1,TRUE
```
