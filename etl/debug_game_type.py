"""
Debug the game_type filtering that might be excluding Brady/Mahomes
"""
import nfl_data_py as nfl
import pandas as pd

def debug_game_type_filtering():
    print("🔍 DEBUGGING GAME TYPE FILTERING")
    print("=" * 50)
    
    # Load recent years data
    years = [2020, 2021, 2022, 2023, 2024, 2025]
    rosters = nfl.import_seasonal_rosters(years=years)
    
    # Check Brady specifically (retired after 2022)
    print("\n1️⃣ Tom Brady game type analysis:")
    brady_records = rosters[rosters['player_name'].str.contains('Tom Brady', case=False, na=False)]
    
    if len(brady_records) > 0:
        print(f"   Total Brady records: {len(brady_records)}")
        
        # Group by game_type
        brady_by_game_type = brady_records.groupby(['season', 'game_type']).size().reset_index(name='count')
        print("   Brady records by season/game_type:")
        print(brady_by_game_type.to_string(index=False))
        
        # Check teams
        brady_teams = brady_records[['season', 'team', 'game_type']].drop_duplicates()
        print(f"\n   Brady teams by season:")
        print(brady_teams.to_string(index=False))
        
        # Show what gets filtered out
        brady_reg_post = brady_records[brady_records['game_type'].isin(['REG', 'POST'])]
        print(f"\n   Brady records after REG/POST filter: {len(brady_reg_post)} (was {len(brady_records)})")
        
    else:
        print("   ❌ No Brady records found")
    
    # Check Mahomes 
    print("\n2️⃣ Patrick Mahomes game type analysis:")
    mahomes_records = rosters[rosters['player_name'].str.contains('Patrick Mahomes', case=False, na=False)]
    
    if len(mahomes_records) > 0:
        print(f"   Total Mahomes records: {len(mahomes_records)}")
        
        # Group by game_type
        mahomes_by_game_type = mahomes_records.groupby(['season', 'game_type']).size().reset_index(name='count')
        print("   Mahomes records by season/game_type:")
        print(mahomes_by_game_type.to_string(index=False))
        
        # Check teams
        mahomes_teams = mahomes_records[['season', 'team', 'game_type']].drop_duplicates()
        print(f"\n   Mahomes teams by season:")
        print(mahomes_teams.to_string(index=False))
        
        # Show what gets filtered out
        mahomes_reg_post = mahomes_records[mahomes_records['game_type'].isin(['REG', 'POST'])]
        print(f"\n   Mahomes records after REG/POST filter: {len(mahomes_reg_post)} (was {len(mahomes_records)})")
        
    else:
        print("   ❌ No Mahomes records found")
    
    # Check overall game_type distribution
    print("\n3️⃣ Overall game_type distribution:")
    game_type_dist = rosters['game_type'].value_counts()
    print(game_type_dist)
    
    # Check if there are any null game_types
    null_game_types = rosters['game_type'].isna().sum()
    print(f"\n   Records with null game_type: {null_game_types}")
    
    # Test teammate connection building for Brady/Mahomes specifically
    print("\n4️⃣ Testing teammate connections:")
    
    # Brady's 2021 season (TB12 Super Bowl year)
    brady_2021 = brady_records[
        (brady_records['season'] == 2021) & 
        (brady_records['game_type'].isin(['REG', 'POST']))
    ]
    
    if len(brady_2021) > 0:
        print(f"   Brady 2021 REG/POST records: {len(brady_2021)}")
        brady_team = brady_2021['team'].iloc[0]
        brady_esb_id = brady_2021['esb_id'].iloc[0]
        
        # Find his teammates
        bucs_2021 = rosters[
            (rosters['season'] == 2021) & 
            (rosters['team'] == brady_team) &
            (rosters['game_type'].isin(['REG', 'POST']))
        ]
        
        print(f"   {brady_team} 2021 REG/POST roster size: {len(bucs_2021)}")
        print(f"   Brady's esb_id: {brady_esb_id}")
        
        # Check if Brady's esb_id is in the teammate roster
        brady_in_roster = bucs_2021['esb_id'].eq(brady_esb_id).any()
        print(f"   Brady in teammate roster: {brady_in_roster}")
        
        if not brady_in_roster:
            print("   ❌ PROBLEM: Brady not found in his own team roster!")
            print("   Brady record details:")
            print(brady_2021[['player_name', 'esb_id', 'team', 'season', 'game_type']].to_string(index=False))
            print("   Sample team roster:")
            print(bucs_2021[['player_name', 'esb_id', 'team', 'season', 'game_type']].head().to_string(index=False))
    
    # Mahomes 2023 season  
    mahomes_2023 = mahomes_records[
        (mahomes_records['season'] == 2023) & 
        (mahomes_records['game_type'].isin(['REG', 'POST']))
    ]
    
    if len(mahomes_2023) > 0:
        print(f"\n   Mahomes 2023 REG/POST records: {len(mahomes_2023)}")
        mahomes_team = mahomes_2023['team'].iloc[0]
        mahomes_esb_id = mahomes_2023['esb_id'].iloc[0]
        
        # Find his teammates
        chiefs_2023 = rosters[
            (rosters['season'] == 2023) & 
            (rosters['team'] == mahomes_team) &
            (rosters['game_type'].isin(['REG', 'POST']))
        ]
        
        print(f"   {mahomes_team} 2023 REG/POST roster size: {len(chiefs_2023)}")
        print(f"   Mahomes' esb_id: {mahomes_esb_id}")
        
        # Check if Mahomes' esb_id is in the teammate roster
        mahomes_in_roster = chiefs_2023['esb_id'].eq(mahomes_esb_id).any()
        print(f"   Mahomes in teammate roster: {mahomes_in_roster}")
        
        if not mahomes_in_roster:
            print("   ❌ PROBLEM: Mahomes not found in his own team roster!")

if __name__ == "__main__":
    debug_game_type_filtering()
