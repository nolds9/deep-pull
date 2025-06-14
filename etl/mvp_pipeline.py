import nfl_data_py as nfl
import pandas as pd
import psycopg2
from sqlalchemy import create_engine, text
from sqlalchemy.types import JSON
import os
from datetime import datetime
import logging
from typing import Any, Tuple

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MVPETLPipeline:
    """
    Minimal viable ETL for NFL racing game
    Focuses on: players, basic connections, fast iteration
    """
    
    def __init__(self, db_url: str):
        self.engine = create_engine(db_url)
        self.current_year = datetime.now().year
        
        # MVP Scope: Last 10 years + current season
        self.years = list(range(2015, self.current_year + 1))
        
    def extract_players(self, rosters: pd.DataFrame = None) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Extract clean player data for racing game.
        
        Returns a tuple of:
        - clean_players (pd.DataFrame): One row per unique player, summarized.
        - enriched_rosters (pd.DataFrame): Roster data with draft info added.
        """
        logger.info(f"Extracting player rosters for years: {self.years}")
        
        # Step 1: Get roster data (or use provided data)
        if rosters is None:
            rosters = nfl.import_seasonal_rosters(years=self.years)
            logger.info(f"Loaded rosters: {rosters.shape}")
        else:
            logger.info(f"Using provided rosters: {rosters.shape}")
        
        print(f"🔍 Roster columns: {rosters.columns.tolist()}")
        
        # Step 2: Get player master data
        players_master = nfl.import_players()
        logger.info(f"Loaded players master: {players_master.shape}")
        print(f"🔍 Players master columns: {players_master.columns.tolist()}")
        
        # Step 3: Get draft data
        draft_picks = nfl.import_draft_picks(years=self.years)
        logger.info(f"Loaded draft picks: {draft_picks.shape}")
        print(f"🔍 Draft picks columns: {draft_picks.columns.tolist()}")
        
        # Step 4: Merge rosters with player master data
        enriched_rosters = self._merge_player_data(rosters, players_master)
        
        # Step 5: Add draft information
        enriched_rosters = self._add_draft_info(enriched_rosters, draft_picks)
        
        # Step 6: Clean and deduplicate
        clean_players = self._clean_player_data(enriched_rosters)
        
        logger.info(f"Extracted {len(clean_players)} unique players")
        return clean_players, enriched_rosters

    def _merge_player_data(self, rosters: pd.DataFrame, players_master: pd.DataFrame) -> pd.DataFrame:
        """Merge roster and player master data using esb_id"""
        
        print("✅ Merging rosters with players_master on esb_id")
        
        # Check merge compatibility
        roster_esb_count = rosters['esb_id'].notna().sum()
        master_esb_count = players_master['esb_id'].notna().sum()
        overlap = len(set(rosters['esb_id'].dropna()) & set(players_master['esb_id'].dropna()))
        
        print(f"🔍 Roster esb_id non-null: {roster_esb_count}")
        print(f"🔍 Master esb_id non-null: {master_esb_count}")
        print(f"🔍 ESB ID overlap: {overlap}")
        
        # Check for duplicates
        roster_dups = rosters['esb_id'].duplicated().sum()
        master_dups = players_master['esb_id'].duplicated().sum()
        print(f"🔍 Roster esb_id duplicates: {roster_dups}")
        print(f"🔍 Master esb_id duplicates: {master_dups}")
        
        # Deduplicate players_master to avoid cartesian product
        if master_dups > 0:
            print("⚠️ Deduplicating players_master on esb_id (keeping first)")
            players_master_clean = players_master.drop_duplicates(subset=['esb_id'], keep='first')
            print(f"🔧 Players master: {len(players_master)} → {len(players_master_clean)} after dedup")
        else:
            players_master_clean = players_master

        # Explicitly rename master columns before merge to avoid conflicts
        master_to_merge = players_master_clean[['esb_id', 'display_name', 'college_name', 'position', 'gsis_id']].rename(columns={
            'position': 'position_master',
            'college_name': 'college_master',
            'display_name': 'display_name_master'
        })
        
        # Merge on esb_id (no suffixes needed now)
        merged = rosters.merge(master_to_merge, on='esb_id', how='left')
        
        print(f"🔍 After merge shape: {merged.shape} (should be close to roster size: {rosters.shape[0]})")
        
        # Coalesce data: fill missing roster data with master data
        merged['player_name'] = merged['display_name_master'].fillna(merged['player_name'])
        merged['college'] = merged['college_master'].fillna(merged['college'])
        merged['position'] = merged['position_master'].fillna(merged['position'])
        
        # Drop the now-redundant master columns
        columns_to_drop = ['display_name_master', 'college_master', 'position_master']
        merged = merged.drop(columns=[col for col in columns_to_drop if col in merged.columns])
        
        print(f"✅ Final merged dataset shape: {merged.shape}")
        
        # With no duplicate columns, this calculation will now work
        try:
            if 'player_name' in merged.columns:
                success_count = merged['player_name'].notna().sum()
                total_count = len(merged)
                if total_count > 0:
                    merge_success_rate = (success_count / total_count) * 100
                    print(f"🔍 Merge success rate: {merge_success_rate:.1f}% ({success_count}/{total_count})")
                else:
                    print("🔍 Merge success rate: 0.0% (0/0)")
            else:
                print("⚠️ player_name column not found after merge")
        except Exception as e:
            print(f"⚠️ Could not calculate merge success rate: {e}")
        
        return merged

    def _add_draft_info(self, players_df: pd.DataFrame, draft_picks: pd.DataFrame) -> pd.DataFrame:
        """Add draft information using gsis_id mapping"""
        
        print("✅ Adding draft info via gsis_id")
        
        # Check how many players have gsis_id from the previous merge
        gsis_id_count = players_df['gsis_id'].notna().sum() if 'gsis_id' in players_df.columns else 0
        draft_gsis_count = draft_picks['gsis_id'].notna().sum()
        
        print(f"🔍 Players with gsis_id: {gsis_id_count}")
        print(f"🔍 Draft picks with gsis_id: {draft_gsis_count}")
        
        if gsis_id_count > 0 and draft_gsis_count > 0:
            overlap = len(set(players_df['gsis_id'].dropna()) & set(draft_picks['gsis_id'].dropna()))
            print(f"🔍 GSIS ID overlap: {overlap}")
            
            # Prepare draft info
            draft_info = draft_picks[['gsis_id', 'season']].copy()
            draft_info = draft_info.rename(columns={'season': 'draft_year'})
            
            # Merge on gsis_id
            merged = players_df.merge(draft_info, on='gsis_id', how='left')
            
            # Calculate success rate
            try:
                draft_success_count = ((merged['draft_year'].notna()) & (merged['draft_year'] > 0)).sum()
                draft_success_rate = (draft_success_count / len(merged)) * 100
                print(f"✅ Draft info success rate: {draft_success_rate:.1f}%")
            except Exception as e:
                print(f"⚠️ Could not calculate draft success rate: {e}")
        else:
            print("⚠️ Cannot merge draft info - missing gsis_id columns")
            merged = players_df.copy()
            merged['draft_year'] = 0
        
        # Fill missing draft years with 0
        merged['draft_year'] = merged['draft_year'].fillna(0).astype(int)
        
        # Create a canonical player ID to use as the primary key.
        # The 'player_id' from seasonal rosters is not always unique to a player.
        merged['id'] = merged['esb_id'].fillna(merged['gsis_id'])
        missing_id_count = merged['id'].isna().sum()
        if missing_id_count > 0:
            # As a last resort, use the original player_id.
            logger.warning(f"{missing_id_count} records have no esb_id or gsis_id. Using original player_id as fallback.")
            merged['id'].fillna(merged['player_id'], inplace=True)
            
        return merged
        
    def _clean_player_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clean and deduplicate player data"""
        
        logger.info("Cleaning and deduplicating player data...")
        print(f"🔍 Raw merged data shape: {df.shape}")
        
        # Check for presence of our new canonical 'id'
        if 'id' not in df.columns:
            logger.error("Canonical 'id' column is missing! Aborting clean.")
            return pd.DataFrame()

        # Named aggregation (avoids pandas bug with lambdas & multi-index)
        agg_named: dict[str, tuple[str, Any]] = {}
        if 'player_name' in df.columns:
            agg_named['name'] = ('player_name', 'first')
        if 'position' in df.columns:
            agg_named['position'] = ('position', 'first')
        if 'college' in df.columns:
            agg_named['college'] = ('college', 'first')
        if 'draft_year' in df.columns:
            agg_named['draft_year'] = ('draft_year', 'first')
        if 'team' in df.columns:
            agg_named['teams'] = ('team', lambda x: list(x.unique()))
        if 'season' in df.columns:
            agg_named['first_season'] = ('season', 'min')
            agg_named['last_season'] = ('season', 'max')

        print(f"🔍 Aggregation dict (named): {list(agg_named.keys())}")

        if not agg_named:
            print("❌ No valid columns found for aggregation")
            return pd.DataFrame()

        try:
            # Group by the canonical 'id' to ensure one record per player
            player_summary = (
                df.groupby('id')
                  .agg(**agg_named)
                  .reset_index()
            )
            print(f"🔍 After groupby shape: {player_summary.shape}")
        except Exception as e:
            print(f"❌ Groupby failed even with named aggregation: {e}")
            raise

        # Ensure required columns exist even if missing from source
        for col in ['college', 'position', 'draft_year', 'teams', 'first_season', 'last_season']:
            if col not in player_summary.columns:
                player_summary[col] = None
        
        # Clean data with safe defaults
        if 'college' in player_summary.columns:
            player_summary['college'] = player_summary['college'].fillna('Unknown')
        else:
            player_summary['college'] = 'Unknown'
            
        if 'position' in player_summary.columns:
            player_summary['position'] = player_summary['position'].fillna('UNK')
        else:
            player_summary['position'] = 'UNK'
            
        if 'draft_year' in player_summary.columns:
            player_summary['draft_year'] = player_summary['draft_year'].fillna(0).astype(int)
        else:
            player_summary['draft_year'] = 0
        
        # Filter out players with minimal data
        before_filter = len(player_summary)
        if 'name' in player_summary.columns:
            player_summary = player_summary[
                (player_summary['name'].notna()) & 
                (player_summary['name'] != '')
            ]
        after_filter = len(player_summary)
        
        print(f"🔍 Filtered players: {before_filter} → {after_filter}")
        if 'name' in player_summary.columns and len(player_summary) > 0:
            print(f"🔍 Sample players: {player_summary['name'].head(3).tolist()}")
        
        return player_summary
    
    def extract_connections(self, rosters_df: pd.DataFrame) -> pd.DataFrame:
        """Build connection graph for racing game"""
        logger.info("Building player connections...")
        
        # To avoid connection explosion from large 90-man offseason rosters,
        # let's filter down to just regular season data for building connections.
        if 'game_type' in rosters_df.columns:
            logger.info("Filtering rosters for REG (regular season) games only...")
            original_size = len(rosters_df)
            rosters_df = rosters_df[rosters_df['game_type'] == 'REG'].copy()
            logger.info(f"  → Roster size reduced from {original_size} to {len(rosters_df)}")

        all_connections = []
        
        # 1. Teammate connections (most important for racing)
        teammate_connections = self._build_teammate_connections(rosters_df)
        all_connections.extend(teammate_connections)
        logger.info(f"Created {len(teammate_connections)} teammate connections")
        
        # 2. College connections  
        college_connections = self._build_college_connections(rosters_df)
        all_connections.extend(college_connections)
        logger.info(f"Created {len(college_connections)} college connections")
        
        # 3. Draft class connections
        draft_connections = self._build_draft_connections(rosters_df)
        all_connections.extend(draft_connections)
        logger.info(f"Created {len(draft_connections)} draft class connections")
        
        # 4. Position connections (creates fallback paths)
        position_connections = self._build_position_connections(rosters_df)
        all_connections.extend(position_connections)
        logger.info(f"Created {len(position_connections)} position connections")
        
        connections_df = pd.DataFrame(all_connections)
        logger.info(f"Total connections: {len(connections_df)}")
        
        return connections_df
    
    def _build_teammate_connections(self, rosters_df: pd.DataFrame) -> list:
        """Players who played on same team in same season"""
        connections = []
        
        # Group by team and season
        for (team, season), group in rosters_df.groupby(['team', 'season']):
            players = group['id'].unique().tolist()
            
            # Create connections between all teammates
            for i, player1 in enumerate(players):
                for player2 in players[i+1:]:
                    connections.append({
                        'player1_id': player1,
                        'player2_id': player2,
                        'connection_type': 'teammate',
                        'metadata': {'team': team, 'season': int(season)}
                    })
        
        return connections
    
    def _build_college_connections(self, rosters_df: pd.DataFrame) -> list:
        """Players who went to same college"""
        connections = []
        
        # Get unique players with college info
        players_with_college = rosters_df[
            (rosters_df['college'].notna()) & 
            (rosters_df['college'] != 'Unknown') &
            (rosters_df['college'] != '')
        ][['id', 'college', 'player_name']].drop_duplicates()
        
        # Group by college
        for college, group in players_with_college.groupby('college'):
            players = group['id'].tolist()
            
            # Limit connections to avoid explosion (max 50 players per college)
            if len(players) > 50:
                players = players[:50]
            
            # Only create connections if 2+ players from same college
            if len(players) >= 2:
                for i, player1 in enumerate(players):
                    for player2 in players[i+1:]:
                        connections.append({
                            'player1_id': player1,
                            'player2_id': player2,
                            'connection_type': 'college',
                            'metadata': {'college': college}
                        })
        
        return connections
    
    def _build_draft_connections(self, rosters_df: pd.DataFrame) -> list:
        """Players drafted in same year"""
        connections = []
        
        # Get players with draft year info
        players_with_draft = rosters_df[
            (rosters_df['draft_year'].notna()) & 
            (rosters_df['draft_year'] > 0)
        ][['id', 'draft_year']].drop_duplicates()
        
        # Group by draft year
        for draft_year, group in players_with_draft.groupby('draft_year'):
            players = group['id'].tolist()
            
            # Limit connections to avoid explosion (max 50 players per draft year)
            if len(players) > 50:
                players = players[:50]
            
            if len(players) >= 2:
                for i, player1 in enumerate(players):
                    for player2 in players[i+1:]:
                        connections.append({
                            'player1_id': player1,
                            'player2_id': player2,
                            'connection_type': 'draft_class',
                            'metadata': {'draft_year': int(draft_year)}
                        })
        
        return connections
    
    def _build_position_connections(self, rosters_df: pd.DataFrame) -> list:
        """Players who play same position - limited to avoid explosion"""
        connections = []
        
        # Get players by position, limit to recent years to keep manageable
        recent_players = rosters_df[rosters_df['season'] >= 2020]
        players_by_position = recent_players[
            (recent_players['position'].notna()) & 
            (recent_players['position'] != 'UNK')
        ][['id', 'position']].drop_duplicates()
        
        # Only connect "skill positions" to keep connections meaningful
        skill_positions = ['QB', 'RB', 'WR', 'TE', 'K', 'P']
        
        for position in skill_positions:
            position_players = players_by_position[
                players_by_position['position'] == position
            ]['id'].tolist()
            
            # Limit to prevent explosion (max 30 per position)
            if len(position_players) > 30:
                position_players = position_players[:30]
            
            if len(position_players) >= 2:
                for i, player1 in enumerate(position_players):
                    for player2 in position_players[i+1:]:
                        connections.append({
                            'player1_id': player1,
                            'player2_id': player2,
                            'connection_type': 'position',
                            'metadata': {'position': position}
                        })
        
        return connections
    
    def load_to_database(self, players_df: pd.DataFrame, connections_df: pd.DataFrame):
        """Load clean data to PostgreSQL"""
        logger.info("Loading data to database...")
        
        try:
            # Load players
            players_df.to_sql(
                'players', 
                self.engine, 
                if_exists='replace', 
                index=False,
                method='multi'
            )
            logger.info(f"Loaded {len(players_df)} players")
            
            # Load connections in batches to avoid memory issues
            batch_size = 10000
            total_batches = len(connections_df) // batch_size + 1
            
            for i in range(0, len(connections_df), batch_size):
                batch = connections_df.iloc[i:i+batch_size]
                batch.to_sql(
                    'player_connections',
                    self.engine,
                    if_exists='replace' if i == 0 else 'append',
                    index=False,
                    method='multi',
                    dtype={'metadata': JSON}  # Explicitly set JSON type for metadata
                )
                logger.info(f"Loaded batch {i//batch_size + 1}/{total_batches}")
            
            logger.info(f"Loaded {len(connections_df)} total connections")
            
            # Create indexes for performance
            self._create_indexes()
            
        except Exception as e:
            logger.error(f"Database load failed: {e}")
            raise
    
    def _create_indexes(self):
        """Create indexes for fast pathfinding queries"""
        logger.info("Creating database indexes...")
        
        with self.engine.connect() as conn:
            # Index for fast connection lookups
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_connections_player1 
                ON player_connections(player1_id, connection_type)
            """))
            
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_connections_player2 
                ON player_connections(player2_id, connection_type)
            """))
            
            # Index for player lookups
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_players_name 
                ON players(name)
            """))
            
            conn.commit()
        
        logger.info("Indexes created successfully")
    
    def run_mvp_etl(self):
        """Main ETL process for MVP"""
        logger.info("Starting MVP ETL Pipeline...")
        start_time = datetime.now()
        
        try:
            # Step 1: Extract roster data 
            rosters_raw = nfl.import_seasonal_rosters(years=self.years)
            logger.info(f"Raw roster records: {len(rosters_raw)}")
            
            # Step 2: Build clean player profiles and get enriched rosters
            players_df, enriched_rosters = self.extract_players(rosters_raw)
            
            # Step 3: Build connection graph (use the enriched rosters data)
            connections_df = self.extract_connections(enriched_rosters)
            
            # Step 4: Load to database (only if not dry run)
            if hasattr(self, '_dry_run') and self._dry_run:
                logger.info("DRY RUN - Skipping database load")
            else:
                self.load_to_database(players_df, connections_df)
                # Step 5: Validate data quality
                self._validate_data_quality()
            
            duration = datetime.now() - start_time
            logger.info(f"ETL completed successfully in {duration}")
            
            return {
                'players_count': len(players_df),
                'connections_count': len(connections_df),
                'duration_seconds': duration.total_seconds()
            }
            
        except Exception as e:
            logger.error(f"ETL pipeline failed: {e}")
            raise
    
    def _validate_data_quality(self):
        """Basic data quality checks"""
        with self.engine.connect() as conn:
            # Check player count
            player_count = conn.execute(text("SELECT COUNT(*) FROM players")).scalar()
            
            # Check connection count
            connection_count = conn.execute(text("SELECT COUNT(*) FROM player_connections")).scalar()
            
            # Check for orphaned connections
            orphaned = conn.execute(text("""
                SELECT COUNT(*) FROM player_connections pc
                WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.id = pc.player1_id)
                   OR NOT EXISTS (SELECT 1 FROM players p WHERE p.id = pc.player2_id)
            """)).scalar()
            
            logger.info(f"Data quality check - Players: {player_count}, Connections: {connection_count}, Orphaned: {orphaned}")
            
            if orphaned > 0:
                logger.warning(f"Found {orphaned} orphaned connections!")

# CLI interface for running ETL
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Run NFL MVP ETL Pipeline')
    parser.add_argument('--db-url', required=True, help='PostgreSQL database URL')
    parser.add_argument('--dry-run', action='store_true', help='Run without loading to database')
    
    args = parser.parse_args()
    
    pipeline = MVPETLPipeline(args.db_url)
    pipeline._dry_run = args.dry_run  # Add dry run flag to pipeline
    
    if args.dry_run:
        logger.info("DRY RUN - Extracting data only...")
        result = pipeline.run_mvp_etl()
        logger.info(f"Would load {result['players_count']} players and {result['connections_count']} connections")
    else:
        result = pipeline.run_mvp_etl()
        logger.info(f"ETL Result: {result}")
