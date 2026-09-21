import time
import cv2
from standard.utils import PrintScreenUtil

# Pre-load the target images into RAM memory exactly once when the module imports
START_BUTTON_IMG = cv2.imread("static/startActionButton.png", cv2.IMREAD_COLOR)
BATTLE_RESULT_IMG = cv2.imread("static/battleResultIcon.png", cv2.IMREAD_COLOR)
OVERDRIVE_READY_IMG = cv2.imread("static/overdriveCancel.png", cv2.IMREAD_COLOR)

def wait_for_friend_round():
    flag = True
    while flag:
        # Pass the pre-loaded image variable directly
        if not PrintScreenUtil.find_target_on_screen(START_BUTTON_IMG, 2196, 1021, 310, 308):
            time.sleep(1)
        else:
            flag = False

def wait_for_level_finish():
    flag = True
    while flag:
        if not PrintScreenUtil.find_target_on_screen(BATTLE_RESULT_IMG, 105, 43, 475, 61):
            time.sleep(1)
        else:
            flag = False

def wait_for_overdrive_ready():
    flag = True
    while flag:
        if not PrintScreenUtil.find_target_on_screen(OVERDRIVE_READY_IMG, 996, 1187, 568, 160):
            time.sleep(1)
        else:
            flag = False

class ComparePicUtil:
    pass
