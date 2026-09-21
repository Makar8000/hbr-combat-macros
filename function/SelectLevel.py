import os
import pandas as pd
import time
from function import EnterLevel
# from function import FinishLevel
# from standard.utils import ComparePicUtil

LOOP_COUNT = 1

def start():
    # Folder path containing your game routine CSV files
    folder_path = "sheets"
    
    # Scan the folder and list all files ending with .csv
    if not os.path.exists(folder_path):
        print(f"❌ Error: Folder '{folder_path}' does not exist.")
        return
        
    csv_files = [f for f in os.listdir(folder_path) if f.endswith('.csv')]

    if not csv_files:
        print("❌ Error: No CSV files found in the 'sheets' folder.")
        return

    # Determine selection choice dynamically based on file count
    if len(csv_files) == 1:
        choice = 1
        print(f"ℹ️ Auto-selecting: {csv_files[0]}")
    else:
        # Display selection menu only if multiple files exist
        print("⚠️ Please select a CSV script to run:")
        for index, file_name in enumerate(csv_files, 1):
            print(f"{index}. {file_name}")
            
        try:
            choice = int(input("\nPlease enter the number: "))
        except ValueError:
            print("❌ Error: Invalid input. Please enter a valid number.")
            return

    # Check if the selection index is valid
    if 1 <= choice <= len(csv_files):
        selected_file = csv_files[choice - 1]
        file_path = os.path.join(folder_path, selected_file)
        
        # Read the content of the selected CSV file
        df = pd.read_csv(file_path)
        print(f"\nThe script you selected is: {selected_file}")
        # print("The content of this script is as follows:")
        # print(df)
        
        # Macro execution loop (Repeating the battle LOOP_COUNT times)
        for i in range(LOOP_COUNT):
            print(f"\n--- Starting Macro Loop {i + 1}/{LOOP_COUNT} ---")

            # Record the exact start time of the loop
            loop_start_time = time.time()

            # Enter the current level using the DataFrame actions
            EnterLevel.start(df)

            # Wait for the level to finish via CV image matching
            # ComparePicUtil.wait_for_level_finish()

            # Record the end time and calculate the duration
            loop_end_time = time.time()
            elapsed_seconds = loop_end_time - loop_start_time

            # Format into minutes and seconds
            minutes = int(elapsed_seconds // 60)
            seconds = int(elapsed_seconds % 60)
            print(f"⏱️ Macro Loop {i + 1} finished in: {minutes}m {seconds}s")

            # Handle post-match rewards, stoning, and rematch queueing
            # FinishLevel.start()
    else:
        print("❌ The number entered is invalid. Please enter a valid number.")


class SelectLevel:
    pass
