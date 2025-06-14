# NFL Gaming Platform - Architecture & Implementation Guide

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        RAILWAY PLATFORM                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │   Frontend      │    │   TypeScript    │                │
│  │   (React/Next)  │◄──►│   Game Server   │                │
│  │                 │    │   (Express +    │                │
│  │   • Game UI     │    │    Socket.io)   │                │
│  │   • Real-time   │    │                 │                │
│  │   • Leaderboard │    │   • Game Logic  │                │
│  └─────────────────┘    │   • WebSocket   │                │
│                         │   • REST API    │                │
│                         │   • Pathfinding │                │
│                         └─────────┬───────┘                │
│                                   │                        │
│  ┌─────────────────┐              │                        │
│  │   Python ETL    │              │                        │
│  │   Worker        │              │                        │
│  │                 │              │                        │
│  │   • nfl_data_py │              │                        │
│  │   • Data Clean  │              │                        │
│  │   • Cron Jobs   │              │                        │
│  └─────────┬───────┘              │                        │
│            │                      │                        │
│            └──────────────────────▼────────────────────┐   │
│                         ┌─────────────────────────────┐ │   │
│                         │     PostgreSQL Database    │ │   │
│                         │                             │ │   │
│                         │   • Player profiles         │ │   │
│                         │   • Career statistics       │ │   │
│                         │   • Team rosters            │ │   │
│                         │   • Player connections      │ │   │
│                         │   • Game sessions           │ │   │
│                         │   • User accounts           │ │   │
│                         └─────────────────────────────┘ │   │
│                                                         │   │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Product Vision

### MVP Game: Player Connection Race

Two players compete to find the shortest connection path between two random NFL players in real-time.

### Future Games Platform

- "Guess That Team" (stat leaders → team)
- "Name That Season"
- "Teammate or Not?"
- "Draft Class Quiz"
- "Stat Battles"

## 📊 Data Architecture

### Layer 1: MVP Data Model (PostgreSQL)

```sql
-- Core entities for racing game
CREATE TABLE players (
    id VARCHAR PRIMARY KEY, -- 'esb_id' from nfl_data_py
    name VARCHAR NOT NULL,
    position VARCHAR,
    college VARCHAR,
    draft_year INTEGER,
    active_years INTEGER[],
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE teams (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    abbreviation VARCHAR(3),
    division VARCHAR,
    conference VARCHAR
);

CREATE TABLE player_connections (
    id SERIAL PRIMARY KEY,
    player1_id VARCHAR REFERENCES players(id),
    player2_id VARCHAR REFERENCES players(id),
    connection_type VARCHAR NOT NULL, -- 'teammate', 'college', 'draft_class', 'position'
    metadata JSONB, -- {team: 'DAL', years: [2020,2021]} or {college: 'Alabama'}
    created_at TIMESTAMP DEFAULT NOW(),

    INDEX(player1_id, connection_type),
    INDEX(player2_id, connection_type)
);

-- Game sessions for tracking races
CREATE TABLE game_sessions (
    id UUID PRIMARY KEY,
    player1_id VARCHAR REFERENCES players(id),
    player2_id VARCHAR REFERENCES players(id),
    start_player_id VARCHAR REFERENCES players(id),
    end_player_id VARCHAR REFERENCES players(id),
    winner_id VARCHAR,
    winning_path JSONB, -- ['Aaron Donald', '2014 NFL Draft', 'Matt Schaub']
    duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Layer 2: Extended Data Model (Future)

```sql
-- Rich statistical data for advanced games
CREATE TABLE player_season_stats (
    id SERIAL PRIMARY KEY,
    player_id VARCHAR REFERENCES players(id),
    season INTEGER,
    team_id VARCHAR REFERENCES teams(id),
    position VARCHAR,
    games_played INTEGER,

    -- Passing stats
    passing_yards INTEGER,
    passing_tds INTEGER,
    interceptions INTEGER,
    completion_percentage DECIMAL,

    -- Rushing stats
    rushing_yards INTEGER,
    rushing_tds INTEGER,
    rushing_attempts INTEGER,

    -- Receiving stats
    receptions INTEGER,
    receiving_yards INTEGER,
    receiving_tds INTEGER,
    targets INTEGER,

    -- Defensive stats
    tackles INTEGER,
    sacks DECIMAL,
    interceptions_def INTEGER,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE team_season_leaders (
    id SERIAL PRIMARY KEY,
    team_id VARCHAR REFERENCES teams(id),
    season INTEGER,
    passing_leader_id VARCHAR REFERENCES players(id),
    rushing_leader_id VARCHAR REFERENCES players(id),
    receiving_leaders JSONB, -- Array of top 3 receivers + TE
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 🔧 Technical Implementation

### Phase 1: Data Pipeline (Python)

```python
# etl/nfl_data_extractor.py
import nfl_data_py as nfl
import pandas as pd
from sqlalchemy import create_engine
import json

class NFLDataPipeline:
    def __init__(self, db_url: str):
        self.engine = create_engine(db_url)

    def extract_players(self, years: range = range(2015, 2025)):
        """Extract player roster data"""
        rosters = nfl.import_rosters(years=years)
        players = nfl.import_players()

        # Merge and clean data
        player_data = self.clean_player_data(rosters, players)
        return player_data

    def extract_connections(self, rosters_df: pd.DataFrame):
        """Build player connection graph"""
        connections = []

        # Teammate connections
        for team_season in rosters_df.groupby(['team', 'season']):
            team, season = team_season[0]
            players = team_season[1]['player_id'].tolist()

            # Create all pair combinations
            for i, player1 in enumerate(players):
                for player2 in players[i+1:]:
                    connections.append({
                        'player1_id': player1,
                        'player2_id': player2,
                        'connection_type': 'teammate',
                        'metadata': {'team': team, 'season': season}
                    })

        return pd.DataFrame(connections)

    def run_etl(self):
        """Main ETL process"""
        print("Starting NFL data extraction...")

        # Extract data
        players_df = self.extract_players()
        connections_df = self.extract_connections(players_df)

        # Load to database
        players_df.to_sql('players', self.engine, if_exists='replace', index=False)
        connections_df.to_sql('player_connections', self.engine, if_exists='replace', index=False)

        print(f"Loaded {len(players_df)} players and {len(connections_df)} connections")

# Schedule this to run weekly
if __name__ == "__main__":
    pipeline = NFLDataPipeline(os.getenv('DATABASE_URL'))
    pipeline.run_etl()
```

### Phase 2: Game Server (TypeScript)

```typescript
// src/types/game.ts
export interface Player {
  id: string;
  name: string;
  position: string;
  college: string;
  draft_year: number;
}

export interface Connection {
  player1_id: string;
  player2_id: string;
  connection_type: "teammate" | "college" | "draft_class" | "position";
  metadata: Record<string, any>;
}

export interface GameSession {
  id: string;
  players: [string, string]; // socket IDs
  startPlayer: Player;
  endPlayer: Player;
  status: "waiting" | "active" | "finished";
  winner?: string;
  winningPath?: string[];
  startTime?: Date;
}

// src/services/pathfinding.ts
export class PathfindingService {
  constructor(private db: Database) {}

  async findShortestPath(
    startPlayerId: string,
    endPlayerId: string
  ): Promise<string[]> {
    // BFS implementation
    const queue: Array<{ playerId: string; path: string[] }> = [
      { playerId: startPlayerId, path: [startPlayerId] },
    ];
    const visited = new Set<string>([startPlayerId]);

    while (queue.length > 0) {
      const { playerId, path } = queue.shift()!;

      if (playerId === endPlayerId) {
        return path;
      }

      // Get all connections for current player
      const connections = await this.getPlayerConnections(playerId);

      for (const connection of connections) {
        const nextPlayerId =
          connection.player1_id === playerId
            ? connection.player2_id
            : connection.player1_id;

        if (!visited.has(nextPlayerId)) {
          visited.add(nextPlayerId);
          queue.push({
            playerId: nextPlayerId,
            path: [...path, nextPlayerId],
          });
        }
      }
    }

    return []; // No path found
  }

  private async getPlayerConnections(playerId: string): Promise<Connection[]> {
    return this.db.query(
      `
      SELECT * FROM player_connections 
      WHERE player1_id = $1 OR player2_id = $1
    `,
      [playerId]
    );
  }
}

// src/services/game-manager.ts
export class GameManager {
  private activeSessions = new Map<string, GameSession>();
  private waitingPlayers: string[] = [];

  constructor(
    private io: Server,
    private playerService: PlayerService,
    private pathfinding: PathfindingService
  ) {}

  async joinQueue(socketId: string) {
    this.waitingPlayers.push(socketId);

    if (this.waitingPlayers.length >= 2) {
      await this.startGame();
    }
  }

  private async startGame() {
    const [player1, player2] = this.waitingPlayers.splice(0, 2);
    const sessionId = uuidv4();

    // Pick random start/end players
    const [startPlayer, endPlayer] = await this.playerService.getRandomPlayers(
      2
    );

    const session: GameSession = {
      id: sessionId,
      players: [player1, player2],
      startPlayer,
      endPlayer,
      status: "active",
      startTime: new Date(),
    };

    this.activeSessions.set(sessionId, session);

    // Send game start to both players
    this.io.to(player1).emit("gameStart", {
      sessionId,
      startPlayer,
      endPlayer,
      opponent: player2,
    });

    this.io.to(player2).emit("gameStart", {
      sessionId,
      startPlayer,
      endPlayer,
      opponent: player1,
    });
  }

  async submitPath(sessionId: string, socketId: string, path: string[]) {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== "active") return;

    // Verify path is valid
    const isValid = await this.validatePath(
      path,
      session.startPlayer.id,
      session.endPlayer.id
    );

    if (isValid) {
      session.winner = socketId;
      session.winningPath = path;
      session.status = "finished";

      // Notify both players
      this.io.to(session.players[0]).emit("gameEnd", {
        winner: socketId,
        winningPath: path,
      });

      this.io.to(session.players[1]).emit("gameEnd", {
        winner: socketId,
        winningPath: path,
      });

      this.activeSessions.delete(sessionId);
    }
  }

  private async validatePath(
    path: string[],
    startId: string,
    endId: string
  ): Promise<boolean> {
    if (path.length < 2) return false;
    if (path[0] !== startId || path[path.length - 1] !== endId) return false;

    // Verify each step is connected
    for (let i = 0; i < path.length - 1; i++) {
      const connection = await this.pathfinding.getPlayerConnections(path[i]);
      const hasConnection = connection.some(
        (c) => c.player1_id === path[i + 1] || c.player2_id === path[i + 1]
      );

      if (!hasConnection) return false;
    }

    return true;
  }
}

// src/app.ts
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL },
});

const gameManager = new GameManager(io, playerService, pathfindingService);

io.on("connection", (socket) => {
  socket.on("joinQueue", () => gameManager.joinQueue(socket.id));
  socket.on("submitPath", (data) =>
    gameManager.submitPath(data.sessionId, socket.id, data.path)
  );
});

server.listen(process.env.PORT || 3000);
```

## 🚀 Deployment Strategy (Railway)

### Project Structure

```
nfl-gaming-platform/
├── frontend/                 # React/Next.js app
├── backend/                  # TypeScript game server
│   ├── src/
│   ├── package.json
│   └── railway.json
├── etl/                      # Python data pipeline
│   ├── requirements.txt
│   ├── main.py
│   └── railway.json
└── database/
    └── migrations/
```

### Railway Configuration

```json
// backend/railway.json
{
  "deploy": {
    "startCommand": "npm run start",
    "healthcheckPath": "/health"
  },
  "environments": {
    "production": {
      "variables": {
        "NODE_ENV": "production"
      }
    }
  }
}

// etl/railway.json
{
  "deploy": {
    "startCommand": "python main.py"
  },
  "cron": [
    {
      "schedule": "0 6 * * 1",
      "command": "python main.py"
    }
  ]
}
```

## 📈 Scaling Considerations

### Performance Optimizations

- **Connection Caching**: Pre-compute common paths
- **Database Indexing**: Optimize connection queries
- **Rate Limiting**: Prevent abuse
- **CDN**: Static assets via Railway's CDN

### Future Enhancements

- **Redis**: Session management and caching
- **Graph Database**: When connection queries become complex
- **Microservices**: Split game logic from data services
- **Analytics**: Player behavior tracking

## 💰 Cost Estimates

### MVP Phase (Railway)

- **Hobby Plan**: $5/month
- **PostgreSQL**: $5/month
- **Total**: ~$10/month

### Growth Phase

- **Pro Plan**: $20/month
- **Larger Database**: $15/month
- **Total**: ~$35/month

## ✅ Implementation Checklist

### Phase 1: MVP Setup

- [ ] Set up Railway project
- [ ] Deploy PostgreSQL database
- [ ] Create Python ETL worker
- [ ] Build basic TypeScript API
- [ ] Implement WebSocket game logic
- [ ] Create simple React frontend

### Phase 2: Game Features

- [ ] Player matchmaking system
- [ ] Path validation logic
- [ ] Real-time game state management
- [ ] Basic UI for racing game
- [ ] Leaderboard functionality

### Phase 3: Platform Foundation

- [ ] User authentication
- [ ] Game history tracking
- [ ] Rich player statistics
- [ ] Admin dashboard
- [ ] Performance monitoring

### Phase 4: Additional Games

- [ ] "Guess That Team" implementation
- [ ] Advanced statistics integration
- [ ] Social features
- [ ] Mobile app considerations
