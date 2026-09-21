# Heaven Burns Red - Combat Macros

This application is a macro framework built to execute combat strategies in *Heaven Burns Red* without requiring manual player input. It functions by reading custom turn actions from a simple CSV spreadsheet and translating them directly into automated in-game keystrokes.

## Credits

This project is a modified fork of the original repository created by [zyx419](https://github.com/zyx419/HeavenBurnsRed_script). All credits for the foundational macro setup and initial repository baseline belong to the original creator.

## How it Works

The software cycles through four phases to automate combat farming:

1. **Choosing a script (`main.py`):** Looks inside your `sheets/` folder for your CSV battle plans. If you only have one file, it skips the menu and launches it instantly. If you have multiple plans, it asks you to pick one from a list.
2. **Reading your macros (`EnterLevel`):** Reads your selected CSV file line-by-line to unpack your turn actions. It loads your instructions for character selection, vanguard/rearguard character position swapping, skill targets, overdrive usage, and when to lock in the turn.
3. **Checking the screen (`ComparePicUtil`):** Takes small screenshots of specific areas on your monitor and compares them against template images using OpenCV. It uses this visual check to wait until your turn menu loads or to detect when the stage is cleared.
4. **Pressing the keys (`ExecuteRoundProcess` & `ExecuteFinishProcess`):** Focuses the game window and presses your keyboard keys to play the turn out. It handles standard attacks, decimal-based skill navigation, Overdrive timing hooks (pre-turn and post-turn), and "Alt" shortcut skills. Once the match finishes, it spams clicks through the reward menus and uses Lifestones to start the next run automatically.

## Creating a Combat Macro

To write your own macros, check out the detailed [CSV Format Guide](./sheets/README.md). You will need to place your `.csv` files in the `sheets/` folder.

## Running This Application

### Prerequisites
* **Python 3.12** installed on your system.
* Run your terminal or IDE as an **Administrator**, otherwise Windows will fail to forward keyboard commands to the game window.

### Setup Steps
1. (Optional) Create and activate a Python virtual environment (`venv`).
2. Install the necessary project requirements:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the application controller:
   ```bash
   python main.py
   ```

## Disclaimers

- This software was created for educational purposes only. The developer is not responsible for any actions taken on your account, including bans or restrictions. **Use entirely at your own risk.**
- As I am not very comfortable with Python syntax, a lot of this code and documentation were generated with the assistance of AI.
