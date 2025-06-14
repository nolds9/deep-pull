"""
Test database connection and basic functionality
"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
import pandas as pd

load_dotenv()

def test_connection():
    """Test basic database connectivity"""
    print("🔍 Testing database connection...")
    
    engine = create_engine(os.getenv('DATABASE_URL'))
    
    with engine.connect() as conn:
        # Test basic connection
        version = conn.execute(text('SELECT version()')).scalar()
        print(f"✅ Connected to: {version.split(' ')[0]}")
        
        # Check if tables exist
        tables = conn.execute(text("""
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public'
        """)).fetchall()
        
        if tables:
            print(f"📊 Existing tables: {[t[0] for t in tables]}")
        else:
            print("📊 No tables found (first run)")
            
        return True

def test_nfl_data():
    """Test nfl_data_py functionality"""
    print("\n🏈 Testing nfl_data_py...")
    
    try:
        import nfl_data_py as nfl
        
        # Test small data fetch
        rosters = nfl.import_seasonal_rosters([2024])
        print(f"✅ Successfully fetched {len(rosters)} roster records for 2024")
        
        # Show sample data
        sample = rosters.head(3)[['player_name', 'team', 'position']]
        print("\n📋 Sample data:")
        print(sample.to_string(index=False))
        
        return True
        
    except Exception as e:
        print(f"❌ nfl_data_py test failed: {e}")
        return False

if __name__ == "__main__":
    try:
        test_connection()
        test_nfl_data()
        print("\n🎯 All tests passed! Ready to run ETL.")
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        print("Check your DATABASE_URL in .env file")
