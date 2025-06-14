"""
Simple script to run the MVP ETL pipeline
Usage: uv run python run_etl.py
"""
import os
from dotenv import load_dotenv
from mvp_pipeline import MVPETLPipeline
import logging

# Load environment variables
load_dotenv()

def main():
    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Get database URL from environment
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        raise ValueError("DATABASE_URL environment variable is required")
    
    print("🏈 Starting NFL ETL Pipeline...")
    print(f"Database: {db_url.split('@')[1] if '@' in db_url else 'Unknown'}")
    
    # Run the pipeline
    pipeline = MVPETLPipeline(db_url)
    result = pipeline.run_mvp_etl()
    
    print(f"\n🎉 ETL Complete!")
    print(f"Players loaded: {result['players_count']:,}")
    print(f"Connections created: {result['connections_count']:,}")
    print(f"Duration: {result['duration_seconds']:.1f} seconds")

if __name__ == "__main__":
    main()
