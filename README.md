# Heaven Burns Red - Combat Macros

This application is a macro framework built to execute combat strategies in _Heaven Burns Red_ without requiring manual player input. It functions by
reading custom turn actions from a simple CSV spreadsheet and translating them directly into automated in-game keystrokes.

## Credits

This project is a modified fork of the original repository created by [zyx419](https://github.com/zyx419/HeavenBurnsRed_script). All credits for the
foundational macro setup and initial repository baseline belong to the original creator.

## How it Works

The software cycles through four phases to automate combat farming:

1. **Choosing a script (`src/main.ts`):** Looks inside your `sheets/` folder for your CSV battle plans. If you only have one file, it skips the menu
   and launches it instantly. If you have multiple plans, it asks you to pick one from a list.
2. **Reading your macros (`src/sheets.ts`, `src/models/game-round.ts`):** Reads your selected CSV file and unpacks your turn actions: character
   selection, swapping, skill targets, overdrive usage, and when to lock in the turn.
3. **Checking the screen (`src/game/conditions.ts`):** Captures small regions of the game window and matches them against the template images in
   `src/assets/` using OpenCV.js. It uses this to wait until your turn menu loads.
4. **Pressing the keys (`src/routines/`):** Focuses the game window and sends keystrokes through the Windows `SendInput` API, the same way `pynput`
   did. It handles standard attacks, `X.Y` skill navigation, Overdrive timing (pre-turn and post-turn), and "Alt" shortcut skills. Reward handling,
   rematch and Life Stones (the old finish routine) have not been ported yet.

## Creating a Combat Macro

To write your own macros, check out the detailed [CSV Format Guide](./sheets/README.md). You will need to place your `.csv` files in the `sheets/`
folder.

## Running This Application

### Prerequisites

- **Deno 2** installed on your system (Windows x64).
- Run your terminal or IDE as an **Administrator**, otherwise Windows will fail to forward keyboard commands to the game window.

### Setup Steps

Dependencies are fetched automatically on first run. Start the application:

```bash
deno task start
```

## Disclaimers

- This software was created for educational purposes only. The developer is not responsible for any actions taken on your account, including bans or
  restrictions. **Use entirely at your own risk.**
- As I am not very comfortable with Python syntax, a lot of this code and documentation were generated with the assistance of AI.
