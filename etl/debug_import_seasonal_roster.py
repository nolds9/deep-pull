"""
Debug why seasonal rosters seem incomplete
"""
import nfl_data_py as nfl
import pandas as pd

def debug_seasonal_data_quality():
    print("🔍 DEBUGGING SEASONAL ROSTER DATA QUALITY")
    print("=" * 50)
    
    # Get both datasets for comparison
    seasonal_2023 = nfl.import_seasonal_rosters([2023])
    weekly_2023 = nfl.import_weekly_rosters([2023])
    
    print("1️⃣ Overall comparison:")
    print(f"   Seasonal records: {len(seasonal_2023):,}")
    print(f"   Weekly records: {len(weekly_2023):,}")
    
    # Check KC specifically
    kc_seasonal = seasonal_2023[seasonal_2023['team'] == 'KC']
    kc_weekly = weekly_2023[weekly_2023['team'] == 'KC']
    
    print(f"\n2️⃣ Kansas City comparison:")
    print(f"   KC seasonal records: {len(kc_seasonal)}")
    print(f"   KC weekly records: {len(kc_weekly)}")
    
    # Get unique KC players from each dataset
    kc_seasonal_players = set(kc_seasonal['player_name'].unique())
    kc_weekly_players = set(kc_weekly['player_name'].unique())
    
    print(f"   KC unique players (seasonal): {len(kc_seasonal_players)}")
    print(f"   KC unique players (weekly): {len(kc_weekly_players)}")
    
    # Check what's missing
    missing_from_seasonal = kc_weekly_players - kc_seasonal_players
    missing_from_weekly = kc_seasonal_players - kc_weekly_players
    
    print(f"   Players in weekly but NOT seasonal: {len(missing_from_seasonal)}")
    print(f"   Players in seasonal but NOT weekly: {len(missing_from_weekly)}")
    
    # Check if Mahomes is in the KC seasonal data at all
    mahomes_in_kc_seasonal = 'Patrick Mahomes' in kc_seasonal_players
    print(f"\n   Mahomes in KC seasonal roster: {mahomes_in_kc_seasonal}")
    
    if not mahomes_in_kc_seasonal and len(missing_from_seasonal) > 0:
        print(f"   Some missing players: {list(missing_from_seasonal)[:10]}")
        if 'Patrick Mahomes' in missing_from_seasonal:
            print("   ❌ PROBLEM: Mahomes missing from KC seasonal roster!")
    
    # Check game_type distribution in seasonal data
    print(f"\n3️⃣ Seasonal data game_type analysis:")
    seasonal_game_types = seasonal_2023['game_type'].value_counts()
    print(seasonal_game_types)
    
    # Are there any REG game_type records in seasonal data?
    seasonal_reg = seasonal_2023[seasonal_2023['game_type'] == 'REG']
    print(f"\n   REG records in seasonal: {len(seasonal_reg)}")
    
    if len(seasonal_reg) > 0:
        # Check if any KC players are in REG records
        kc_seasonal_reg = seasonal_reg[seasonal_reg['team'] == 'KC']
        print(f"   KC REG records in seasonal: {len(kc_seasonal_reg)}")
        
        if len(kc_seasonal_reg) > 0:
            kc_reg_players = kc_seasonal_reg['player_name'].unique()
            print(f"   KC players in seasonal REG: {len(kc_reg_players)}")
            print(f"   Sample KC REG players: {kc_reg_players[:5].tolist()}")
            
            # Is Mahomes in the REG records?
            mahomes_in_reg = 'Patrick Mahomes' in kc_reg_players
            print(f"   Mahomes in KC seasonal REG: {mahomes_in_reg}")
    
    # Check what week numbers appear in seasonal data
    print(f"\n4️⃣ Week analysis in seasonal:")
    seasonal_weeks = seasonal_2023['week'].value_counts().sort_index()
    print(f"   Weeks in seasonal: {seasonal_weeks.index.tolist()}")
    print(f"   Week distribution: {seasonal_weeks.to_dict()}")
    
    # The key question: Is seasonal data ONLY playoff teams?
    print(f"\n5️⃣ Team analysis:")
    seasonal_teams = seasonal_2023['team'].unique()
    weekly_teams = weekly_2023['team'].unique()
    
    print(f"   Teams in seasonal: {len(seasonal_teams)} - {sorted(seasonal_teams)}")
    print(f"   Teams in weekly: {len(weekly_teams)} - {sorted(weekly_teams)}")
    
    missing_teams = set(weekly_teams) - set(seasonal_teams)
    if missing_teams:
        print(f"   ❌ Teams missing from seasonal: {missing_teams}")
    
    # Check a non-playoff team
    non_playoff_teams = ['CHI', 'CAR', 'ARI']  # These probably didn't make playoffs
    for team in non_playoff_teams:
        if team in seasonal_teams:
            team_seasonal = seasonal_2023[seasonal_2023['team'] == team]
            team_weekly = weekly_2023[weekly_2023['team'] == team]
            print(f"\n   {team} seasonal: {len(team_seasonal)} records")
            print(f"   {team} weekly: {len(team_weekly)} records")
            
            if len(team_seasonal) > 0:
                team_game_types = team_seasonal['game_type'].value_counts()
                print(f"   {team} game types: {team_game_types.to_dict()}")

def suggest_hybrid_approach():
    print(f"\n6️⃣ HYBRID APPROACH SUGGESTION:")
    print("=" * 40)
    
    print("Given the data quality issues, consider:")
    print("1. Use weekly_rosters for complete player coverage")
    print("2. Filter to regular season + playoffs (REG, WC, DIV, CON, SB)")
    print("3. Deduplicate players per team per season for connections")
    print("4. This gives you 'seasonal-like' data but complete")
    
    print("\nExample deduplication:")
    print("```python")
    print("# Get unique player-team combinations per season")
    print("deduplicated_rosters = weekly_rosters.groupby(['season', 'team', 'player_name']).first().reset_index()")
    print("```")

if __name__ == "__main__":
    debug_seasonal_data_quality()
    suggest_hybrid_approach()
