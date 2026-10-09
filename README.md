# Heaven Burns Red - Combat Macros

This application is a macro framework built to execute combat strategies in _Heaven Burns Red_ without requiring manual player input. It functions by reading custom turn actions from a simple CSV spreadsheet and translating them directly into automated in-game keystrokes.

## Credits

This project is a rewrite of the original repository created by [zyx419](https://github.com/zyx419/HeavenBurnsRed_script). All credits for the foundational macro setup and initial repository baseline belong to the original creator.

## How it Works

The software cycles through four phases to automate combat farming:

1. **Choosing a script (`src/main.ts`):** Looks inside your `sheets/` folder for your CSV battle plans. If you only have one file, it skips the menu and launches it instantly. If you have multiple plans, it asks you to pick one with the arrow keys and Enter.
2. **Reading your macros (`src/sheets.ts`, `src/models/game-round.ts`):** Reads your selected CSV file and unpacks your turn actions: character selection, swapping, skill targets, overdrive usage, and when to lock in the turn.
3. **Checking the screen (`src/game/conditions.ts`):** Captures small regions of the game window and matches them against the template images in `src/assets/` using OpenCV.js. It uses this to wait until your turn menu loads.
4. **Pressing the keys (`src/routines/`):** Focuses the game window and sends keystrokes through the Windows `SendInput` API. It handles standard attacks, skill navigation, overdrive timing (pre-turn and post-turn), and "Alt" shortcut skills.

## Creating a Combat Macro

To write your own macros, check out the detailed [CSV Format Guide](./sheets/README.md). You will need to place your `.csv` files in the `sheets/` folder.

## Running This Application

### Prerequisites

- Windows-only (for now).
- You must run it as an **Administrator**. The keyboard inputs will not register otherwise.
- The `sheets/` folder must exist next to the `.exe` and contain at least one `.csv` file.
- Currently only supports games that run as fullscreen at 2560x1440 resolution. I plan to fix this to support any 16:9 ratio in the future.

### Using the Release

1. Download the latest `hbr-combat-macros.zip` from the [Releases](../../releases) page and extract it.
2. Add or edit your `.csv` files in the `sheets/` folder next to the exe.
3. Run `hbr-combat-macros.exe` as Administrator.

### Running From Source

Install [Deno](https://deno.com), then run the following from the repository root in an Administrator terminal:

```bash
deno task start
```

Dependencies are fetched automatically on first run. To build the exe yourself, use `deno task compile`.

## Disclaimer

This software was created for educational purposes only. The developer is not responsible for any actions taken on your account, including bans or restrictions.

**Use entirely at your own risk.**
