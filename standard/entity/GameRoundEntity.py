import numpy as np

class GameRoundEntity:
    def __init__(self, round_number, position, swap_flag, skill_swap_sequence, skill_target_position, execute, overdrive_level=None):
        # Allow both text strings and integers for logging
        self.round_number = str(round_number).strip()  # Turn number
        self.position = int(position) # Character positioning index
        
        # Safely evaluate boolean parameters from CSV text strings
        if isinstance(swap_flag, str):
            self.swap_flag = swap_flag.strip().upper() == 'TRUE'
        else:
            self.swap_flag = bool(swap_flag)
            
        if isinstance(execute, str):
            self.execute = execute.strip().upper() == 'TRUE'
        else:
            self.execute = bool(execute)

        # Handle skill_swap_sequence as a float to support decimal actions like 4.1 or 3.4
        self.skill_swap_sequence = self._parse_sequence(skill_swap_sequence)
        self.skill_target_position = self._clean_numeric(skill_target_position)
        
        # Overdrive level can now be negative (-3 to -1), positive (1 to 3), or the string 'ALT'
        self.overdrive_level = self._clean_overdrive(overdrive_level)

    def _parse_sequence(self, value):
        """Allows floating point numbers or integers for skill_swap_sequence"""
        if value is None or (isinstance(value, float) and np.isnan(value)) or str(value).strip() == '':
            return None
        try:
            val_str = str(value).strip()
            if '.' in val_str:
                return float(val_str)
            return int(float(val_str))
        except (ValueError, TypeError):
            return None

    def _clean_numeric(self, value):
        """Helper function to clean up mixed data types or NaN fields coming from CSV files"""
        if value is None or (isinstance(value, float) and np.isnan(value)) or str(value).strip() == '':
            return None
        try:
            return int(float(value))
        except (ValueError, TypeError):
            return None

    def _clean_overdrive(self, value):
        """Validates overdrive to allow negative/positive integers or the string 'ALT'"""
        if value is None or (isinstance(value, float) and np.isnan(value)) or str(value).strip() == '':
            return None
        
        val_str = str(value).strip().upper()
        if val_str == 'ALT':
            return 'ALT'
            
        try:
            val_int = int(float(value))
            # Support integers from -3 to 3 (excluding 0)
            if -3 <= val_int <= 3 and val_int != 0:
                return val_int
        except (ValueError, TypeError):
            pass
        return None

    def __repr__(self):
        # Format the parameters cleanly into readable status trackers
        od_display = f"OD:{self.overdrive_level}" if self.overdrive_level else "OD:None"
        pos_display = "Pos:Skip" if self.position == 0 else f"Pos:{self.position}"
        action_display = "SWAP" if self.swap_flag else "SKILL"
        seq_display = f"Seq:{self.skill_swap_sequence}" if self.skill_swap_sequence is not None else "Seq:None"
        tgt_display = f"Target:{self.skill_target_position}" if self.skill_target_position else ""
        exec_display = "EXECUTE" if self.execute else ""

        return f"[{self.round_number:<8}]: {od_display:<8} │ {pos_display:<8} │ {action_display:<5} │ {seq_display:<8} │ {tgt_display:<8} │ {exec_display:<7}"
