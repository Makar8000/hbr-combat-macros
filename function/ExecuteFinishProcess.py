import pygetwindow as gw
import pynput.mouse as mouse
import pynput.keyboard as keyboard
from pynput.mouse import Button
from pynput.keyboard import Key
import time


# Simulate input
mouse_controller = mouse.Controller()
keyboard_controller = keyboard.Controller()


def tap_key_with_delay(tap_key, delay=0.5):
    keyboard_controller.tap(tap_key)
    time.sleep(delay)


def start():
    # TODO: update to support latest client version
    print(f"⏹️ Running ExecuteFinishProcess...")

    game_window = gw.getWindowsWithTitle('HeavenBurnsRed')[0]

    x, y = game_window.left, game_window.top  # Top-left corner coordinates
    width, height = game_window.width, game_window.height  # Window size

    center_x = x + width // 2
    center_y = y + height // 2

    mouse_controller.position = (center_x, center_y)

    # Action - Skip level-up/upgrade screens
    for _ in range(10):
        mouse_controller.click(Button.left, 1)
        time.sleep(0.3)

    time.sleep(1)

    # Action - Rematch / Fight again
    tap_key_with_delay(Key.enter)

    time.sleep(1)

    # Action - Add Life Stones (Stamina replenishment)
    for _ in range(4):
        tap_key_with_delay(Key.right)
        time.sleep(0.2)

    # Action - Confirm
    tap_key_with_delay(Key.enter)

    time.sleep(1)

    # Consume reserve Life Stones
    for _ in range(2):
        tap_key_with_delay(Key.right)
        time.sleep(1)

    # Action - Confirm
    tap_key_with_delay(Key.enter)

    time.sleep(1)

    # Action - Confirm
    tap_key_with_delay(Key.enter)

    time.sleep(1)

    # Action - Confirm
    tap_key_with_delay(Key.enter)

class ExecuteFinishProcess:
    # game_round_entity = GameRoundEntity.GameRoundEntity(2, 2, True, 4, 1, False, 0.5)
    # execute_round_process(game_round_entity)
    pass
