from function import ExecuteFinishProcess
import time


def start():
    # # Get game window
    # game_window = gw.getWindowsWithTitle('HeavenBurnsRed')[0]
    # # Activate and bring the window to the foreground
    # game_window.activate()

    # Execute the game script
    ExecuteFinishProcess.start()

    # Wait for loading time
    time.sleep(15)

class FinishLevel:
    pass
