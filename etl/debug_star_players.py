"""
Debug why star players like Brady/Mahomes have 0 connections
"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
import pandas as pd
import nfl_data_py as nfl

load_dotenv()

def debug_star_players():
    engine = create_engine(os.getenv('DATABASE_URL'))
    
    # Players to investigate
    star_names = ['Tom Brady', 'Patrick Mahomes', 'Aaron Donald', 'Justin Jefferson']
    
    print("🔍 DEBUGGING STAR PLAYER CONNECTIONS")
    print("=" * 50)
    
    with engine.connect() as conn:
        # 1. Check what's in our players table
        print("\n1️⃣ Players table records:")
        players_query = text("""
            SELECT id, name, position, college, draft_year, first_season, last_season
            FROM players 
            WHERE name ILIKE ANY(ARRAY['%tom%brady%', '%patrick%mahomes%', '%aaron%donald%', '%justin%jefferson%'])
            ORDER BY name
        """)
        players_df = pd.read_sql(players_query, conn)
        print(players_df.to_string(index=False))
        
        # 2. Check raw roster data for these players
        print("\n2️⃣ Checking raw roster data...")
        current_year = 2025
        years = list(range(2015, current_year + 1))
        
        try:
            rosters = nfl.import_seasonal_rosters(years=years)
            
            for star in star_names:
                print(f"\n🔍 {star} in raw rosters:")
                matches = rosters[rosters['player_name'].str.contains(star.split()[-1], case=False, na=False)]
                if len(matches) > 0:
                    # Show unique combinations of key identifiers
                    unique_records = matches[['player_id', 'esb_id', 'player_name', 'team', 'season']].drop_duplicates()
                    print(f"   Found {len(unique_records)} unique records:")
                    for _, row in unique_records.head(5).iterrows():
                        print(f"   player_id: {row['player_id']}, esb_id: {row['esb_id']}, name: {row['player_name']}")
                else:
                    print(f"   ❌ No matches found for {star}")
        
        except Exception as e:
            print(f"   ⚠️ Error loading roster data: {e}")
        
        # 3. Check what IDs are actually used in connections
        print("\n3️⃣ Checking connection player IDs:")
        if len(players_df) > 0:
            player_ids = players_df['id'].tolist()
            
            connections_query = text("""
                SELECT 
                    p1.name as player1_name,
                    p2.name as player2_name,
                    pc.connection_type,
                    pc.metadata
                FROM player_connections pc
                JOIN players p1 ON pc.player1_id = p1.id
                JOIN players p2 ON pc.player2_id = p2.id
                WHERE pc.player1_id = ANY(:player_ids) OR pc.player2_id = ANY(:player_ids)
                ORDER BY p1.name
                LIMIT 10
            """)
            
            try:
                connections_df = pd.read_sql(connections_query, conn, params={'player_ids': player_ids})
                print(f"Found {len(connections_df)} sample connections:")
                if len(connections_df) > 0:
                    print(connections_df.to_string(index=False))
                else:
                    print("   ❌ No connections found for any of these players")
            except Exception as e:
                print(f"   ⚠️ Error querying connections: {e}")
        
        # 4. Check for ID mismatches
        print("\n4️⃣ Checking for ID consistency issues:")
        try:
            # Get players master data
            players_master = nfl.import_players()
            
            for star in star_names:
                print(f"\n🔍 {star} ID mapping:")
                
                # Check in master data
                master_matches = players_master[
                    players_master['display_name'].str.contains(star.split()[-1], case=False, na=False)
                ]
                
                if len(master_matches) > 0:
                    for _, row in master_matches.head(3).iterrows():
                        print(f"   Master: esb_id={row.get('esb_id', 'N/A')}, gsis_id={row.get('gsis_id', 'N/A')}, name={row.get('display_name', 'N/A')}")
                
                # Check what made it to our database
                db_matches = players_df[players_df['name'].str.contains(star.split()[-1], case=False, na=False)]
                if len(db_matches) > 0:
                    for _, row in db_matches.iterrows():
                        print(f"   DB: id={row['id']}, name={row['name']}")
                else:
                    print(f"   ❌ {star} not found in database")
                    
        except Exception as e:
            print(f"   ⚠️ Error checking master data: {e}")

def debug_connection_building():
    """Test the connection building logic with a small sample"""
    print("\n5️⃣ Testing connection building logic:")
    
    try:
        current_year = 2025
        years = [2023, 2024]  # Just recent years for testing
        
        rosters = nfl.import_seasonal_rosters(years=years)
        print(f"   Loaded {len(rosters)} roster records")
        
        # Filter for our star players
        star_rosters = rosters[
            rosters['player_name'].str.contains('Brady|Mahomes|Donald|Jefferson', case=False, na=False)
        ]
        
        print(f"   Found {len(star_rosters)} records for star players")
        
        if len(star_rosters) > 0:
            print("   Sample records:")
            for _, row in star_rosters[['player_name', 'team', 'season', 'player_id', 'esb_id']].head(5).iterrows():
                print(f"   {row['player_name']} - {row['team']} ({row['season']}) - player_id: {row['player_id']}, esb_id: {row['esb_id']}")
            
            # Check if they have the canonical ID field
            if 'esb_id' in star_rosters.columns:
                missing_esb = star_rosters['esb_id'].isna().sum()
                print(f"   Records missing esb_id: {missing_esb}/{len(star_rosters)}")
                
    except Exception as e:
        print(f"   ⚠️ Error in connection building test: {e}")

if __name__ == "__main__":
    debug_star_players()
    debug_connection_building()
