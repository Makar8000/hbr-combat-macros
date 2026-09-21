import time
import cv2
import numpy as np
import pygetwindow as gw
import pyautogui

def get_game_screenshot(dx, dy, dWidth, dHeight):
    """ Capture a screenshot of the game window """
    game_window = gw.getWindowsWithTitle('HeavenBurnsRed')
    if not game_window:
        print("❌ Game window not found")
        return None

    try:
        game_window[0].activate()  # Use index 0 to target the window handle directly
    except Exception:
        # Ignore pygetwindow focus issues and keep executing
        pass

    x, y, width, height = game_window[0].left + dx, game_window[0].top + dy, dWidth, dHeight

    time.sleep(1)

    screenshot = pyautogui.screenshot(region=(x, y, width, height))
    screenshot = np.array(screenshot) # Convert to OpenCV format
    screenshot = cv2.cvtColor(screenshot, cv2.COLOR_RGB2BGR) # Convert to BGR format

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

    # Check if the template has an alpha channel (4 channels) safely
    if len(target_img.shape) == 3 and target_img.shape[2] == 4:
        # Split channels: BGR color layers and the Alpha transparency mask layer
        template_color = cv2.cvtColor(target_img, cv2.COLOR_BGRA2BGR)
        mask = target_img[:, :, 3]
        
        # Match using the transparency mask layout
        result = cv2.matchTemplate(screenshot, template_color, cv2.TM_CCOEFF_NORMED, mask=mask)
    else:
        # Fallback regular match if the image has no alpha layer
        result = cv2.matchTemplate(screenshot, target_img, cv2.TM_CCOEFF_NORMED)

    min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)

    if max_val >= 0.8:
        target_x, target_y = max_loc
        # print(f"✅ Target image found at position: ({target_x}, {target_y})")
        return True
    else:
        # print("⏳ Polling for target image...")
        return False
