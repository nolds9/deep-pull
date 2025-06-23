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
)

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def define_schema(metadata: MetaData):
    """Defines the user-related tables in the given MetaData object."""
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
    logger.info("Defined 'users' and 'user_stats' table schemas.")

def create_tables(db_url: str):
    """Connects to the database and creates the defined tables if they don't exist."""
    if not db_url:
        raise ValueError("DATABASE_URL environment variable or --db-url flag is required")

    logger.info("Connecting to the database to create user tables...")
    engine = create_engine(db_url)
    metadata = MetaData()
    define_schema(metadata)
    
    try:
        metadata.create_all(engine)
        logger.info("Successfully created 'users' and 'user_stats' tables (if they didn't exist).")
    except Exception as e:
        logger.error(f"An error occurred while creating tables: {e}")
        raise

def main():
    parser = argparse.ArgumentParser(description="Manage User-related DB tables.")
    parser.add_argument('--db-url', help='PostgreSQL database URL', default=os.getenv('DATABASE_URL'))
    
    args = parser.parse_args()
    
    create_tables(args.db_url)

if __name__ == "__main__":
    main() 
