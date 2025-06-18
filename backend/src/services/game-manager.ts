import { Server } from "socket.io";
import { Player } from "../entity/Player";
import { AppDataSource } from "../config";
import { PathfindingService } from "./pathfinding";
import { v4 as uuidv4 } from "uuid";
import { PlayerConnection } from "../entity/PlayerConnection";
import { logger } from "../utils/logger";
import { PlayerSeasonalStats } from "../entity/PlayerSeasonalStats";
import { In } from "typeorm";

interface GameSession {
  id: string;
  players: [string, string]; // socket IDs
  startPlayer: Player;
  endPlayer: Player;
  status: "waiting" | "active" | "finished";
  ready: Map<string, boolean>;
  winner?: string;
  winningPath?: string[];
  startTime?: Date;
  timerId?: NodeJS.Timeout;
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
    if (this.waitingPlayers.includes(socketId)) {
      logger.warn(`Player ${socketId} is already in the queue.`);
      return;
    }
    this.waitingPlayers.push(socketId);
    logger.info(
      `Player joined queue: ${socketId}. Queue length: ${this.waitingPlayers.length}`
    );

    // Process the queue as long as there are enough players
    while (this.waitingPlayers.length >= 2) {
      await this.startGame();
    }
  }

  private async startGame() {
    const [player1, player2] = this.waitingPlayers.splice(0, 2);
    const sessionId = uuidv4();
    logger.info(
      `Starting game: sessionId=${sessionId}, players=[${player1}, ${player2}]`
    );
    // Pick random start/end players from a pool of significant players
    const significantPlayerIds = await AppDataSource.getRepository(
      PlayerSeasonalStats
    )
      .createQueryBuilder("stats")
      .select("stats.player_id", "player_id")
      .where("stats.fantasy_points_ppr > :minPoints", { minPoints: 50 })
      .distinct(true)
      .getRawMany();

    if (significantPlayerIds.length < 2) {
      logger.error(
        "Not enough significant players found in the database. Falling back to all players."
      );
      // Fallback to old logic if not enough significant players
      const allPlayers = await AppDataSource.getRepository(Player).find();
      const getRandomPlayer = () =>
        allPlayers[Math.floor(Math.random() * allPlayers.length)];
      let startPlayer = getRandomPlayer();
      let endPlayer = getRandomPlayer();
      while (endPlayer.id === startPlayer.id) {
        endPlayer = getRandomPlayer();
      }
      this.createSession(sessionId, player1, player2, startPlayer, endPlayer);
      return;
    }

    const playerIds = significantPlayerIds.map((r) => r.player_id);

    const playerRepo = AppDataSource.getRepository(Player);
    const significantPlayers = await playerRepo.find({
      where: {
        id: In(playerIds),
      },
    });

    if (significantPlayers.length < 2) {
      logger.error(
        "Could not find player details for significant players. Aborting game start."
      );
      return;
    }

    const getRandomPlayer = () =>
      significantPlayers[Math.floor(Math.random() * significantPlayers.length)];

    let startPlayer = getRandomPlayer();
    let endPlayer = getRandomPlayer();
    while (endPlayer.id === startPlayer.id) {
      endPlayer = getRandomPlayer();
    }
    this.createSession(sessionId, player1, player2, startPlayer, endPlayer);
  }

  private createSession(
    sessionId: string,
    player1: string,
    player2: string,
    startPlayer: Player,
    endPlayer: Player
  ) {
    logger.info(
      `Game session ${sessionId}: startPlayer=${startPlayer.name} (${startPlayer.id}), endPlayer=${endPlayer.name} (${endPlayer.id})`
    );

    const session: GameSession = {
      id: sessionId,
      players: [player1, player2],
      startPlayer,
      endPlayer,
      status: "waiting",
      ready: new Map([
        [player1, false],
        [player2, false],
      ]),
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

    const opponentId = session.players.find((p) => p !== socketId);

    try {
      const isValid = await this.pathfinding.validatePath(
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

        if (opponentId) {
          this.io.to(opponentId).emit("opponentAttemptedPath", {
            success: true,
            pathLength: path.length,
          });
        }

        const winningPathWithNames = (
          await this.pathfinding.convertIdsToNames([path])
        )[0];

        // The winner sees their own path.
        this.io.to(socketId).emit("gameEnd", {
          winnerId: socketId,
          winningPath: winningPathWithNames,
        });

        // The loser sees the winning path and up to 3 solution paths.
        if (opponentId) {
          const solutionPaths = await this.pathfinding.findShortestPaths(
            session.startPlayer.id,
            session.endPlayer.id,
            3
          );
          const solutionPathsWithNames =
            await this.pathfinding.convertIdsToNames(solutionPaths);
          this.io.to(opponentId).emit("gameEnd", {
            winnerId: socketId,
            winningPath: winningPathWithNames,
            solutionPaths: solutionPathsWithNames,
          });
        }

        if (session.timerId) clearTimeout(session.timerId);
        this.activeSessions.delete(sessionId);
        logger.info(`Game session ${sessionId} finished. Winner: ${socketId}`);
      } else {
        // The path is not valid, notify the player.
        this.io.to(socketId).emit("invalidPath", { pathLength: path.length });
        if (opponentId) {
          this.io.to(opponentId).emit("opponentAttemptedPath", {
            success: false,
            pathLength: path.length,
          });
        }
        logger.info(
          `Invalid path submitted by ${socketId} for session ${sessionId}`
        );
      }
    } catch (err) {
      logger.error(
        `Error during path submission for session ${sessionId}: ${err}`
      );
    }
  }

  playerReady(socketId: string, sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.players.includes(socketId)) {
      logger.warn(
        `Player ${socketId} tried to ready up for invalid session ${sessionId}`
      );
      return;
    }

    session.ready.set(socketId, true);
    logger.info(`Player ${socketId} is ready in session ${sessionId}`);

    // Notify the other player
    const opponentId = session.players.find((p) => p !== socketId);
    if (opponentId) {
      this.io.to(opponentId).emit("opponentReady");
      logger.info(`Notified opponent ${opponentId} that player is ready.`);
    }

    // Check if both players are ready
    const allReady = Array.from(session.ready.values()).every(
      (isReady) => isReady
    );
    if (allReady) {
      logger.info(
        `All players ready in session ${sessionId}. Starting countdown.`
      );
      session.status = "active"; // Game is now active

      // Start a server-side timer
      session.timerId = setTimeout(() => {
        this.handleTimeout(sessionId);
      }, (60 + 3) * 1000); // 60s game + 3s countdown

      this.io.to(session.players[0]).emit("allPlayersReady");
      this.io.to(session.players[1]).emit("allPlayersReady");
    }
  }

  leaveQueue(socketId: string) {
    const queueIndex = this.waitingPlayers.indexOf(socketId);
    if (queueIndex > -1) {
      this.waitingPlayers.splice(queueIndex, 1);
      logger.info(
        `Player ${socketId} removed from queue. New queue length: ${this.waitingPlayers.length}`
      );
    }
  }

  handleDisconnect(socketId: string) {
    logger.info(`Handling disconnect for player: ${socketId}`);

    // Remove player from the waiting queue if they are in it
    const queueIndex = this.waitingPlayers.indexOf(socketId);
    if (queueIndex > -1) {
      this.waitingPlayers.splice(queueIndex, 1);
      logger.info(
        `Player ${socketId} removed from queue. New queue length: ${this.waitingPlayers.length}`
      );
    }

    // Find if the player was in an active game
    const sessionToCancel = Array.from(this.activeSessions.values()).find(
      (session) => session.players.includes(socketId)
    );

    if (sessionToCancel) {
      logger.info(
        `Player ${socketId} was in active session ${sessionToCancel.id}. Ending game.`
      );
      if (sessionToCancel.timerId) clearTimeout(sessionToCancel.timerId);

      const winnerId = sessionToCancel.players.find((p) => p !== socketId);
      if (winnerId) {
        // Formally end the game, declaring the remaining player the winner
        this.io.to(winnerId).emit("gameEnd", {
          winnerId: winnerId,
          winningPath: ["opponent_disconnected"],
        });
        logger.info(
          `Notified opponent ${winnerId} they won due to disconnect.`
        );
      }
      this.activeSessions.delete(sessionToCancel.id);
    }
  }

  forceEndGame(socketId: string, sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      logger.warn(`Session not found for forceEndGame: ${sessionId}`);
      return;
    }

    // The player who didn't click the button is the "winner" in this simulation
    const winnerId = session.players.find((p) => p !== socketId);

    this.io.to(session.players[0]).emit("gameEnd", {
      winnerId: winnerId,
      winningPath: ["simulation"],
    });
    this.io.to(session.players[1]).emit("gameEnd", {
      winnerId: winnerId,
      winningPath: ["simulation"],
    });
    this.activeSessions.delete(sessionId);
    logger.info(
      `Game session ${sessionId} force-ended by ${socketId}. Winner: ${winnerId}`
    );
  }

  async handleTimeout(sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== "active") {
      logger.warn(
        `Timeout for an already finished or invalid session: ${sessionId}`
      );
      return;
    }

    logger.info(`Game session ${sessionId} timed out.`);
    session.status = "finished";
    let solutionPathsWithNames: string[][] = [];

    try {
      const solutionPaths = await this.pathfinding.findShortestPaths(
        session.startPlayer.id,
        session.endPlayer.id,
        3
      );
      solutionPathsWithNames = await this.pathfinding.convertIdsToNames(
        solutionPaths
      );
    } catch (error) {
      logger.error(
        `Error finding solution paths for session ${sessionId}: ${error}`
      );
    }

    const gameEndPayload = {
      winnerId: null, // No winner on timeout
      winningPath: ["timeout"],
      solutionPaths: solutionPathsWithNames,
    };

    this.io.to(session.players[0]).emit("gameEnd", gameEndPayload);
    this.io.to(session.players[1]).emit("gameEnd", gameEndPayload);

    this.activeSessions.delete(sessionId);
  }
}
