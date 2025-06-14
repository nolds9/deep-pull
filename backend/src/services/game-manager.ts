import { Server } from "socket.io";
import { Player } from "../entity/Player";
import { AppDataSource } from "../config";
import { PathfindingService } from "./pathfinding";
import { v4 as uuidv4 } from "uuid";
import { PlayerConnection } from "../entity/PlayerConnection";
import { logger } from "../utils/logger";

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
    logger.info(
      `Player joined queue: ${socketId}. Queue length: ${this.waitingPlayers.length}`
    );
    if (this.waitingPlayers.length >= 2) {
      await this.startGame();
    }
  }

  private async startGame() {
    const [player1, player2] = this.waitingPlayers.splice(0, 2);
    const sessionId = uuidv4();
    logger.info(
      `Starting game: sessionId=${sessionId}, players=[${player1}, ${player2}]`
    );
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
    logger.info(
      `Game session ${sessionId}: startPlayer=${startPlayer.name} (${startPlayer.id}), endPlayer=${endPlayer.name} (${endPlayer.id})`
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
    logger.info(`Game session ${sessionId} started and notified players.`);
  }

  async submitPath(sessionId: string, socketId: string, path: string[]) {
    logger.info(
      `Path submitted: sessionId=${sessionId}, socketId=${socketId}, path=${JSON.stringify(
        path
      )}`
    );
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== "active") {
      logger.warn(
        `Invalid or inactive session for path submission: sessionId=${sessionId}`
      );
      return;
    }
    try {
      const isValid = await this.validatePath(
        path,
        session.startPlayer.id,
        session.endPlayer.id
      );
      logger.info(
        `Path validation result for session ${sessionId}: ${isValid}`
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
        logger.info(`Game session ${sessionId} finished. Winner: ${socketId}`);
      }
    } catch (err) {
      logger.error(
        `Error during path submission for session ${sessionId}: ${err}`
      );
    }
  }

  private async validatePath(
    path: string[],
    startId: string,
    endId: string
  ): Promise<boolean> {
    logger.info(
      `Validating path: ${JSON.stringify(
        path
      )} (start: ${startId}, end: ${endId})`
    );
    if (path.length < 2) return false;
    if (path[0] !== startId || path[path.length - 1] !== endId) return false;
    // Verify each step is connected
    const connectionRepo = AppDataSource.getRepository(PlayerConnection);
    for (let i = 0; i < path.length - 1; i++) {
      const connection = await connectionRepo.findOne({
        where: [
          { player1_id: path[i], player2_id: path[i + 1] },
          { player1_id: path[i + 1], player2_id: path[i] },
        ],
      });
      if (!connection) {
        logger.warn(`Invalid connection between ${path[i]} and ${path[i + 1]}`);
        return false;
      }
    }
    return true;
  }
}
