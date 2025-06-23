"""
Script to manage the database schema for non-ETL tables like users.
"""
import os
import argparse
import logging
from dotenv import load_dotenv
from sqlalchemy import (
    create_engine,
    MetaData,
    Table,
    Column,
    String,
    Integer,
    DateTime,
    ForeignKey,
    func,
    JSON,
    Float,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
import uuid

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def define_schema(metadata: MetaData):
    """Defines all tables in the database schema."""
    Table('players', metadata,
        Column('id', String, primary_key=True),
        Column('name', String, nullable=False),
        Column('position', String),
        Column('college', String),
        Column('draft_year', Integer),
        Column('teams', JSON),
        Column('first_season', Integer),
        Column('last_season', Integer)
    )

    Table('teams', metadata,
        Column('id', String, primary_key=True),
        Column('name', String, nullable=False),
        Column('abbreviation', String(3)),
        Column('division', String),
        Column('conference', String)
    )

    Table('users', metadata,
        Column('id', String, primary_key=True),
        Column('name', String, nullable=False),
        Column('username', String, unique=True, nullable=True),
        Column('imageUrl', String, nullable=False),
        Column('createdAt', DateTime, server_default=func.now()),
        Column('updatedAt', DateTime, server_default=func.now(), onupdate=func.now())
    )
    
    Table('user_stats', metadata,
        Column('user_id', String, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        Column('single_player_high_score', Integer, nullable=False, server_default='0'),
        Column('multiplayer_wins', Integer, nullable=False, server_default='0'),
        Column('multiplayer_losses', Integer, nullable=False, server_default='0'),
        Column('updatedAt', DateTime, server_default=func.now(), onupdate=func.now())
    )
    
    Table('game_sessions', metadata,
        Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        Column('game_type', String, nullable=False, server_default='player_rush'),
        Column('game_mode', String, nullable=False), # 'single' or 'multiplayer'
        Column('difficulty', String, nullable=False), # 'easy', 'medium', 'hard'
        Column('player1_id', String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        Column('player2_id', String, ForeignKey('users.id', ondelete='CASCADE'), nullable=True),
        Column('start_player_id', String, ForeignKey('players.id', ondelete='CASCADE'), nullable=False),
        Column('end_player_id', String, ForeignKey('players.id', ondelete='CASCADE'), nullable=False),
        Column('winner_id', String, ForeignKey('users.id', ondelete='CASCADE'), nullable=True),
        Column('winning_path', JSON, nullable=True),
        Column('duration_ms', Integer, nullable=True),
        Column('createdAt', DateTime, server_default=func.now()),
        Column('updatedAt', DateTime, server_default=func.now(), onupdate=func.now())
    )

    Table('player_connections', metadata,
        Column('player1_id', String, ForeignKey('players.id', ondelete='CASCADE'), primary_key=True),
        Column('player2_id', String, ForeignKey('players.id', ondelete='CASCADE'), primary_key=True),
        Column('connection_type', String, primary_key=True),
        Column('metadata', JSON)
    )

    Table('player_seasonal_stats', metadata,
        Column('id', Integer, primary_key=True, autoincrement=True),
        Column('player_id', String, ForeignKey('players.id', ondelete='CASCADE'), index=True),
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

    Table('team_season_leaders', metadata,
        Column('id', Integer, primary_key=True, autoincrement=True),
        Column('team_id', String, ForeignKey('teams.id', ondelete='CASCADE')),
        Column('season', Integer, index=True),
        Column('passing_leader_id', String, ForeignKey('players.id', ondelete='CASCADE'), nullable=True),
        Column('rushing_leader_id', String, ForeignKey('players.id', ondelete='CASCADE'), nullable=True),
        Column('receiving_leaders', JSON, nullable=True),
        Column('createdAt', DateTime, server_default=func.now())
    )

    logger.info("Defined all table schemas: players, teams, users, user_stats, game_sessions, player_connections, and player_seasonal_stats.")

def create_tables(db_url: str, recreate: bool = False):
    """Connects to the database and creates the defined tables if they don't exist."""
    if not db_url:
        raise ValueError("DATABASE_URL environment variable or --db-url flag is required")

    logger.info("Connecting to the database to create application tables...")
    engine = create_engine(db_url)
    metadata = MetaData()
    define_schema(metadata)
    
    if recreate:
        logger.info("Recreating schema: dropping all defined tables first...")
        metadata.drop_all(engine)
        logger.info("All defined tables dropped.")

    try:
        metadata.create_all(engine)
        logger.info("Successfully created application tables (if they didn't exist).")
    except Exception as e:
        logger.error(f"An error occurred while creating tables: {e}")
        raise

def main():
    parser = argparse.ArgumentParser(description="Manage Application DB Schema.")
    parser.add_argument('--db-url', help='PostgreSQL database URL', default=os.getenv('DATABASE_URL'))
    parser.add_argument('--recreate', action='store_true', help='Drop all defined tables before creating them.')
    
    args = parser.parse_args()
    
    create_tables(args.db_url, recreate=args.recreate)

if __name__ == "__main__":
    main() 
