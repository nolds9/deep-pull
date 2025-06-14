"""
Validate the ETL output
"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
import pandas as pd

load_dotenv()

def validate_etl():
    engine = create_engine(os.getenv('DATABASE_URL'))
    
    with engine.connect() as conn:
        # Check player count
        player_count = conn.execute(text("SELECT COUNT(*) FROM players")).scalar()
        print(f"👥 Total players: {player_count:,}")
        
        # Check connection count
        connection_count = conn.execute(text("SELECT COUNT(*) FROM player_connections")).scalar()
        print(f"🔗 Total connections: {connection_count:,}")
        
        # Check connection types
        conn_types = pd.read_sql("""
            SELECT connection_type, COUNT(*) as count
            FROM player_connections
            GROUP BY connection_type
            ORDER BY count DESC
        """, conn)
        print("\n📊 Connection types:")
        print(conn_types.to_string(index=False))
        
        # Check for orphaned connections
        orphaned_query = """
            SELECT COUNT(*) FROM player_connections pc
            WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.id = pc.player1_id)
               OR NOT EXISTS (SELECT 1 FROM players p WHERE p.id = pc.player2_id)
        """
        orphaned_count = conn.execute(text(orphaned_query)).scalar()
        print(f"\n👻 Orphaned connections: {orphaned_count}")
        if orphaned_count > 0:
            print("   ⚠️ WARNING: Orphaned connections found. This indicates a data integrity issue.")
        else:
            print("   ✅ OK: No orphaned connections found.")

        # Check connection distribution
        dist_query = """
            WITH player_connection_counts AS (
                SELECT p.id, COUNT(pc.player1_id) as connection_count
                FROM players p
                LEFT JOIN player_connections pc ON p.id = pc.player1_id OR p.id = pc.player2_id
                GROUP BY p.id
            )
            SELECT 
                AVG(connection_count)::numeric(10,1) as avg_connections,
                MIN(connection_count) as min_connections,
                MAX(connection_count) as max_connections,
                (SELECT COUNT(*) FROM player_connection_counts WHERE connection_count = 0) as players_with_zero_connections
            FROM player_connection_counts
        """
        dist = pd.read_sql(dist_query, conn)
        print("\n📈 Connection Distribution:")
        print(dist.to_string(index=False))
        
        # Sample high-profile players
        stars = pd.read_sql("""
            SELECT p.name, p.position, p.college, COUNT(pc.player1_id) as connections
            FROM players p
            LEFT JOIN player_connections pc ON (p.id = pc.player1_id OR p.id = pc.player2_id)
            WHERE p.name ILIKE ANY(ARRAY['%%mahomes%%', '%%tom%%brady%%', '%%aaron%%donald%%', '%%justin%%jefferson%%'])
            GROUP BY p.id, p.name, p.position, p.college
            ORDER BY connections DESC
        """, conn)
        
        print(f"\n⭐ Star players found:")
        print(stars.to_string(index=False))

if __name__ == "__main__":
    validate_etl()
