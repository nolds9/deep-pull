"""
Debug the canonical ID creation process for Brady/Mahomes
"""
import nfl_data_py as nfl
import pandas as pd

def debug_canonical_id_creation():
    print("🔍 DEBUGGING CANONICAL ID CREATION")
    print("=" * 50)
    
    # Replicate the ETL process for just Brady/Mahomes
    years = [2020, 2021, 2022, 2023, 2024]
    
    print("1️⃣ Loading roster data...")
    rosters = nfl.import_seasonal_rosters(years=years)
    
    print("2️⃣ Loading players master...")
    players_master = nfl.import_players()
    
    print("3️⃣ Loading draft data...")
    draft_picks = nfl.import_draft_picks(years=years)
    
    # Filter to just our star players
    star_rosters = rosters[
        rosters['player_name'].str.contains('Tom Brady|Patrick Mahomes', case=False, na=False)
    ].copy()
    
    print(f"\n4️⃣ Star player roster records: {len(star_rosters)}")
    print("Raw star roster sample:")
    print(star_rosters[['player_name', 'esb_id', 'gsis_id', 'player_id', 'team', 'season']].drop_duplicates().to_string(index=False))
    
    # Step 1: Merge with players_master
    print(f"\n5️⃣ Merging with players_master...")
    
    # Check what Brady/Mahomes look like in master data
    print("Brady in players_master:")
    brady_master = players_master[players_master['display_name'].str.contains('Tom Brady', case=False, na=False)]
    if len(brady_master) > 0:
        print(brady_master[['display_name', 'esb_id', 'gsis_id']].to_string(index=False))
    else:
        print("   ❌ Tom Brady NOT found in players_master!")
        
        # Check if there's a Brady with the same esb_id
        brady_esb_id = star_rosters[star_rosters['player_name'].str.contains('Tom Brady', case=False)]['esb_id'].iloc[0]
        brady_by_esb = players_master[players_master['esb_id'] == brady_esb_id]
        if len(brady_by_esb) > 0:
            print(f"   Found player with Brady's esb_id ({brady_esb_id}):")
            print(brady_by_esb[['display_name', 'esb_id', 'gsis_id']].to_string(index=False))
        else:
            print(f"   ❌ No player found with Brady's esb_id ({brady_esb_id})")
    
    print("\nMahomes in players_master:")
    mahomes_master = players_master[players_master['display_name'].str.contains('Patrick Mahomes', case=False, na=False)]
    if len(mahomes_master) > 0:
        print(mahomes_master[['display_name', 'esb_id', 'gsis_id']].to_string(index=False))
    else:
        print("   ❌ Patrick Mahomes NOT found in players_master!")
    
    # Do the actual merge
    players_master_clean = players_master.drop_duplicates(subset=['esb_id'], keep='first')
    master_to_merge = players_master_clean[['esb_id', 'display_name', 'college_name', 'position', 'gsis_id']].rename(columns={
        'position': 'position_master',
        'college_name': 'college_master',
        'display_name': 'display_name_master'
    })
    
    merged = star_rosters.merge(master_to_merge, on='esb_id', how='left')
    
    print(f"\n6️⃣ After merge with players_master:")
    print(merged[['player_name', 'display_name_master', 'esb_id', 'gsis_id']].drop_duplicates().to_string(index=False))
    
    # Coalesce data
    merged['player_name'] = merged['display_name_master'].fillna(merged['player_name'])
    merged['college'] = merged['college_master'].fillna(merged['college'])
    merged['position'] = merged['position_master'].fillna(merged['position'])
    
    # Drop redundant columns
    merged = merged.drop(columns=['display_name_master', 'college_master', 'position_master'], errors='ignore')
    
    # Step 2: Add draft info
    print(f"\n7️⃣ Adding draft info...")
    draft_info = draft_picks[['gsis_id', 'season']].copy()
    draft_info = draft_info.rename(columns={'season': 'draft_year'})
    
    merged_with_draft = merged.merge(draft_info, on='gsis_id', how='left')
    merged_with_draft['draft_year'] = merged_with_draft['draft_year'].fillna(0).astype(int)
    
    print("After adding draft info:")
    print(merged_with_draft[['player_name', 'esb_id', 'gsis_id', 'draft_year']].drop_duplicates().to_string(index=False))
    
    # Step 3: Create canonical ID (THE CRITICAL STEP)
    print(f"\n8️⃣ Creating canonical ID...")
    
    print("Before canonical ID creation:")
    for _, row in merged_with_draft[['player_name', 'esb_id', 'gsis_id', 'player_id']].drop_duplicates().iterrows():
        print(f"   {row['player_name']}: esb_id={row['esb_id']}, gsis_id={row['gsis_id']}, player_id={row['player_id']}")
    
    # Create canonical ID (exact same logic as ETL)
    merged_with_draft['id'] = merged_with_draft['esb_id'].fillna(merged_with_draft['gsis_id'])
    missing_id_count = merged_with_draft['id'].isna().sum()
    if missing_id_count > 0:
        print(f"   Filling {missing_id_count} missing IDs with player_id")
        merged_with_draft['id'].fillna(merged_with_draft['player_id'], inplace=True)
    
    print("After canonical ID creation:")
    final_ids = merged_with_draft[['player_name', 'id', 'esb_id', 'gsis_id', 'player_id']].drop_duplicates()
    print(final_ids.to_string(index=False))
    
    # Step 4: Test connection building with these IDs
    print(f"\n9️⃣ Testing connection building...")
    
    # Filter to REG/POST games only (like the ETL does)
    connection_data = merged_with_draft[merged_with_draft['game_type'].isin(['REG', 'POST'])].copy()
    
    print(f"Records after REG/POST filter: {len(connection_data)}")
    
    if len(connection_data) > 0:
        print("Players and their canonical IDs for connection building:")
        connection_ids = connection_data[['player_name', 'id', 'team', 'season']].drop_duplicates()
        print(connection_ids.to_string(index=False))
        
        # Check if IDs are null
        null_ids = connection_data['id'].isna().sum()
        print(f"\nRecords with null canonical ID: {null_ids}")
        
        if null_ids > 0:
            print("Records with null IDs:")
            null_records = connection_data[connection_data['id'].isna()]
            print(null_records[['player_name', 'esb_id', 'gsis_id', 'player_id']].to_string(index=False))
    else:
        print("❌ No records left after REG/POST filter!")

if __name__ == "__main__":
    debug_canonical_id_creation()
