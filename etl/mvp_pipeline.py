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
        self.start_year = 2020  # REDUCED to just 3 years for ultra-safety
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
        
        # Define table schema for automatic creation
        self.metadata = MetaData()
        self.players_table = Table('players', self.metadata,
            Column('id', String, primary_key=True),
            Column('name', String, nullable=False),
            Column('position', String),
            Column('college', String),
            Column('draft_year', Integer),
            Column('teams', JSON),
            Column('first_season', Integer),
            Column('last_season', Integer)
        )
        self.connections_table = Table('player_connections', self.metadata,
            Column('player1_id', String, primary_key=True),
            Column('player2_id', String, primary_key=True),
            Column('connection_type', String, primary_key=True),
            Column('metadata', JSON)
        )
        self.seasonal_stats_table = Table('player_seasonal_stats', self.metadata,
            Column('id', Integer, primary_key=True, autoincrement=True),
            Column('player_id', String, index=True),
            Column('season', Integer),
            Column('fantasy_points', Float),
            Column('fantasy_points_ppr', Float),
            Column('passing_yards', Float),
            Column('passing_tds', Float),
            Column('interceptions', Float),
            Column('rushing_yards', Float),
            Column('rushing_tds', Float),
            Column('carries', Float),
            Column('receiving_yards', Float),
            Column('receiving_tds', Float),
            Column('receptions', Float),
            Column('targets', Float),
            UniqueConstraint('player_id', 'season', name='uq_player_season_stats')
        )
        
    def _create_tables_if_not_exist(self):
        """Creates the database tables if they don't already exist."""
        logger.info("Ensuring database tables exist...")
        self.metadata.create_all(self.engine)
        logger.info("Tables checked/created successfully.")
        
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
            'display_name': 'display_name_master'
        })
        
        merged = rosters.merge(master_to_merge, on='esb_id', how='left')
        
        print(f"🔍 After merge shape: {merged.shape} (should be close to roster size: {rosters.shape[0]})")
        
        merged['player_name'] = merged['display_name_master'].fillna(merged['player_name'])
        merged['college'] = merged['college_master'].fillna(merged['college'])
        merged['position'] = merged['position_master'].fillna(merged['position'])
        
        columns_to_drop = ['display_name_master', 'college_master', 'position_master']
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
        """Replaces the players table with the new data, using batching."""
        logger.info("Loading players to database...")

        # Drop gsis_id before loading, it's not part of the final players table schema
        players_to_load = players_df.drop(columns=['gsis_id'], errors='ignore')

        batch_size = 500  # A very safe batch size for any environment
        total_batches = (len(players_to_load) - 1) // batch_size + 1

        try:
            # First batch replaces the table
            logger.info(f"  -> Loading player batch 1/{total_batches}")
            players_to_load.iloc[:batch_size].to_sql(
                'players',
                self.engine,
                if_exists='replace',
                index=False,
                method='multi'
            )
            time.sleep(0.05) # Give the DB a break

            # Subsequent batches append to the table
            for i in range(1, total_batches):
                logger.info(f"  -> Loading player batch {i + 1}/{total_batches}")
                start = i * batch_size
                end = start + batch_size
                players_to_load.iloc[start:end].to_sql(
                    'players',
                    self.engine,
                    if_exists='append',
                    index=False,
                    method='multi'
                )
                time.sleep(0.05) # Give the DB a break

            logger.info(f"Loaded {len(players_to_load)} players")
        except Exception as e:
            logger.error(f"Player database load failed: {e}")
            raise

    def _load_connections_batch(self, connections_df: pd.DataFrame, is_first_batch: bool = False):
        """Helper to load a DataFrame of connections in batches."""
        if connections_df.empty:
            return

        # On the first batch, we replace the table. On others, we append.
        if_exists_strategy = 'replace' if is_first_batch else 'append'
        
        batch_size = 500 # Reduced to a very safe size
        total_batches = (len(connections_df) - 1) // batch_size + 1
        
        # Each batch will now run in its own transaction, initiated by to_sql
        for i, start in enumerate(range(0, len(connections_df), batch_size)):
            end = start + batch_size
            batch = connections_df.iloc[start:end]
            try:
                batch.to_sql(
                    'player_connections',
                    self.engine, # Use the engine directly to allow auto-transactions
                    if_exists=if_exists_strategy,
                    index=False,
                    method='multi',
                    dtype={'metadata': JSON}
                )
                # After the first chunk of the first batch, all subsequent writes must be appends.
                if_exists_strategy = 'append'

                if total_batches > 1:
                    logger.info(f"  -> Loaded connection batch {i + 1}/{total_batches}")
                
                time.sleep(0.05) # Give the DB a small break after each batch

            except Exception as e:
                logger.error(f"Failed to load a batch of {len(connections_df)} connections.")
                raise e

    def _build_and_load_teammate_connections(self) -> int:
        """Processes and loads teammate connections from temp file year-by-year."""
        total_teammate_conns = 0
        
        rosters_cols = pd.read_parquet(self.roster_temp_file, columns=['season'])
        years = sorted(rosters_cols['season'].unique())
        del rosters_cols
        
        is_first_data_batch = True
        logger.info("Building and loading teammate connections year-by-year...")
        for year in years:
            rosters_for_year = pd.read_parquet(self.roster_temp_file, filters=[('season', '==', year)])
            connections = self._build_teammate_connections(rosters_for_year)

            if connections:
                connections_df = pd.DataFrame(connections)
                logger.info(f"Loading {len(connections_df)} teammate connections for {year}...")
                self._load_connections_batch(connections_df, is_first_batch=is_first_data_batch)
                total_teammate_conns += len(connections_df)
                is_first_data_batch = False # Only the very first batch can replace
                
        return total_teammate_conns

    def _process_and_load_connections(self) -> int:
        """Process connections with global tracking"""
        logger.info("Processing and loading connections with global limits...")
        
        self.connection_count = 0  # Reset counter
        
        # 1. Teammate connections (highest priority)
        logger.info("Building teammate connections...")
        rosters_cols = pd.read_parquet(self.roster_temp_file, columns=['season'])
        years = sorted(rosters_cols['season'].unique())
        del rosters_cols
        
        is_first_batch = True
        for year in years:
            if self.connection_count >= self.MAX_TOTAL_CONNECTIONS:
                logger.warning(f"Connection limit reached, stopping at year {year}")
                break
                
            rosters_for_year = pd.read_parquet(self.roster_temp_file, filters=[('season', '==', year)])
            connections = self._build_teammate_connections(rosters_for_year)
            
            if connections:
                connections_df = pd.DataFrame(connections)
                logger.info(f"Loading {len(connections_df)} teammate connections for {year}...")
                self._load_connections_batch(connections_df, is_first_batch=is_first_batch)
                self.connection_count += len(connections_df)
                is_first_batch = False
                
                logger.info(f"Total connections so far: {self.connection_count}/{self.MAX_TOTAL_CONNECTIONS}")
        
        # 2. Other connections (if room left)
        remaining_capacity = self.MAX_TOTAL_CONNECTIONS - self.connection_count
        if remaining_capacity > 100:  # Only if significant room left
            logger.info(f"Adding other connections (remaining capacity: {remaining_capacity})")
            
            other_rosters_df = pd.read_parquet(
                self.roster_temp_file, 
                columns=['id', 'college', 'player_name', 'draft_year', 'position', 'season']
            )
            
            # College connections
            if self.connection_count < self.MAX_TOTAL_CONNECTIONS:
                college_connections = self._build_college_connections(other_rosters_df)
                if college_connections:
                    connections_df = pd.DataFrame(college_connections)
                    self._load_connections_batch(connections_df, is_first_batch=False)
                    self.connection_count += len(connections_df)
                    logger.info(f"Total after college: {self.connection_count}/{self.MAX_TOTAL_CONNECTIONS}")
            
            # Draft connections (if still room)
            if self.connection_count < self.MAX_TOTAL_CONNECTIONS:
                draft_connections = self._build_draft_connections(other_rosters_df)
                if draft_connections:
                    connections_df = pd.DataFrame(draft_connections)
                    self._load_connections_batch(connections_df, is_first_batch=False)
                    self.connection_count += len(connections_df)
                    logger.info(f"Total after draft: {self.connection_count}/{self.MAX_TOTAL_CONNECTIONS}")
            
            del other_rosters_df
            gc.collect()
        
        logger.info(f"Final connection count: {self.connection_count}")
        return self.connection_count
    
    def _build_teammate_connections(self, rosters_df: pd.DataFrame) -> list:
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
                    connections.append({
                        'player1_id': player1,
                        'player2_id': player2,
                        'connection_type': 'teammate',
                        'metadata': metadata
                    })
        logger.info(f"Created {len(connections)} skill position teammate connections")
        logger.info(f"Star player connections: {star_connection_count}")
        return connections
    
    def _build_college_connections(self, rosters_df: pd.DataFrame) -> list:
        """Enhanced college connections for skill positions"""
        connections = []
        if self.connection_count >= self.MAX_TOTAL_CONNECTIONS:
            return connections
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
                        if self.connection_count + len(connections) >= self.MAX_TOTAL_CONNECTIONS:
                            return connections
                        p1_pos = group[group['id'] == player1]['position'].iloc[0]
                        p2_pos = group[group['id'] == player2]['position'].iloc[0]
                        connections.append({
                            'player1_id': player1,
                            'player2_id': player2,
                            'connection_type': 'college',
                            'metadata': {
                                'college': college,
                                'position_combo': f"{p1_pos}-{p2_pos}",
                                'same_position': p1_pos == p2_pos
                            }
                        })
        logger.info(f"Created {len(connections)} skill position college connections")
        return connections
    
    def _build_draft_connections(self, rosters_df: pd.DataFrame) -> list:
        """Draft connections with ultra-safe limits"""
        connections = []
        
        # Early exit if already at limit
        if self.connection_count >= self.MAX_TOTAL_CONNECTIONS:
            logger.warning("Already at connection limit, skipping draft connections")
            return connections
        
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
                        # EMERGENCY BRAKE
                        if self.connection_count + len(connections) >= self.MAX_TOTAL_CONNECTIONS:
                            logger.warning(f"Hit connection limit during draft connections")
                            return connections
                        
                        connections.append({
                            'player1_id': player1,
                            'player2_id': player2,
                            'connection_type': 'draft_class',
                            'metadata': {'draft_year': int(draft_year)}
                        })
        
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

    def extract_and_load_seasonal_stats(self, players_df: pd.DataFrame, all_stats_df: pd.DataFrame):
        """Extracts and loads seasonal player stats using a canonical ID mapping."""
        logger.info("Processing and loading seasonal player stats...")
        
        # Build a mapping from gsis_id to our canonical ID from the final player list
        if 'gsis_id' not in players_df.columns or 'id' not in players_df.columns:
            logger.warning("Player data is missing 'id' or 'gsis_id' columns, skipping stats.")
            return 0
            
        id_map_df = players_df.dropna(subset=['gsis_id'])
        gsis_to_canonical_map = pd.Series(id_map_df.id.values, index=id_map_df.gsis_id).to_dict()

        if not gsis_to_canonical_map:
            logger.warning("No players with gsis_id to map, skipping seasonal stats.")
            return 0

        # The stats are already loaded, just need to process them
        stats_df = all_stats_df.copy()
        
        # Map gsis_id to our canonical player_id
        stats_df['player_id'] = stats_df['gsis_id'].map(gsis_to_canonical_map)
        
        stats_df.dropna(subset=['player_id'], inplace=True)

        if stats_df.empty:
            logger.warning("No matching seasonal stats found for players in the database.")
            return 0

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
            if_exists='replace',
            index=False,
            method='multi',
            chunksize=500
        )
        logger.info("Seasonal stats loaded successfully.")
        return len(stats_to_load)

    def run_mvp_etl(self):
        """Main ETL process for MVP - with safe estimation and incremental loading"""
        logger.info("Starting MVP ETL Pipeline...")
        start_time = datetime.now()
        
        try:
            # Step 1: Fetch all seasonal stats to identify significant players
            logger.info("Fetching all seasonal stats to identify significant players...")
            all_stats = []
            for year in self.years:
                try:
                    logger.info(f"Fetching seasonal stats for {year}...")
                    year_stats = nfl.import_seasonal_data([year])
                    all_stats.append(year_stats)
                except Exception as e:
                    logger.warning(f"Could not fetch stats for {year}: {e}")
            
            if not all_stats:
                raise Exception("Failed to load any seasonal stats data. Cannot determine significant players.")
            
            all_stats_df = pd.concat(all_stats, ignore_index=True)
            if 'player_id' in all_stats_df.columns:
                all_stats_df.rename(columns={'player_id': 'gsis_id'}, inplace=True)
            
            # Identify players who have actually had some impact
            significant_players_df = all_stats_df[all_stats_df['fantasy_points_ppr'] > 1]
            significant_gsis_ids = set(significant_players_df['gsis_id'].dropna().unique())
            logger.info(f"Identified {len(significant_gsis_ids)} significant players with fantasy points > 1.")

            # NEW: Map GSIS IDs to ESB IDs for early filtering
            logger.info("Mapping significant GSIS IDs to ESB IDs for early filtering...")
            players_master = nfl.import_players()
            id_map = players_master.dropna(subset=['gsis_id', 'esb_id'])[['gsis_id', 'esb_id']]
            gsis_to_esb_map = pd.Series(id_map.esb_id.values, index=id_map.gsis_id).to_dict()

            significant_esb_ids = {gsis_to_esb_map.get(gsis_id) for gsis_id in significant_gsis_ids}
            significant_esb_ids.discard(None) # remove None if any gsis_id was not found
            logger.info(f"Mapped to {len(significant_esb_ids)} significant ESB IDs.")

            # Step 2: Extract and clean player data, filtered by significance
            players_df = self.extract_players(significant_esb_ids)
            players_count = len(players_df)
            
            if hasattr(self, '_dry_run') and self._dry_run:
                logger.info("DRY RUN - Skipping database load")
                logger.info("DRY RUN - Using safe estimation instead of building all connections...")
                estimates = self.estimate_connection_count()
                connections_count = estimates.get('capped_total', 0)
                logger.info(f"DRY RUN Results:")
                logger.info(f"  Players: {players_count}")
                logger.info(f"  Estimated connections: {connections_count}")
                logger.info(f"  Safety status: {'✅ SAFE' if estimates.get('safe', False) else '❌ UNSAFE'}")
            else:
                # Real run - load to database
                logger.info("REAL RUN - Loading to database...")
                
                # Step 3: Load players table
                self._load_players(players_df)
                logger.info(f"✅ Loaded {players_count} players")
                
                # Step 4: Load seasonal stats for these players
                seasonal_stats_count = self.extract_and_load_seasonal_stats(players_df, all_stats_df)
                logger.info(f"✅ Loaded {seasonal_stats_count} seasonal stat records")

                del players_df
                gc.collect()

                # Step 5: Build and load connections (will use the filtered temp file)
                connections_count = self._process_and_load_connections()
                logger.info(f"✅ Loaded {connections_count} connections")
                self._create_indexes()
                # SAFEGUARD: Remove orphaned connections
                with self.engine.connect() as conn:
                    result = conn.execute(text("""
                        DELETE FROM player_connections
                        WHERE player1_id NOT IN (SELECT id FROM players)
                           OR player2_id NOT IN (SELECT id FROM players)
                    """))
                    orphaned_deleted = result.rowcount if hasattr(result, 'rowcount') else 0
                    logger.info(f"🧹 Deleted {orphaned_deleted} orphaned connections after load.")
                self._validate_data_quality()
            
            duration = datetime.now() - start_time
            logger.info(f"ETL completed successfully in {duration}")
            return {
                'players_count': players_count,
                'connections_count': connections_count,
                'seasonal_stats_count': seasonal_stats_count,
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
                seasonal_stats_count = conn.execute(text("SELECT COUNT(*) FROM player_seasonal_stats")).scalar()
            except Exception:
                seasonal_stats_count = 0 # Table might not exist yet on first run
            
            orphaned = conn.execute(text("""
                SELECT COUNT(*) FROM player_connections pc
                WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.id = pc.player1_id)
                   OR NOT EXISTS (SELECT 1 FROM players p WHERE p.id = pc.player2_id)
            """)).scalar()
            
            logger.info(f"Data quality check - Players: {player_count}, Connections: {connection_count}, Seasonal Stats: {seasonal_stats_count}, Orphaned: {orphaned}")
            
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
