import time
import cv2
import numpy as np
import pygetwindow as gw
import pyautogui

def get_game_screenshot(dx, dy, dWidth, dHeight):
    """ Capture a screenshot of the game window """
    game_window = gw.getWindowsWithTitle('HeavenBurnsRed')[0]
    if not game_window:
        print("❌ Game window not found")
        return None

    game_window.activate()  # Focus the window
    x, y, width, height = game_window.left + dx, game_window.top + dy, dWidth, dHeight

    time.sleep(1)

    # Capture screenshot using pyautogui
    screenshot = pyautogui.screenshot(region=(x, y, width, height))
    screenshot = np.array(screenshot)  # Convert to OpenCV format
    screenshot = cv2.cvtColor(screenshot, cv2.COLOR_RGB2BGR)  # Convert to BGR format

    # Save screenshot
    # cv2.imwrite("pic.png", screenshot)

    return screenshot

def find_target_on_screen(target_img, dx, dy, d_width, d_height):
    """ Find a pre-loaded target template image within the game window screenshot """
    screenshot = get_game_screenshot(dx, dy, d_width, d_height)
    if screenshot is None:
        return False

    # Check preloaded target_img
    if target_img is None:
        print("❌ Loaded target image data is empty")
        return False

    # Perform template matching using OpenCV
    result = cv2.matchTemplate(screenshot, target_img, cv2.TM_CCOEFF_NORMED)
    min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)

    if max_val >= 0.8:
        target_x, target_y = max_loc
        # print(f"✅ Target image found at position: ({target_x}, {target_y})")
        return True
    else:
        # print("⏳ Polling for target image...")
        return False
