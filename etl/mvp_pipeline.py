import nfl_data_py as nfl
import pandas as pd
import psycopg2
from sqlalchemy import (
    create_engine, text, Table, Column, MetaData,
    Integer, String, JSON, Float, UniqueConstraint,
    DateTime, func, ForeignKey
)
from sqlalchemy.types import JSON
import os
from datetime import datetime
import logging
from typing import Any, Tuple
import gc
import tempfile
import time
import urllib.error

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TEAM_ABBR_NORMALIZATION_MAP = {
    'STL': 'LAR',
    'LA': 'LAR',
    'SD': 'LAC',
    'OAK': 'LV',
}

TEAM_NAME_NORMALIZATION_MAP = {
    'St. Louis Rams': 'Los Angeles Rams',
    'San Diego Chargers': 'Los Angeles Chargers',
    'Oakland Raiders': 'Las Vegas Raiders'
}

class MVPETLPipeline:
    """
    Minimal viable ETL for NFL racing game
    Focuses on: players, basic connections, fast iteration
    """
    
    def __init__(self, db_url: str):
        self.engine = create_engine(db_url)
        self.current_year = datetime.now().year
        self.start_year = 2020  # REDUCED to just 5 years for ultra-safety
        self.years = list(range(self.start_year, self.current_year + 1))
        self.roster_temp_file = os.path.join(tempfile.gettempdir(), 'rosters.parquet')
        
        # ULTRA-SAFE LIMITS
        self.MAX_TOTAL_CONNECTIONS = 50000      # Reduced for a more focused skill player graph
        self.MAX_TEAM_SIZE = 25                 # ~12-15 skill players per team, buffer for safety
        self.MAX_COLLEGE_PLAYERS = 20           # Richer skill position alumni networks
        self.MAX_DRAFT_PLAYERS = 15             # Richer skill position draft classes
        self.MAX_POSITION_PLAYERS = 15          # More position connections between skills
        
        # Connection tracking
        self.connection_count = 0
        
    def _clear_data_pipeline_tables(self):
        """Clears data from tables managed by the ETL pipeline, respecting foreign keys."""
        logger.info("Clearing data from ETL-managed tables (players, connections, stats)...")
        with self.engine.connect() as conn:
            transaction = conn.begin()
            try:
                # Delete from tables that reference players first
                conn.execute(text("DELETE FROM team_season_leaders"))
                conn.execute(text("DELETE FROM player_seasonal_stats"))
                conn.execute(text("DELETE FROM player_connections"))
                # Now delete from players and teams
                conn.execute(text("DELETE FROM players"))
                conn.execute(text("DELETE FROM teams"))
                transaction.commit()
                logger.info("Successfully cleared ETL-managed tables.")
            except Exception as e:
                logger.error(f"Error clearing tables: {e}")
                transaction.rollback()
                raise
        
    def extract_players(self, significant_esb_ids: set, rosters: pd.DataFrame | None = None) -> pd.DataFrame:
        """
        Extracts clean player data, filtered by a set of significant player IDs,
        saves enriched weekly rosters to a temp file, and returns the final player summary.
        """
        logger.info(f"Extracting player rosters for years: {self.years}")
        
        if rosters is None:
            logger.info("Loading weekly rosters one year at a time to avoid library bug...")
            all_rosters = []
            
            for year in self.years:
                try:
                    logger.info(f"Loading {year} weekly rosters...")
                    year_rosters = nfl.import_weekly_rosters(years=[year])
                    year_rosters = year_rosters.reset_index(drop=True)
                    all_rosters.append(year_rosters)
                    logger.info(f"  → {year}: {len(year_rosters)} records loaded")
                except Exception as e:
                    logger.warning(f"Failed to load {year} rosters: {e}")
                    continue
            
            if not all_rosters:
                raise Exception("Failed to load any roster data")
            
            rosters_weekly = pd.concat(all_rosters, ignore_index=True)
            logger.info(f"Combined weekly rosters: {rosters_weekly.shape}")
            del all_rosters
        else:
            rosters_weekly = rosters
            logger.info(f"Using provided rosters: {rosters_weekly.shape}")

        # NEW: Filter by significant players FIRST (using esb_id)
        logger.info(f"Filtering {len(rosters_weekly):,} raw records down to {len(significant_esb_ids)} significant players.")
        rosters_weekly = rosters_weekly[rosters_weekly['esb_id'].isin(significant_esb_ids)]
        logger.info(f"  → {len(rosters_weekly):,} records remaining after significance filter.")

        meaningful_games = ['REG', 'WC', 'DIV', 'CON', 'SB']
        rosters_for_connections = rosters_weekly[rosters_weekly['game_type'].isin(meaningful_games)].copy()
        logger.info(f"After game filter: {len(rosters_for_connections)} records")
        
        # Add skill position filtering:
        logger.info("Filtering to skill positions only...")
        skill_positions = ['QB', 'RB', 'WR', 'TE']
        original_size = len(rosters_for_connections)
        rosters_for_connections = rosters_for_connections[
            rosters_for_connections['position'].isin(skill_positions)
        ].copy()
        logger.info(f"Skill position filter: {original_size:,} → {len(rosters_for_connections):,} records")
        position_counts = rosters_for_connections['position'].value_counts()
        logger.info(f"Position breakdown: {position_counts.to_dict()}")
        self._log_skill_position_stats(rosters_for_connections)
        
        # --- NORMALIZE TEAM ABBRS IN ROSTERS ---
        if 'team' in rosters_for_connections.columns:
            rosters_for_connections['team'] = rosters_for_connections['team'].apply(self._normalize_team_abbr)
        # --- END NORMALIZATION ---

        del rosters_weekly
        gc.collect()
        
        players_master = nfl.import_players()
        draft_picks = nfl.import_draft_picks(years=self.years)
        
        enriched_weekly_rosters = self._merge_player_data(rosters_for_connections, players_master)
        del rosters_for_connections
        enriched_weekly_rosters = self._add_draft_info(enriched_weekly_rosters, draft_picks)

        # Fix for pyarrow type error by ensuring potentially mixed-type columns are strings
        logger.info("Cleaning potentially mixed-type columns for parquet compatibility.")
        cols_to_str = [
            'jersey_number', 'draft_number', 'depth_chart_position', 'years_exp', 'age', 'weight'
        ]
        for col in cols_to_str:
            if col in enriched_weekly_rosters.columns:
                enriched_weekly_rosters[col] = enriched_weekly_rosters[col].astype(str)

        logger.info(f"Saving enriched weekly rosters to temp file: {self.roster_temp_file}")
        enriched_weekly_rosters.to_parquet(self.roster_temp_file)

        rosters_deduped = (enriched_weekly_rosters
                .sort_values(['season', 'team', 'player_name', 'week'])
                .groupby(['season', 'team', 'player_name'])
                .last()
                .reset_index())
        
        del enriched_weekly_rosters
        gc.collect()

        clean_players = self._clean_player_data(rosters_deduped)
        
        return clean_players

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

        master_to_merge = players_master_clean[['esb_id', 'display_name', 'college_name', 'position', 'gsis_id']].rename(columns={
            'position': 'position_master',
            'college_name': 'college_master',
            'display_name': 'display_name_master',
            'gsis_id': 'gsis_id_master'
        })
        
        merged = rosters.merge(master_to_merge, on='esb_id', how='left')
        
        print(f"🔍 After merge shape: {merged.shape} (should be close to roster size: {rosters.shape[0]})")
        
        merged['player_name'] = merged['display_name_master'].fillna(merged['player_name'])
        merged['college'] = merged['college_master'].fillna(merged['college'])
        merged['position'] = merged['position_master'].fillna(merged['position'])
        if 'gsis_id_master' in merged.columns and 'gsis_id' in merged.columns:
            merged['gsis_id'] = merged['gsis_id_master'].fillna(merged['gsis_id'])

        columns_to_drop = ['display_name_master', 'college_master', 'position_master', 'gsis_id_master']
        merged = merged.drop(columns=[col for col in columns_to_drop if col in merged.columns])
        
        print(f"✅ Final merged dataset shape: {merged.shape}")
        
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
        
        gsis_id_count = players_df['gsis_id'].notna().sum() if 'gsis_id' in players_df.columns else 0
        draft_gsis_count = draft_picks['gsis_id'].notna().sum()
        
        print(f"🔍 Players with gsis_id: {gsis_id_count}")
        print(f"🔍 Draft picks with gsis_id: {draft_gsis_count}")
        
        if gsis_id_count > 0 and draft_gsis_count > 0:
            overlap = len(set(players_df['gsis_id'].dropna()) & set(draft_picks['gsis_id'].dropna()))
            print(f"🔍 GSIS ID overlap: {overlap}")
            
            draft_info = draft_picks[['gsis_id', 'season']].copy()
            draft_info = draft_info.rename(columns={'season': 'draft_year'})
            
            merged = players_df.merge(draft_info, on='gsis_id', how='left')
            
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
        
        merged['draft_year'] = merged['draft_year'].fillna(0).astype(int)
        
        merged['id'] = merged['esb_id'].fillna(merged['gsis_id'])
        missing_id_count = merged['id'].isna().sum()
        if missing_id_count > 0:
            logger.warning(f"{missing_id_count} records have no esb_id or gsis_id. Using original player_id as fallback.")
            merged['id'].fillna(merged['player_id'], inplace=True)
            
        return merged
        
    def _clean_player_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clean and deduplicate player data"""
        
        logger.info("Cleaning and deduplicating player data...")
        print(f"🔍 Raw merged data shape: {df.shape}")
        
        if 'id' not in df.columns:
            logger.error("Canonical 'id' column is missing! Aborting clean.")
            return pd.DataFrame()

        agg_named: dict[str, tuple[str, Any]] = {}
        if 'player_name' in df.columns:
            agg_named['name'] = ('player_name', 'first')
        if 'gsis_id' in df.columns:
            agg_named['gsis_id'] = ('gsis_id', 'first')
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
            player_summary = (
                df.groupby('id')
                  .agg(**agg_named)
                  .reset_index()
            )
            print(f"🔍 After groupby shape: {player_summary.shape}")
        except Exception as e:
            print(f"❌ Groupby failed even with named aggregation: {e}")
            raise

        for col in ['college', 'position', 'draft_year', 'teams', 'first_season', 'last_season', 'gsis_id']:
            if col not in player_summary.columns:
                player_summary[col] = None
        
        if 'college' in player_summary.columns:
            player_summary['college'] = player_summary['college'].fillna('Unknown')
        else:
            player_summary['college'] = 'Unknown'
            
        if 'position' in player_summary.columns:
            player_summary['position'] = player_summary['position'].fillna('UNK')
        else:
            player_summary['position'] = 'UNK'
            
        if 'gsis_id' in player_summary.columns:
            player_summary['gsis_id'] = player_summary['gsis_id'].where(pd.notna(player_summary['gsis_id']), None)
            
        if 'draft_year' in player_summary.columns:
            player_summary['draft_year'] = player_summary['draft_year'].fillna(0).astype(int)
        else:
            player_summary['draft_year'] = 0
        
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
    
    def _load_players(self, players_df: pd.DataFrame):
        """Appends player data to the players table in batches."""
        logger.info("Loading players to database...")

        # Drop gsis_id before loading, it's not part of the final players table schema
        players_to_load = players_df.drop(columns=['gsis_id'], errors='ignore')

        try:
            players_to_load.to_sql(
                'players',
                self.engine,
                if_exists='append',
                index=False,
                method='multi',
                chunksize=500,
                dtype={'teams': JSON}
            )
            logger.info(f"Loaded {len(players_to_load)} players")
        except Exception as e:
            logger.error(f"Player database load failed: {e}")
            raise

    def _load_connections_batch(self, connections_df: pd.DataFrame):
        """Helper to load a DataFrame of connections in batches."""
        if connections_df.empty:
            return
        
        if hasattr(self, '_dry_run') and self._dry_run:
            # In a dry run, we just log what would happen but don't load.
            # The count is handled by the calling function.
            return

        try:
            connections_df.to_sql(
                'player_connections',
                self.engine,
                if_exists='append',
                index=False,
                method='multi',
                chunksize=500, # Use chunksize for batching
                dtype={'metadata': JSON}
            )
        except Exception as e:
            logger.error(f"Failed to load a batch of {len(connections_df)} connections.")
            raise e

    def _build_and_load_teammate_connections(self) -> int:
        """Processes and loads teammate connections from temp file year-by-year."""
        total_teammate_conns = 0
        
        rosters_cols = pd.read_parquet(self.roster_temp_file, columns=['season'])
        years = sorted(rosters_cols['season'].unique())
        del rosters_cols
        
        logger.info("Building and loading teammate connections year-by-year...")
        for year in years:
            rosters_for_year = pd.read_parquet(self.roster_temp_file, filters=[('season', '==', year)])
            connections = self._build_teammate_connections(rosters_for_year)

            if connections:
                connections_df = pd.DataFrame(connections)
                logger.info(f"Loading {len(connections_df)} teammate connections for {year}...")
                self._load_connections_batch(connections_df)
                total_teammate_conns += len(connections_df)
                
        return total_teammate_conns

    def _build_all_connections(self) -> pd.DataFrame:
        """Builds and deduplicates all connection types, returning a clean DataFrame."""
        logger.info("Building all connection types...")
        
        processed_pairs = set()
        all_connections = []

        # 1. Gather all teammate connections
        logger.info("Building teammate connections...")
        rosters_cols = pd.read_parquet(self.roster_temp_file, columns=['season'])
        years = sorted(rosters_cols['season'].unique())
        del rosters_cols
        
        for year in years:
            rosters_for_year = pd.read_parquet(self.roster_temp_file, filters=[('season', '==', year)])
            teammate_conns = self._build_teammate_connections(rosters_for_year, processed_pairs)
            if teammate_conns:
                all_connections.extend(teammate_conns)

        # 2. Gather all other connections
        logger.info("Building other connections (college, draft)...")
        other_rosters_df = pd.read_parquet(
            self.roster_temp_file, 
            columns=['id', 'college', 'player_name', 'draft_year', 'position', 'season']
        )
        college_conns = self._build_college_connections(other_rosters_df, processed_pairs)
        if college_conns:
            all_connections.extend(college_conns)
            
        draft_conns = self._build_draft_connections(other_rosters_df, processed_pairs)
        if draft_conns:
            all_connections.extend(draft_conns)
        
        del other_rosters_df
        gc.collect()

        if not all_connections:
            logger.warning("No connections were generated.")
            return pd.DataFrame()

        # 3. Create a single DataFrame and deduplicate
        logger.info(f"Aggregated {len(all_connections):,} raw connections. Now deduplicating...")
        
        connections_df = pd.DataFrame(all_connections)
        
        # This is the key safety net
        connections_df.drop_duplicates(subset=['player1_id', 'player2_id', 'connection_type'], inplace=True)
        
        logger.info(f"Returning {len(connections_df):,} final, unique connections.")
        return connections_df

    def _process_and_load_connections(self) -> int:
        """DEPRECATED: This logic is now handled in run_mvp_etl directly."""
        # This function is kept for now to avoid breaking old entry points, but it should not be used.
        logger.warning("Using deprecated _process_and_load_connections function.")
        connections_df = self._build_all_connections()
        if not connections_df.empty:
            self._load_connections_batch(connections_df)
            return len(connections_df)
        return 0

    def _build_teammate_connections(self, rosters_df: pd.DataFrame, processed_pairs: set) -> list:
        """Build skill position teammate connections with rich metadata"""
        connections = []
        logger.info(f"Building skill position teammate connections...")
        season_rosters = rosters_df.groupby(['team', 'season', 'id']).first().reset_index()
        star_names = [
            'Patrick Mahomes', 'Josh Allen', 'Lamar Jackson', 'Aaron Rodgers',
            'Dak Prescott', 'Russell Wilson', 'Kyler Murray',
            'Christian McCaffrey', 'Derrick Henry', 'Nick Chubb', 'Austin Ekeler',
            'Saquon Barkley', 'Dalvin Cook', 'Alvin Kamara',
            'Justin Jefferson', 'Tyreek Hill', 'Davante Adams', 'Stefon Diggs',
            'DeAndre Hopkins', 'Mike Evans', 'Keenan Allen', 'DK Metcalf',
            'Travis Kelce', 'George Kittle', 'Mark Andrews', 'Darren Waller'
        ]
        star_connection_count = 0
        processed_teams = 0
        for (team, season), group in season_rosters.groupby(['team', 'season']):
            processed_teams += 1
            players = group['id'].dropna().unique().tolist()
            if len(players) > self.MAX_TEAM_SIZE:
                logger.warning(f"Large skill position team: {team} {season} has {len(players)} players")
            if processed_teams % 32 == 0:
                logger.info(f"Processed {processed_teams} team-seasons, {len(connections)} connections so far")
            for i, player1 in enumerate(players):
                for player2 in players[i+1:]:
                    pair = tuple(sorted((player1, player2)))
                    
                    # Use a key that matches the DB primary key structure
                    pair_key = pair + ('teammate',)
                    if pair_key in processed_pairs:
                        continue

                    if len(connections) >= self.MAX_TOTAL_CONNECTIONS:
                        logger.warning(f"🚨 Hit connection limit ({self.MAX_TOTAL_CONNECTIONS})")
                        return connections
                    p1_data = group[group['id'] == player1].iloc[0]
                    p2_data = group[group['id'] == player2].iloc[0]
                    p1_is_star = any(p1_data['player_name'].find(star.split()[-1]) != -1 for star in star_names)
                    p2_is_star = any(p2_data['player_name'].find(star.split()[-1]) != -1 for star in star_names)
                    if p1_is_star or p2_is_star:
                        star_connection_count += 1
                    metadata = {
                        'team': team,
                        'season': int(season),
                        'position_combo': f"{p1_data['position']}-{p2_data['position']}",
                        'is_qb_skill': (
                            (p1_data['position'] == 'QB' and p2_data['position'] in ['WR', 'TE', 'RB']) or
                            (p2_data['position'] == 'QB' and p1_data['position'] in ['WR', 'TE', 'RB'])
                        ),
                        'is_receiving_corps': (
                            p1_data['position'] in ['WR', 'TE'] and p2_data['position'] in ['WR', 'TE']
                        ),
                        'is_backfield': (
                            p1_data['position'] in ['QB', 'RB'] and p2_data['position'] in ['QB', 'RB']
                        ),
                        'involves_star': p1_is_star or p2_is_star
                    }

                    # Ensure consistent ordering for the primary key
                    p1_id_final, p2_id_final = pair

                    connections.append({
                        'player1_id': p1_id_final,
                        'player2_id': p2_id_final,
                        'connection_type': 'teammate',
                        'metadata': metadata
                    })
                    processed_pairs.add(pair_key)
        logger.info(f"Created {len(connections)} skill position teammate connections")
        logger.info(f"Star player connections: {star_connection_count}")
        return connections
    
    def _build_college_connections(self, rosters_df: pd.DataFrame, processed_pairs: set) -> list:
        """Enhanced college connections for skill positions"""
        connections = []
        logger.info("Building skill position college connections...")
        skill_players_with_college = rosters_df[
            (rosters_df['college'].notna()) &
            (rosters_df['college'] != 'Unknown') &
            (rosters_df['college'] != '') &
            (rosters_df['position'].isin(['QB', 'RB', 'WR', 'TE']))
        ][['id', 'college', 'player_name', 'position']].drop_duplicates()
        for college, group in skill_players_with_college.groupby('college'):
            players = group['id'].tolist()
            if len(players) > self.MAX_COLLEGE_PLAYERS:
                positions = group['position'].unique()
                balanced_players = []
                players_per_position = self.MAX_COLLEGE_PLAYERS // len(positions)
                for pos in positions:
                    pos_players = group[group['position'] == pos]['id'].tolist()
                    balanced_players.extend(pos_players[:players_per_position])
                remaining_slots = self.MAX_COLLEGE_PLAYERS - len(balanced_players)
                other_players = [p for p in players if p not in balanced_players]
                balanced_players.extend(other_players[:remaining_slots])
                players = balanced_players
                logger.info(f"Balanced college network for {college}: {len(players)} skill position players")
            if len(players) >= 2:
                for i, player1 in enumerate(players):
                    for player2 in players[i+1:]:
                        
                        # Use a unique tuple for the check to allow same pair with different types
                        pair_key = tuple(sorted((player1, player2))) + ('college',)
                        if pair_key in processed_pairs:
                            continue

                        p1_pos = group[group['id'] == player1]['position'].iloc[0]
                        p2_pos = group[group['id'] == player2]['position'].iloc[0]
                        
                        p1_id_final, p2_id_final = min(player1, player2), max(player1, player2)

                        connections.append({
                            'player1_id': p1_id_final,
                            'player2_id': p2_id_final,
                            'connection_type': 'college',
                            'metadata': {
                                'college': college,
                                'position_combo': f"{p1_pos}-{p2_pos}",
                                'same_position': p1_pos == p2_pos
                            }
                        })
                        processed_pairs.add(pair_key)

        logger.info(f"Created {len(connections)} skill position college connections")
        return connections
    
    def _build_draft_connections(self, rosters_df: pd.DataFrame, processed_pairs: set) -> list:
        """Draft connections with ultra-safe limits"""
        connections = []
        
        logger.info("Building draft connections with strict limits...")
        
        players_with_draft = rosters_df[
            (rosters_df['draft_year'].notna()) & 
            (rosters_df['draft_year'] > 0)
        ][['id', 'draft_year']].drop_duplicates()
        
        for draft_year, group in players_with_draft.groupby('draft_year'):
            players = group['id'].tolist()
            
            # STRICT draft class limit  
            if len(players) > self.MAX_DRAFT_PLAYERS:
                players = players[:self.MAX_DRAFT_PLAYERS]
            
            if len(players) >= 2:
                for i, player1 in enumerate(players):
                    for player2 in players[i+1:]:

                        # Use a unique tuple for the check to allow same pair with different types
                        pair_key = tuple(sorted((player1, player2))) + ('draft_class',)
                        if pair_key in processed_pairs:
                            continue
                        
                        p1_id_final, p2_id_final = min(player1, player2), max(player1, player2)

                        connections.append({
                            'player1_id': p1_id_final,
                            'player2_id': p2_id_final,
                            'connection_type': 'draft_class',
                            'metadata': {'draft_year': int(draft_year)}
                        })
                        processed_pairs.add(pair_key)
        
        logger.info(f"Created {len(connections)} draft connections")
        return connections
    
    def _build_position_connections(self, rosters_df: pd.DataFrame) -> list:
        """Enhanced position connections for skill positions"""
        connections = []
        if self.connection_count >= self.MAX_TOTAL_CONNECTIONS:
            return connections
        logger.info("Building enhanced skill position connections...")
        recent_players = rosters_df[rosters_df['season'] >= 2022]
        players_by_position = recent_players[
            recent_players['position'].isin(['QB', 'RB', 'WR', 'TE'])
        ][['id', 'position', 'player_name']].drop_duplicates()
        for position in ['QB', 'RB', 'WR', 'TE']:
            position_players = players_by_position[
                players_by_position['position'] == position
            ]
            players = position_players['id'].tolist()
            if len(players) > self.MAX_POSITION_PLAYERS:
                players = players[:self.MAX_POSITION_PLAYERS]
            if len(players) >= 2:
                logger.info(f"Connecting {len(players)} {position} players")
                for i, player1 in enumerate(players):
                    for player2 in players[i+1:]:
                        if self.connection_count + len(connections) >= self.MAX_TOTAL_CONNECTIONS:
                            return connections
                        connections.append({
                            'player1_id': player1,
                            'player2_id': player2,
                            'connection_type': 'position',
                            'metadata': {
                                'position': position,
                                'skill_position_network': True
                            }
                        })
        logger.info(f"Created {len(connections)} skill position connections")
        return connections
    
    def _create_indexes(self):
        """Create indexes for fast pathfinding queries"""
        logger.info("Creating database indexes...")
        
        with self.engine.connect() as conn:
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_connections_player1 
                ON player_connections(player1_id, connection_type)
            """))
            
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_connections_player2 
                ON player_connections(player2_id, connection_type)
            """))
            
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_players_name 
                ON players(name)
            """))
            
            conn.commit()
        
        logger.info("Indexes created successfully")

    def _log_skill_position_stats(self, rosters_df: pd.DataFrame):
        """Comprehensive skill position analysis"""
        total_players = rosters_df['player_name'].nunique()
        logger.info(f"📊 SKILL POSITION ANALYSIS:")
        logger.info(f"   Total skill position players: {total_players:,}")
        position_stats = rosters_df.groupby('position')['player_name'].nunique().sort_values(ascending=False)
        for pos, count in position_stats.items():
            logger.info(f"   {pos}: {count:,} unique players")
        team_season_stats = rosters_df.groupby(['team', 'season']).size()
        logger.info(f"   Avg skill players per team-season: {team_season_stats.mean():.1f}")
        logger.info(f"   Max skill players per team-season: {team_season_stats.max()}")
        logger.info(f"   Min skill players per team-season: {team_season_stats.min()}")
        star_names = ['Jefferson', 'Mahomes', 'McCaffrey', 'Kelce', 'Allen', 'Henry']
        logger.info("   Star player verification:")
        for star in star_names:
            star_records = rosters_df[rosters_df['player_name'].str.contains(star, case=False, na=False)]
            if len(star_records) > 0:
                teams = star_records[['team', 'season']].drop_duplicates()
                logger.info(f"     {star}: {len(star_records)} records across {len(teams)} team-seasons")
            else:
                logger.warning(f"     {star}: NOT FOUND")
        position_combos = rosters_df.groupby(['team', 'season'])['position'].apply(
            lambda x: '-'.join(sorted(x.unique()))
        ).value_counts().head(10)
        logger.info("   Most common position combinations per team:")
        for combo, count in position_combos.items():
            logger.info(f"     {combo}: {count} team-seasons")

    def _normalize_team_abbr(self, team_abbr: str) -> str:
        """Normalizes a team abbreviation to its canonical form."""
        return TEAM_ABBR_NORMALIZATION_MAP.get(team_abbr, team_abbr)

    def _extract_and_load_teams(self):
        """Extracts team descriptions and loads them into the teams table."""
        logger.info("Extracting and loading teams...")
        try:
            team_desc_df = nfl.import_team_desc()
            
            # --- NORMALIZATION ---
            team_desc_df['team_abbr'] = team_desc_df['team_abbr'].apply(self._normalize_team_abbr)
            team_desc_df['team_name'] = team_desc_df['team_name'].replace(TEAM_NAME_NORMALIZATION_MAP)
            team_desc_df.drop_duplicates(subset=['team_abbr'], keep='last', inplace=True)
            logger.info(f"Normalized teams. Count after deduplication: {len(team_desc_df)}")
            # --- END NORMALIZATION ---

            teams_to_load = team_desc_df[[
                'team_abbr', 'team_name', 'team_division', 'team_conf'
            ]].copy()
            
            teams_to_load.rename(columns={
                'team_abbr': 'id',
                'team_name': 'name',
                'team_division': 'division',
                'team_conf': 'conference'
            }, inplace=True)
            
            teams_to_load['abbreviation'] = teams_to_load['id']

            teams_to_load = teams_to_load[['id', 'name', 'abbreviation', 'division', 'conference']]

            if hasattr(self, '_dry_run') and self._dry_run:
                 logger.info(f"DRY RUN - Would load {len(teams_to_load)} teams.")
            else:
                teams_to_load.to_sql(
                    'teams',
                    self.engine,
                    if_exists='append',
                    index=False,
                    method='multi'
                )
                logger.info(f"Loaded {len(teams_to_load)} teams.")
            
            return len(teams_to_load)
        except Exception as e:
            logger.error(f"Failed to load teams: {e}")
            raise

    def _calculate_and_load_team_season_leaders(self, all_stats_df: pd.DataFrame, gsis_to_canonical_map: dict):
        """Calculates and loads team season leaders for passing, rushing, and receiving."""
        logger.info("Calculating and loading team season leaders...")
        
        try:
            stats_df = all_stats_df.copy()

            if 'team' not in stats_df.columns:
                logger.error("Could not find a team column in seasonal stats. Skipping leader calculation.")
                return 0

            stats_df['player_id'] = stats_df['gsis_id'].map(gsis_to_canonical_map)
            
            logger.info(f"[DEBUG] Team leader stats shape before dropna: {stats_df.shape}")
            stats_df.dropna(subset=['player_id', 'team'], inplace=True)
            logger.info(f"[DEBUG] Team leader stats shape after dropna: {stats_df.shape}")

            if stats_df.empty:
                logger.warning("No stats data available to calculate team leaders.")
                return 0

            stat_cols = ['passing_yards', 'rushing_yards', 'receiving_yards', 'receptions']
            for col in stat_cols:
                if col not in stats_df.columns:
                    stats_df[col] = 0
                else:
                    stats_df[col] = pd.to_numeric(stats_df[col], errors='coerce').fillna(0)

            # Find leader records
            passing_leaders_df = stats_df.loc[stats_df.groupby(['season', 'team'])['passing_yards'].idxmax()]
            rushing_leaders_df = stats_df.loc[stats_df.groupby(['season', 'team'])['rushing_yards'].idxmax()]
            
            # Format passing_leader into a JSON object
            passing_leader_series = passing_leaders_df.apply(
                lambda row: {
                    'player_id': row['player_id'],
                    'player_name': row['player_name'],
                    'position': row.get('position', 'UNK'),
                    'passing_yards': row['passing_yards'],
                    'passing_tds': row.get('passing_tds', 0)
                },
                axis=1
            )
            passing_leaders = pd.DataFrame({
                'season': passing_leaders_df['season'],
                'team': passing_leaders_df['team'],
                'passing_leader': passing_leader_series
            }).set_index(['season', 'team'])

            # Format rushing_leader into a JSON object
            rushing_leader_series = rushing_leaders_df.apply(
                lambda row: {
                    'player_id': row['player_id'],
                    'player_name': row['player_name'],
                    'position': row.get('position', 'UNK'),
                    'rushing_yards': row['rushing_yards'],
                    'rushing_tds': row.get('rushing_tds', 0)
                },
                axis=1
            )
            rushing_leaders = pd.DataFrame({
                'season': rushing_leaders_df['season'],
                'team': rushing_leaders_df['team'],
                'rushing_leader': rushing_leader_series
            }).set_index(['season', 'team'])
            
            receiving_leaders_df = stats_df[stats_df['receiving_yards'] > 0].sort_values('receiving_yards', ascending=False)
            receiving_leaders = receiving_leaders_df.groupby(['season', 'team']) \
                .apply(lambda x: x.head(3)[['player_id', 'player_name', 'position', 'receiving_yards', 'receptions']].to_dict('records')) \
                .reset_index(name='receiving_leaders').set_index(['season', 'team'])

            # Merge all leaders together
            team_leaders = pd.merge(passing_leaders, rushing_leaders, on=['season', 'team'], how='outer')
            team_leaders = pd.merge(team_leaders, receiving_leaders, on=['season', 'team'], how='outer')
            
            team_leaders.reset_index(inplace=True)
            team_leaders.rename(columns={'team': 'team_id'}, inplace=True)
            
            # Ensure JSON columns don't have NaN values which cause loading issues
            team_leaders['passing_leader'] = team_leaders['passing_leader'].where(pd.notna(team_leaders['passing_leader']), None)
            team_leaders['rushing_leader'] = team_leaders['rushing_leader'].where(pd.notna(team_leaders['rushing_leader']), None)
            team_leaders['receiving_leaders'] = team_leaders['receiving_leaders'].where(pd.notna(team_leaders['receiving_leaders']), None)
            
            if hasattr(self, '_dry_run') and self._dry_run:
                logger.info(f"DRY RUN - Would load {len(team_leaders)} team season leader records.")
            else:
                team_leaders.to_sql(
                    'team_season_leaders',
                    self.engine,
                    if_exists='append',
                    index=False,
                    method='multi',
                    dtype={'passing_leader': JSON, 'rushing_leader': JSON, 'receiving_leaders': JSON}
                )
                logger.info(f"Loaded {len(team_leaders)} team season leader records.")

            return len(team_leaders)

        except Exception as e:
            logger.error(f"Failed to calculate and load team season leaders: {e}", exc_info=True)
            raise

    def extract_and_load_seasonal_stats(self, players_df: pd.DataFrame, all_stats_df: pd.DataFrame):
        """Extracts and loads seasonal player stats using a canonical ID mapping."""
        logger.info("Processing and loading seasonal player stats...")
        
        if 'gsis_id' not in players_df.columns or 'id' not in players_df.columns:
            logger.warning("Player data is missing 'id' or 'gsis_id' columns, skipping stats.")
            return 0, {}
            
        id_map_df = players_df.dropna(subset=['gsis_id'])
        gsis_to_canonical_map = pd.Series(id_map_df.id.values, index=id_map_df.gsis_id).to_dict()

        if not gsis_to_canonical_map:
            logger.warning("No players with gsis_id to map, skipping seasonal stats.")
            return 0, {}

        # The stats are already loaded, just need to process them
        stats_df = all_stats_df.copy()
        
        # Map gsis_id to our canonical player_id
        stats_df['player_id'] = stats_df['gsis_id'].map(gsis_to_canonical_map)
        
        stats_df.dropna(subset=['player_id'], inplace=True)

        if stats_df.empty:
            logger.warning("No matching seasonal stats found for players in the database.")
            return 0, {}

        # Select and clean relevant columns
        stat_cols = [
            'player_id', 'season',
            'fantasy_points', 'fantasy_points_ppr',
            'passing_yards', 'passing_tds', 'interceptions',
            'rushing_yards', 'rushing_tds', 'carries',
            'receiving_yards', 'receiving_tds', 'receptions', 'targets'
        ]
        
        existing_stat_cols = [col for col in stat_cols if col in stats_df.columns]
        stats_to_load = stats_df[existing_stat_cols].copy()

        for col in stats_to_load.columns:
            if pd.api.types.is_numeric_dtype(stats_to_load[col]):
                stats_to_load[col] = stats_to_load[col].fillna(0)

        logger.info(f"Loading {len(stats_to_load)} seasonal stat records...")
        stats_to_load.to_sql(
            'player_seasonal_stats',
            self.engine,
            if_exists='append',
            index=False,
            method='multi',
            chunksize=500
        )
        logger.info("Seasonal stats loaded successfully.")
        return len(stats_to_load), gsis_to_canonical_map

    def run_mvp_etl(self):
        """Main ETL process for MVP - using weekly data for accuracy"""
        logger.info("Starting MVP ETL Pipeline with weekly data processing...")
        start_time = datetime.now()
        
        try:
            # Step 1: Fetch all weekly stats to get the most accurate data source
            logger.info("Fetching all weekly stats for all years...")
            
            weekly_data_frames = []
            for year in self.years:
                try:
                    logger.info(f"Fetching weekly data for {year}...")
                    year_weekly_data = nfl.import_weekly_data([year])
                    weekly_data_frames.append(year_weekly_data)
                except urllib.error.HTTPError as e:
                    logger.warning(f"HTTP Error fetching data for {year}, it might not be available yet. Skipping. Error: {e}")
                    continue
                except Exception as e:
                    logger.warning(f"An unexpected error occurred fetching data for {year}. Skipping. Error: {e}")
                    continue
            
            if not weekly_data_frames:
                logger.error("Failed to fetch any weekly data for the specified years. Aborting pipeline.")
                raise Exception("No weekly data could be fetched.")

            # --- NEW: Load roster data to get game_type for filtering seasonal stats ---
            logger.info("Fetching weekly rosters to get game_type for stats filtering...")
            roster_frames = []
            for year in self.years:
                try:
                    # Note: import_weekly_rosters is what has game_type
                    year_rosters = nfl.import_weekly_rosters([year])
                    roster_frames.append(year_rosters)
                except Exception as e:
                    logger.warning(f"Could not load weekly rosters for {year} to get game_type: {e}")
            
            all_rosters_df = pd.concat(roster_frames, ignore_index=True) if roster_frames else pd.DataFrame()
            # --- END NEW ---

            all_weekly_stats_df = pd.concat(
                weekly_data_frames,
                ignore_index=True
            )
            logger.info(f"Successfully fetched weekly data. Shape: {all_weekly_stats_df.shape}")

            # Standardize gsis_id column name for mapping
            if 'player_id' in all_weekly_stats_df.columns:
                all_weekly_stats_df.rename(columns={'player_id': 'gsis_id'}, inplace=True)

            # --- NEW: Merge game_type into stats dataframe ---
            if not all_rosters_df.empty:
                if 'player_id' in all_rosters_df.columns:
                    all_rosters_df.rename(columns={'player_id': 'gsis_id'}, inplace=True)
                
                game_type_info = all_rosters_df[['gsis_id', 'season', 'week', 'game_type']].drop_duplicates()
                all_weekly_stats_df = pd.merge(all_weekly_stats_df, game_type_info, on=['gsis_id', 'season', 'week'], how='left')
                logger.info("Merged game_type column into weekly stats for accurate filtering.")
            # --- END NEW ---

            # --- Identify Significant Players ---
            # We still need a concept of "significant" players to build our player graph around.
            # We'll derive this from the weekly data itself.
            stat_cols_for_significance = ['fantasy_points_ppr', 'passing_yards', 'rushing_yards', 'receiving_yards']
            for col in stat_cols_for_significance:
                if col in all_weekly_stats_df.columns:
                    all_weekly_stats_df[col] = pd.to_numeric(all_weekly_stats_df[col], errors='coerce').fillna(0)
            
            # Aggregate weekly data to find players with meaningful seasonal totals.
            seasonal_totals_for_filtering = all_weekly_stats_df.groupby(['gsis_id', 'season'])['fantasy_points_ppr'].sum().reset_index()
            significant_players_df = seasonal_totals_for_filtering[seasonal_totals_for_filtering['fantasy_points_ppr'] > 1]
            significant_gsis_ids = set(significant_players_df['gsis_id'].dropna().unique())
            logger.info(f"Identified {len(significant_gsis_ids)} significant players based on weekly data totals.")

            # --- Map GSIS IDs to ESB IDs (Canonical ID) ---
            logger.info("Mapping significant GSIS IDs to ESB IDs for canonical ID...")
            players_master = nfl.import_players()
            id_map = players_master.dropna(subset=['gsis_id', 'esb_id'])[['gsis_id', 'esb_id']]
            gsis_to_esb_map = pd.Series(id_map.esb_id.values, index=id_map.gsis_id).to_dict()
            significant_esb_ids = {gsis_to_esb_map.get(gsis_id) for gsis_id in significant_gsis_ids}
            significant_esb_ids.discard(None)
            logger.info(f"Mapped to {len(significant_esb_ids)} significant ESB IDs.")

            # Step 2: Extract and clean player data, filtered by significance
            # Pass the loaded rosters to avoid re-fetching
            players_df = self.extract_players(significant_esb_ids, rosters=all_rosters_df)
            
            # --- Perform Aggregations from Weekly Data ---
            # Filter the full weekly data to our significant players before aggregation
            weekly_df_filtered = all_weekly_stats_df[all_weekly_stats_df['gsis_id'].isin(significant_gsis_ids)].copy()
            
            # Standardize team column name
            team_col = next((col for col in ['recent_team', 'team', 'player_team'] if col in weekly_df_filtered.columns), None)
            if team_col:
                if team_col != 'team':
                    weekly_df_filtered.rename(columns={team_col: 'team'}, inplace=True)
            else:
                # If no team column, we might be able to get it from the roster data
                if not all_rosters_df.empty:
                    team_info = all_rosters_df[['gsis_id', 'season', 'week', 'team']].drop_duplicates()
                    weekly_df_filtered = pd.merge(weekly_df_filtered, team_info, on=['gsis_id', 'season', 'week'], how='left')
                    logger.info("Added 'team' column from roster data to stats data.")

            if 'team' not in weekly_df_filtered.columns:
                 raise ValueError("Could not find or add a team column in the weekly stats data.")

            # --- NORMALIZE TEAM ABBRS IN WEEKLY STATS ---
            logger.info("Normalizing team abbreviations in weekly stats data...")
            weekly_df_filtered['team'] = weekly_df_filtered['team'].apply(self._normalize_team_abbr)
            # --- END NORMALIZATION ---

            # --- FILTER FOR REGULAR SEASON ONLY ---
            # This is the key fix to exclude inflated playoff stats from seasonal totals.
            if 'game_type' in weekly_df_filtered.columns:
                logger.info("Filtering weekly stats to REGULAR SEASON only...")
                original_rows = len(weekly_df_filtered)
                weekly_df_filtered = weekly_df_filtered[weekly_df_filtered['game_type'] == 'REG'].copy()
                logger.info(f"  → Filtered rows: {original_rows:,} → {len(weekly_df_filtered):,}")
            else:
                logger.warning("Could not find 'game_type' column to filter for regular season. Stats may include playoffs.")
            # --- END FILTER ---

            # Define stat columns for aggregation
            stat_columns = [
                'fantasy_points', 'fantasy_points_ppr',
                'passing_yards', 'passing_tds', 'interceptions',
                'rushing_yards', 'rushing_tds', 'carries',
                'receiving_yards', 'receiving_tds', 'receptions', 'targets'
            ]
            for col in stat_columns:
                if col not in weekly_df_filtered.columns: weekly_df_filtered[col] = 0
                else: weekly_df_filtered[col] = pd.to_numeric(weekly_df_filtered[col], errors='coerce').fillna(0)

            # Aggregation 1: For Team Leader calculations (player stats are per-team)
            logger.info("Aggregating weekly stats for team leader calculations...")
            team_specific_stats_df = weekly_df_filtered.groupby(
                ['gsis_id', 'season', 'team']
            )[stat_columns].sum().reset_index()

            # Add player_name and position to the dataframe for the leader calculations.
            player_descriptors = weekly_df_filtered[['gsis_id', 'player_name', 'position']].drop_duplicates(subset=['gsis_id'])
            team_specific_stats_df = pd.merge(team_specific_stats_df, player_descriptors, on='gsis_id', how='left')
            
            logger.info(f"Created team-specific stats df with shape: {team_specific_stats_df.shape}")

            # Aggregation 2: For overall player seasonal stats (total stats for a player in a season)
            logger.info("Aggregating weekly stats for player_seasonal_stats table...")
            overall_player_stats_df = weekly_df_filtered.groupby(
                ['gsis_id', 'season']
            )[stat_columns].sum().reset_index()
            logger.info(f"Created overall seasonal stats df with shape: {overall_player_stats_df.shape}")

            # Now, proceed with loading data, using these new accurate dataframes
            players_count = len(players_df)
            teams_count = 0
            seasonal_stats_count = 0
            team_leaders_count = 0
            connections_count = 0
            
            # --- Build and deduplicate connections happens for both real and dry runs ---
            connections_df = self._build_all_connections()
            connections_count = len(connections_df)

            if hasattr(self, '_dry_run') and self._dry_run:
                logger.info("DRY RUN - Skipping database load")
            else:
                # Real run - load to database
                logger.info("REAL RUN - Loading to database...")
                self._clear_data_pipeline_tables()
                
                teams_count = self._extract_and_load_teams()
                logger.info(f"✅ Loaded {teams_count} teams")
                
                self._load_players(players_df)
                logger.info(f"✅ Loaded {players_count} players")
                
                # Load stats and leaders
                seasonal_stats_count, gsis_to_canonical_map = self.extract_and_load_seasonal_stats(players_df, overall_player_stats_df)
                logger.info(f"✅ Loaded {seasonal_stats_count} seasonal stat records")

                team_leaders_count = self._calculate_and_load_team_season_leaders(team_specific_stats_df, gsis_to_canonical_map)
                logger.info(f"✅ Loaded {team_leaders_count} team season leader records")
                
                # Apply global connection limit before loading
                if connections_count > self.MAX_TOTAL_CONNECTIONS:
                    logger.warning(f"Total connections ({connections_count}) exceeds limit ({self.MAX_TOTAL_CONNECTIONS}). Truncating.")
                    connections_df = connections_df.head(self.MAX_TOTAL_CONNECTIONS)
                    connections_count = self.MAX_TOTAL_CONNECTIONS

                # Finally, load the connections
                self._load_connections_batch(connections_df)
                logger.info(f"✅ Loaded {connections_count} connections")

                del players_df
                gc.collect()

                self._create_indexes()
                self._validate_data_quality()
            
            duration = datetime.now() - start_time
            logger.info(f"ETL completed successfully in {duration}")
            return {
                'players_count': players_count,
                'teams_count': teams_count,
                'connections_count': connections_count,
                'seasonal_stats_count': seasonal_stats_count,
                'team_leaders_count': team_leaders_count,
                'duration_seconds': duration.total_seconds(),
                'status': 'dry_run' if hasattr(self, '_dry_run') and self._dry_run else 'completed'
            }
        except Exception as e:
            logger.error(f"ETL pipeline failed: {e}")
            raise
        finally:
            # Always clean up temp file
            if os.path.exists(self.roster_temp_file):
                logger.info(f"Cleaning up temp file: {self.roster_temp_file}")
                try:
                    os.remove(self.roster_temp_file)
                except Exception as e:
                    logger.warning(f"Failed to remove temp file: {e}")
    
    def _validate_data_quality(self):
        """Basic data quality checks"""
        with self.engine.connect() as conn:
            player_count = conn.execute(text("SELECT COUNT(*) FROM players")).scalar()
            connection_count = conn.execute(text("SELECT COUNT(*) FROM player_connections")).scalar()
            
            try:
                teams_count = conn.execute(text("SELECT COUNT(*) FROM teams")).scalar()
            except Exception:
                teams_count = 0

            try:
                seasonal_stats_count = conn.execute(text("SELECT COUNT(*) FROM player_seasonal_stats")).scalar()
            except Exception:
                seasonal_stats_count = 0 # Table might not exist yet on first run
            
            try:
                team_leaders_count = conn.execute(text("SELECT COUNT(*) FROM team_season_leaders")).scalar()
            except Exception:
                team_leaders_count = 0
            
            orphaned = conn.execute(text("""
                SELECT COUNT(*) FROM player_connections pc
                WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.id = pc.player1_id)
                   OR NOT EXISTS (SELECT 1 FROM players p WHERE p.id = pc.player2_id)
            """)).scalar()
            
            logger.info(f"Data quality check - Players: {player_count}, Teams: {teams_count}, Connections: {connection_count}, Seasonal Stats: {seasonal_stats_count}, Team Leaders: {team_leaders_count}, Orphaned: {orphaned}")
            
            if orphaned > 0:
                logger.warning(f"Found {orphaned} orphaned connections!")

    def estimate_connection_count(self) -> dict:
        """Estimate connection count before building to avoid database explosion"""
        logger.info("🧮 ESTIMATING connection count...")
        
        try:
            # Extract players but don't build connections yet
            players_df = self.extract_players()
            
            if not os.path.exists(self.roster_temp_file):
                logger.error("Temp file not found for estimation")
                return {'safe': False, 'estimated_total': 0}
            
            # Load just the columns we need for estimation
            rosters_df = pd.read_parquet(
                self.roster_temp_file, 
                columns=['team', 'season', 'id', 'college', 'draft_year', 'position', 'player_name']
            )
            
            # 1. Estimate SEASON-LEVEL teammate connections
            season_rosters = rosters_df.groupby(['team', 'season', 'id']).first().reset_index()
            teammate_estimate = 0
            
            for (team, season), group in season_rosters.groupby(['team', 'season']):
                team_size = min(len(group), self.MAX_TEAM_SIZE)
                team_connections = (team_size * (team_size - 1)) // 2
                teammate_estimate += team_connections
                
                # Stop early if already too many
                if teammate_estimate > self.MAX_TOTAL_CONNECTIONS:
                    break
            
            # 2. Estimate college connections
            college_estimate = 0
            if teammate_estimate < self.MAX_TOTAL_CONNECTIONS:
                players_with_college = rosters_df[
                    (rosters_df['college'].notna()) & 
                    (rosters_df['college'] != 'Unknown')
                ][['id', 'college']].drop_duplicates()
                
                for college, group in players_with_college.groupby('college'):
                    college_size = min(len(group), self.MAX_COLLEGE_PLAYERS)
                    if college_size >= 2:
                        college_connections = (college_size * (college_size - 1)) // 2
                        college_estimate += college_connections
            
            # 3. Estimate draft connections
            draft_estimate = 0
            if teammate_estimate + college_estimate < self.MAX_TOTAL_CONNECTIONS:
                players_with_draft = rosters_df[
                    (rosters_df['draft_year'].notna()) & 
                    (rosters_df['draft_year'] > 0)
                ][['id', 'draft_year']].drop_duplicates()
                
                for draft_year, group in players_with_draft.groupby('draft_year'):
                    draft_size = min(len(group), self.MAX_DRAFT_PLAYERS)
                    if draft_size >= 2:
                        draft_connections = (draft_size * (draft_size - 1)) // 2
                        draft_estimate += draft_connections
            
            total_estimate = teammate_estimate + college_estimate + draft_estimate
            
            # Apply the hard cap
            capped_estimate = min(total_estimate, self.MAX_TOTAL_CONNECTIONS)
            
            logger.info(f"📊 CONNECTION ESTIMATES:")
            logger.info(f"   Players: {len(players_df):,}")
            logger.info(f"   Teammate connections: {teammate_estimate:,}")
            logger.info(f"   College connections: {college_estimate:,}")
            logger.info(f"   Draft connections: {draft_estimate:,}")
            logger.info(f"   Total estimated: {total_estimate:,}")
            logger.info(f"   After cap ({self.MAX_TOTAL_CONNECTIONS}): {capped_estimate:,}")
            logger.info(f"   Estimated DB size: ~{capped_estimate * 0.1:.1f}KB")
            
            # Safety assessment
            is_safe = capped_estimate <= self.MAX_TOTAL_CONNECTIONS
            
            if is_safe:
                logger.info("✅ Connection count looks SAFE for database")
            else:
                logger.warning("⚠️ Connection count may be too high")
            
            return {
                'safe': is_safe,
                'players': len(players_df),
                'teammate_connections': teammate_estimate,
                'college_connections': college_estimate,
                'draft_connections': draft_estimate,
                'estimated_total': total_estimate,
                'capped_total': capped_estimate
            }
            
        except Exception as e:
            logger.error(f"Estimation failed: {e}")
            return {'safe': False, 'estimated_total': 0}
        
    def run_safe_dry_run(self):
        """Run a completely safe dry run that only estimates, doesn't build connections"""
        logger.info("🧪 SAFE DRY RUN - Estimation only...")
        
        try:
            # Set dry run flag
            self._dry_run = True
            
            # Run the estimation
            estimates = self.estimate_connection_count()
            
            logger.info(f"🧪 SAFE DRY RUN Results:")
            logger.info(f"   Players: {estimates.get('players', 0):,}")
            logger.info(f"   Teammate connections: {estimates.get('teammate_connections', 0):,}")
            logger.info(f"   College connections: {estimates.get('college_connections', 0):,}")
            logger.info(f"   Draft connections: {estimates.get('draft_connections', 0):,}")
            logger.info(f"   Total estimated: {estimates.get('estimated_total', 0):,}")
            logger.info(f"   After safety cap: {estimates.get('capped_total', 0):,}")
            
            is_safe = estimates.get('safe', False)
            if is_safe:
                logger.info("✅ VERDICT: Safe to run full ETL")
                logger.info("   Next step: uv run python mvp_pipeline.py --db-url $DATABASE_URL")
            else:
                logger.warning("❌ VERDICT: Reduce scope before running full ETL")
                logger.warning("   Try reducing year range or connection limits")
            
            return estimates
            
        except Exception as e:
            logger.error(f"Safe dry run failed: {e}")
            return {'safe': False, 'error': str(e)}


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Run NFL MVP ETL Pipeline')
    parser.add_argument('--db-url', required=True, help='PostgreSQL database URL')
    parser.add_argument('--dry-run', action='store_true', help='Run with safe estimation')
    parser.add_argument('--estimate-only', action='store_true', help='Only estimate, don\'t extract data')
    parser.add_argument('--safe-test', action='store_true', help='Run safest possible test')
    
    args = parser.parse_args()
    
    pipeline = MVPETLPipeline(args.db_url)
    
    if args.estimate_only:
        # Quick estimation without data extraction
        logger.info("ESTIMATION MODE - Quick connection count estimate...")
        
        # Use a smaller sample for ultra-fast estimation
        pipeline.years = [2024]  # Just current year
        estimates = pipeline.estimate_connection_count()
        
        logger.info(f"Quick estimate (1 year): {estimates.get('capped_total', 0):,} connections")
        estimated_full = estimates.get('capped_total', 0) * len(pipeline.years)
        logger.info(f"Projected full scope: ~{estimated_full:,} connections")
        
        if estimated_full <= pipeline.MAX_TOTAL_CONNECTIONS:
            logger.info("✅ Full scope looks safe")
        else:
            logger.warning("❌ Full scope may exceed limits")
            
    elif args.safe_test:
        # Safest possible test
        logger.info("SAFE TEST MODE - Ultra-conservative estimation...")
        pipeline.years = [2024]  # Just 1 year
        pipeline.MAX_TOTAL_CONNECTIONS = 5000  # Lower limit
        result = pipeline.run_safe_dry_run()
        
    elif args.dry_run:
        # Standard dry run with estimation
        logger.info("DRY RUN MODE - Safe estimation with data extraction...")
        pipeline._dry_run = True
        result = pipeline.run_mvp_etl()
        logger.info(f"Would load {result['players_count']} players and {result['connections_count']} connections")
        
    else:
        # Real run
        logger.info("REAL RUN MODE - Loading to database...")
        result = pipeline.run_mvp_etl()
        logger.info(f"ETL Result: {result}")
