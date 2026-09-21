from standard.entity.GameRoundEntity import GameRoundEntity
from function import ExecuteRoundProcess
import pygetwindow as gw

def start(df):
    # Get window
    game_window = gw.getWindowsWithTitle('HeavenBurnsRed')[0]

    # Activate and bring the window to the foreground
    game_window.activate()

    # Create an empty list to store GameRound objects
    game_rounds = []

    # Iterate through each row of data and create the corresponding GameRound object
    for _, row in df.iterrows():
        # Get overdrive level safely if it exists in the CSV structure
        od_level = row.get('overdrive_level', None)
        
        # Create GameRound object
        game_round = GameRoundEntity(
            round_number=row['round_number'],
            position=row['position'],
            swap_flag=row['swap_flag'],
            skill_swap_sequence=row['skill_swap_sequence'],
            skill_target_position=row['skill_target_position'],
            execute=row['execute'],
            overdrive_level=od_level
        )
        # Add the object to the list
        game_rounds.append(game_round)

    # Execute the game script by iterating through the game_rounds list
    for game_round in game_rounds:
        # Erroneous code previously called ExecuteRoundProcess.start on an implicitly unresolved class name
        ExecuteRoundProcess.start(game_round)

class EnterLevel:
    pass
