import pynput.keyboard as keyboard
from pynput.keyboard import Key
from standard.utils import ComparePicUtil
import time

# Simulate input
keyboard_controller = keyboard.Controller()

def tap_key_with_delay(tap_key, delay=0.4):
    keyboard_controller.tap(tap_key)
    time.sleep(delay)

def trigger_overdrive_sequence(target_level):
    """Helper method to run the dynamic image-tracked overdrive commands"""
    if isinstance(target_level, int):
        # Convert negative integers to their positive absolute value for the keypress
        actual_keypress = abs(target_level)
        print(f"⚡ Activating Overdrive Level: {actual_keypress}")
        tap_key_with_delay('o')  # Press the 'O' key to open Overdrive menu
        
        # Dynamic check via image matching for menu loading state
        ComparePicUtil.wait_for_overdrive_ready()
        
        tap_key_with_delay(str(actual_keypress))  # Press 1, 2, or 3 to select level
        time.sleep(3.0)  # Extra buffer pause for the game activation animation

def start(game_round_entity):
    # Wait for turn UI initialization / ally's turn
    ComparePicUtil.wait_for_friend_round()

    print(f"▶️ {game_round_entity}")

    od = game_round_entity.overdrive_level

    # TRIGGER START OF TURN: Alt Skill combination (Alt -> Enter)
    if od == 'ALT':
        print("✨ Activating Alt Skill")
        tap_key_with_delay(Key.alt)
        tap_key_with_delay(Key.enter)
        time.sleep(5.0) # Extra animation buffer

    # TRIGGER START OF TURN OVERDRIVE: Handles Negative Overdrive settings (-1, -2, -3)
    if isinstance(od, int) and str(od).startswith('-'):
        trigger_overdrive_sequence(od)

    # If position = 0, do nothing and end the current turn directly
    if game_round_entity.position == 0:
        if game_round_entity.execute:
            # Action - End current line
            tap_key_with_delay(Key.enter)
            
            # TRIGGER END OF TURN (Position 0 scenario): Handles Positive Overdrive settings (1, 2, 3)
            if isinstance(od, int) and not str(od).startswith('-'):
                trigger_overdrive_sequence(od)
        return

    # Action - Select this character
    tap_key_with_delay(str(game_round_entity.position))

    # swap_flag = True: Swap character
    if game_round_entity.swap_flag:
        # Action - Swap position
        if game_round_entity.skill_swap_sequence is not None:
            tap_key_with_delay(str(int(game_round_entity.skill_swap_sequence)))

    # swap_flag = False: Cast skill
    else:
        if game_round_entity.skill_swap_sequence is not None:
            val_str = str(game_round_entity.skill_swap_sequence)
            
            if '.' in val_str:
                # Use standard string manipulation to avoid index bracket stripping bugs
                parts = val_str.split('.')
                down_count = int(parts[0])
                tab_count = int(parts[1])
                
                # First run primary Down movements
                for _ in range(down_count):
                    tap_key_with_delay(Key.down, 0.3)
                
                # Loop and execute Tab key sequences
                for _ in range(tab_count):
                    tap_key_with_delay(Key.tab)
            else:
                # Fallback standard execution for pure integers
                for _ in range(int(game_round_entity.skill_swap_sequence)):
                    tap_key_with_delay(Key.down, 0.3)

        # Action - Confirm skill
        tap_key_with_delay(Key.enter, 0.65)

        # Check if an ally character needs to be targeted
        if game_round_entity.skill_target_position is not None:
            if 1 <= game_round_entity.skill_target_position <= 6:
                # Action - Target character
                tap_key_with_delay(str(int(game_round_entity.skill_target_position)))

    # Check whether to end the current turn
    if game_round_entity.execute:
        # Action - End current turn
        # print(f"✅ Ending current turn")
        tap_key_with_delay(Key.enter)
        
        # TRIGGER END OF TURN: Handles Positive Overdrive settings (1, 2, 3)
        if isinstance(od, int) and not str(od).startswith('-'):
            time.sleep(2.5)
            trigger_overdrive_sequence(od)

class ExecuteRoundProcess:
    pass
