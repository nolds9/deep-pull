import { Server } from "socket.io";
import { Player } from "../entity/Player";
import { AppDataSource } from "../config";
import { PathfindingService } from "./pathfinding";
import { v4 as uuidv4 } from "uuid";

interface GameSession {
  id: string;
  players: [string, string]; // socket IDs
  startPlayer: Player;
  endPlayer: Player;
  status: "waiting" | "active" | "finished";
  winner?: string;
  winningPath?: string[];
  startTime?: Date;
}

export class GameManager {
  private activeSessions = new Map<string, GameSession>();
  private waitingPlayers: string[] = [];
  private pathfinding: PathfindingService;
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    this.pathfinding = new PathfindingService();
  }

  async joinQueue(socketId: string) {
    this.waitingPlayers.push(socketId);
    if (this.waitingPlayers.length >= 2) {
      await this.startGame();
    }
  }

  private async startGame() {
    const [player1, player2] = this.waitingPlayers.splice(0, 2);
    const sessionId = uuidv4();
    // Pick random start/end players from skill positions
    const playerRepo = AppDataSource.getRepository(Player);
    const allPlayers = await playerRepo.find();
    const getRandomPlayer = () =>
      allPlayers[Math.floor(Math.random() * allPlayers.length)];
    let startPlayer = getRandomPlayer();
    let endPlayer = getRandomPlayer();
    while (endPlayer.id === startPlayer.id) {
      endPlayer = getRandomPlayer();
    }
    const session: GameSession = {
      id: sessionId,
      players: [player1, player2],
      startPlayer,
      endPlayer,
      status: "active",
      startTime: new Date(),
    };
    this.activeSessions.set(sessionId, session);
    // Notify both players
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
    const connectionRepo = AppDataSource.getRepository("player_connections");
    for (let i = 0; i < path.length - 1; i++) {
      const connection = await connectionRepo.findOne({
        where: [
          { player1_id: path[i], player2_id: path[i + 1] },
          { player1_id: path[i + 1], player2_id: path[i] },
        ],
      });
      if (!connection) return false;
    }
    return true;
  }
}
