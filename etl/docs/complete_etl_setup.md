# Complete ETL Setup - Step by Step

## 🎯 Goal
Get from zero to running your first NFL ETL pipeline locally, connected to a Railway PostgreSQL database.

## 📋 Prerequisites Checklist

```bash
# Check if you have these:
python --version   # Should be 3.11+
git --version      # Any recent version
node --version     # For Railway CLI (optional but helpful)
```

## Step 1: Install uv and Railway CLI

### Install uv
```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows (PowerShell)
powershell -c "irm https://astral.sh/uv/install.sh | iex"

# Verify installation
source ~/.bashrc  # or restart terminal
uv --version
```

### Install Railway CLI (Optional but Recommended)
```bash
# macOS
brew install railway

# Linux/Windows
npm install -g @railway/cli

# Verify
railway --version
```

## Step 2: Set Up Railway Account & PostgreSQL

### Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Verify email

### Create Project & Database
```bash
# Login via CLI
railway login

# Create new project
railway new
# Choose: "Empty Project"
# Name: "nfl-gaming-platform"

# Add PostgreSQL database
railway add --database postgresql

# Get database URL (save this!)
railway variables
# Look for DATABASE_URL=postgresql://...
```

**Alternative: Web Dashboard**
1. Go to [railway.app/dashboard](https://railway.app/dashboard)
2. Click "New Project" → "Empty Project"
3. Click "Add Service" → "Database" → "PostgreSQL"
4. Go to Variables tab, copy `DATABASE_URL`

## Step 3: Local Project Setup

### Create Project Structure
```bash
# Create main project directory
mkdir nfl-gaming-platform
cd nfl-gaming-platform

# Create ETL directory
mkdir etl
cd etl

# Initialize git (if not already done)
git init
```

### Set Up Python Project with uv
```bash
# Create pyproject.toml
cat > pyproject.toml << 'EOF'
[project]
name = "nfl-etl"
version = "0.1.0"
description = "NFL data ETL pipeline for gaming platform"
requires-python = ">=3.11"
dependencies = [
    "nfl-data-py==0.3.2",
    "pandas==2.1.4",
    "sqlalchemy==2.0.23", 
    "psycopg2-binary==2.9.9",
    "python-dotenv==1.0.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
EOF

# Create Python version file
echo "3.11" > .python-version

# Install dependencies
uv sync

# Verify installation
uv run python -c "import nfl_data_py; print('✅ Dependencies installed')"
```

## Step 4: Environment Configuration

### Create Environment File
```bash
# Copy your DATABASE_URL from Railway
cat > .env << 'EOF'
DATABASE_URL=postgresql://postgres:PASSWORD@HOST:PORT/railway
EOF

# Edit with your actual Railway database URL
# Get it from: railway variables
nano .env  # or code .env, vim .env, etc.
```

### Test Database Connection
```bash
# Quick connection test
uv run python -c "
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()
engine = create_engine(os.getenv('DATABASE_URL'))

with engine.connect() as conn:
    result = conn.execute(text('SELECT version()'))
    print('✅ Database connected:', result.scalar()[:50])
"
```

## Step 5: Create ETL Scripts

### Main Pipeline Script
```bash
# Download our ETL pipeline
curl -o mvp_pipeline.py https://raw.githubusercontent.com/[download-link]
```

**Or manually create `mvp_pipeline.py`:** (Copy the full script from our previous artifact)

### Create Runner Script
```bash
cat > run_etl.py << 'EOF'
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
EOF
```

### Create Test Script
```bash
cat > test_connection.py << 'EOF'
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
        rosters = nfl.import_rosters(years=[2024])
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
EOF
```

## Step 6: Run Your First ETL

### Pre-flight Checks
```bash
# Test everything is working
uv run python test_connection.py

# Expected output:
# 🔍 Testing database connection...
# ✅ Connected to: PostgreSQL
# 📊 No tables found (first run)
# 🏈 Testing nfl_data_py...
# ✅ Successfully fetched X roster records for 2024
# 🎯 All tests passed! Ready to run ETL.
```

### Run Dry Run First
```bash
# Test ETL without writing to database
uv run python mvp_pipeline.py --db-url "$DATABASE_URL" --dry-run

# This will:
# - Fetch NFL data (takes 2-3 minutes)
# - Process connections
# - Show what would be loaded
# - NOT write to database
```

### Run Full ETL
```bash
# The moment of truth!
uv run python run_etl.py

# Expected output:
# 🏈 Starting NFL ETL Pipeline...
# Database: monorail.proxy.rlwy.net:12345
# INFO - Extracting player rosters for years: [2015, 2016, ..., 2024]
# INFO - Extracted 3,847 unique players
# INFO - Building player connections...
# INFO - Created 156,789 teammate connections
# INFO - Created 78,234 college connections
# INFO - Created 23,456 draft class connections
# INFO - Created 8,901 position connections
# INFO - Loading data to database...
# INFO - Loaded 3,847 players
# INFO - Loaded batch 1/27
# ...
# INFO - ETL completed successfully in 0:08:34
# 🎉 ETL Complete!
# Players loaded: 3,847
# Connections created: 267,380
# Duration: 514.2 seconds
```

## Step 7: Validate Your Data

### Quick Data Check
```bash
cat > validate_data.py << 'EOF'
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
        
        # Sample high-profile players
        stars = pd.read_sql("""
            SELECT p.name, p.position, p.college, COUNT(pc.player1_id) as connections
            FROM players p
            LEFT JOIN player_connections pc ON (p.id = pc.player1_id OR p.id = pc.player2_id)
            WHERE p.name ILIKE ANY(ARRAY['%mahomes%', '%brady%', '%aaron%donald%', '%jefferson%'])
            GROUP BY p.id, p.name, p.position, p.college
            ORDER BY connections DESC
        """, conn)
        
        print(f"\n⭐ Star players found:")
        print(stars.to_string(index=False))

if __name__ == "__main__":
    validate_etl()
EOF

# Run validation
uv run python validate_data.py
```

## Step 8: Set Up Railway Auto-Deploy (Optional)

### Create Railway Configuration
```bash
# Create Railway config for production deployment
cat > railway.toml << 'EOF'
[build]
builder = "nixpacks"

[deploy]
startCommand = "uv run python run_etl.py"
healthcheckPath = "/health"

[environments.production.variables]
PYTHONPATH = "/app"

[[cron]]
schedule = "0 6 * * 1"  # Weekly Monday 6 AM UTC
command = "uv run python run_etl.py"
EOF

# Create nixpacks config
cat > nixpacks.toml << 'EOF'
[phases.install]
dependsOn = []
cmds = [
    "curl -LsSf https://astral.sh/uv/install.sh | sh",
    ". $HOME/.cargo/env",
    "uv sync"
]

[phases.start]
cmd = "uv run python run_etl.py"
EOF
```

### Deploy to Railway
```bash
# Connect local project to Railway
railway link

# Deploy the ETL worker
railway up

# Check deployment
railway logs --follow
```

## 🎉 Success Checklist

At this point you should have:

- [ ] ✅ uv installed and working
- [ ] ✅ Railway account with PostgreSQL database
- [ ] ✅ Local Python project set up with dependencies
- [ ] ✅ Environment configured with DATABASE_URL
- [ ] ✅ ETL pipeline successfully run locally
- [ ] ✅ Database populated with ~3,500 players and ~250K connections
- [ ] ✅ Data validated and looks correct
- [ ] ✅ (Optional) Railway auto-deploy configured

## 🐛 Common Issues & Solutions

### "uv not found"
```bash
# Re-run installer and restart terminal
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc
```

### "Database connection failed"
```bash
# Check your DATABASE_URL format
railway variables  # Get the correct URL
# Format: postgresql://user:pass@host:port/database
```

### "nfl_data_py timeout"
```bash
# NFL data source can be slow, just retry
uv run python run_etl.py
```

### "Memory error during ETL"
```bash
# Reduce the year range in mvp_pipeline.py
# Change: self.years = list(range(2020, 2025))  # Last 5 years only
```

## 🎯 Next Steps

Once your ETL is working:

1. **Set up weekly cron** (Railway handles this automatically)
2. **Build the TypeScript game server** that queries this data
3. **Create the real-time racing game** with WebSockets
4. **Deploy the frontend** React app

Your NFL data foundation is now rock solid! 🚀