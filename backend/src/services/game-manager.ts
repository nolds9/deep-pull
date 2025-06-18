import { Server } from "socket.io";
import { Player } from "../entity/Player";
import { AppDataSource } from "../config";
import { PathfindingService } from "./pathfinding";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger";
import { PlayerSeasonalStats } from "../entity/PlayerSeasonalStats";
import { In } from "typeorm";

export type GameMode = "single" | "multiplayer";
export type Difficulty = "easy" | "medium" | "hard";

const getConnectionTypesForDifficulty = (difficulty: Difficulty): string[] => {
  switch (difficulty) {
    case "easy":
      return ["teammate", "college", "draft_class", "position"];
    case "medium":
      return ["teammate", "college"];
    case "hard":
      return ["teammate"];
    default:
      return [];
  }
};

const getStrikesForDifficulty = (difficulty: Difficulty): number => {
  switch (difficulty) {
    case "easy":
      return 10;
    case "medium":
      return 5;
    case "hard":
      return 3;
    default:
      return Infinity;
  }
};

interface GameSession {
  id: string;
  mode: GameMode;
  difficulty: Difficulty;
  players: string[]; // socket IDs
  startPlayer: Player;
  endPlayer: Player;
  status: "waiting" | "active" | "finished";
  ready: Map<string, boolean>;
  winner?: string;
  winningPath?: string[];
  startTime: number; // Unix timestamp
  timerId?: NodeJS.Timeout;
  // For modes with limited guesses
  strikes?: number;
  maxStrikes?: number;
}

export class GameManager {
  private activeSessions = new Map<string, GameSession>();
  private waitingPlayers: { socketId: string; difficulty: Difficulty }[] = [];
  private pathfinding: PathfindingService;
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    this.pathfinding = new PathfindingService();
  }

  async joinQueue(socketId: string, difficulty: Difficulty) {
    if (this.waitingPlayers.some((p) => p.socketId === socketId)) {
      logger.warn(`Player ${socketId} is already in the queue.`);
      return;
    }
    this.waitingPlayers.push({ socketId, difficulty });
    logger.info(
      `Player joined queue: ${socketId} with difficulty ${difficulty}. Queue length: ${this.waitingPlayers.length}`
    );

    // Process the queue as long as there are enough players
    while (this.waitingPlayers.length >= 2) {
      // For now, match any two players. A real system might match by difficulty.
      await this.startMultiplayerGame();
    }
  }

  private async startMultiplayerGame() {
    const [p1_data, p2_data] = this.waitingPlayers.splice(0, 2);
    // For now, we'll use the first player's difficulty for the match
    const difficulty = p1_data.difficulty;
    const { socketId: player1 } = p1_data;
    const { socketId: player2 } = p2_data;

    const { startPlayer, endPlayer } = await this._selectPlayersForGame(
      difficulty
    );

    if (!startPlayer || !endPlayer) {
      // Could not find a valid game, requeue players
      logger.error(
        `Could not find valid start/end players for difficulty ${difficulty}. Re-queueing players.`
      );
      this.waitingPlayers.push(p1_data, p2_data);
      // Maybe notify players? For now, they just wait longer.
      return;
    }

    const sessionId = uuidv4();
    logger.info(
      `Starting MULTIPLAYER game: sessionId=${sessionId}, players=[${player1}, ${player2}], difficulty=${difficulty}`
    );
    this.createSession(
      sessionId,
      [player1, player2],
      "multiplayer",
      difficulty,
      startPlayer,
      endPlayer
    );
  }

  async startSinglePlayerGame(socketId: string, difficulty: Difficulty) {
    const { startPlayer, endPlayer } = await this._selectPlayersForGame(
      difficulty
    );
    if (!startPlayer || !endPlayer) {
      this.io.to(socketId).emit("gameCreationError", {
        message:
          "Could not create a game for this difficulty. Please try again.",
      });
      return;
    }

    const sessionId = uuidv4();
    logger.info(
      `Starting SINGLE PLAYER game: sessionId=${sessionId}, player=${socketId}, difficulty=${difficulty}`
    );
    this.createSession(
      sessionId,
      [socketId],
      "single",
      difficulty,
      startPlayer,
      endPlayer
    );
  }

  private async _getPlayerIdsByFantasyTier(
    minPoints: number,
    maxPoints: number | null = null
  ): Promise<string[]> {
    const qb = AppDataSource.getRepository(PlayerSeasonalStats)
      .createQueryBuilder("stats")
      .select("stats.player_id", "player_id")
      .where("stats.fantasy_points_ppr >= :min", { min: minPoints });

    if (maxPoints) {
      qb.andWhere("stats.fantasy_points_ppr < :max", { max: maxPoints });
    }

    const results = await qb.distinct(true).getRawMany();
    return results.map((r) => r.player_id);
  }

  private async _selectPlayersForGame(
    difficulty: Difficulty
  ): Promise<{ startPlayer?: Player; endPlayer?: Player }> {
    const playerRepo = AppDataSource.getRepository(Player);
    let playerPoolIds: string[] = [];

    // 1. Get a pool of player IDs based on difficulty
    switch (difficulty) {
      case "easy":
        // Star players: > 150 PPR points in a season
        playerPoolIds = await this._getPlayerIdsByFantasyTier(150);
        logger.info(
          `Selected ${playerPoolIds.length} players for EASY pool (PPR > 150)`
        );
        break;
      case "medium":
        // Significant starters: 75-150 PPR points
        playerPoolIds = await this._getPlayerIdsByFantasyTier(75, 150);
        logger.info(
          `Selected ${playerPoolIds.length} players for MEDIUM pool (75 < PPR < 150)`
        );
        break;
      case "hard":
        // Any player with a recorded season: > 1 PPR point
        playerPoolIds = await this._getPlayerIdsByFantasyTier(1);
        logger.info(
          `Selected ${playerPoolIds.length} players for HARD pool (PPR > 1)`
        );
        break;
    }

    // 2. Fallback logic if a pool is too small
    if (playerPoolIds.length < 10) {
      logger.warn(
        `Player pool for ${difficulty} is too small (${playerPoolIds.length}). Falling back to significant players.`
      );
      playerPoolIds = await this._getPlayerIdsByFantasyTier(50);
    }
    if (playerPoolIds.length < 10) {
      logger.warn(
        `Fallback pool is still too small. Falling back to all players.`
      );
      const allPlayers = await playerRepo.find({ select: ["id"] });
      playerPoolIds = allPlayers.map((p) => p.id);
    }

    // 3. Load the actual player data for the selected pool
    const playerPool = await playerRepo.findBy({ id: In(playerPoolIds) });
    if (playerPool.length < 2) {
      logger.error("Not enough players in the database to start a game.");
      return {};
    }

    // 4. Find a valid pair from the pool
    const allowedConnectionTypes = getConnectionTypesForDifficulty(difficulty);
    let attempts = 0;
    const maxAttempts = 50; // Increased attempts to find a pair
    while (attempts < maxAttempts) {
      const p1 = playerPool[Math.floor(Math.random() * playerPool.length)];
      const p2 = playerPool[Math.floor(Math.random() * playerPool.length)];

      if (p1.id === p2.id) continue;

      attempts++;

      try {
        const path = await this.pathfinding.findShortestPath(
          p1.id,
          p2.id,
          allowedConnectionTypes
        );

        if (path.length > 0) {
          // NEW: For medium/hard, ensure path is not a direct 1-step connection
          if (difficulty === "medium" || difficulty === "hard") {
            if (path.length <= 2) {
              // Path length of 2 means [start, end], which is 1 connection
              logger.info(
                `[PlayerSelect] Rejecting 1-step path for ${difficulty} mode: ${p1.name} -> ${p2.name}`
              );
              continue; // try another pair
            }
          }
          logger.info(
            `[PlayerSelect] Found valid pair for ${difficulty}: ${p1.name} -> ${p2.name} (path length: ${path.length})`
          );
          return { startPlayer: p1, endPlayer: p2 };
        }
      } catch (e) {
        logger.error(`[PlayerSelect] Error finding path for pair: ${e}`);
        // Continue to next attempt
      }
    }

    logger.error(
      `Could not find a valid player pair for ${difficulty} after ${maxAttempts} attempts.`
    );
    return {};
  }

  private createSession(
    sessionId: string,
    players: string[],
    mode: GameMode,
    difficulty: Difficulty,
    startPlayer: Player,
    endPlayer: Player
  ) {
    logger.info(
      `Game session ${sessionId}: startPlayer=${startPlayer.name}, endPlayer=${endPlayer.name}`
    );

    const session: GameSession = {
      id: sessionId,
      players,
      mode,
      difficulty,
      startPlayer,
      endPlayer,
      status: mode === "single" ? "active" : "waiting",
      ready: new Map(players.map((p) => [p, false])),
      startTime: Date.now(),
      strikes: getStrikesForDifficulty(difficulty),
      maxStrikes: getStrikesForDifficulty(difficulty),
    };

    if (mode === "multiplayer") {
      session.timerId = setTimeout(() => {
        this.handleTimeout(sessionId);
      }, (60 + 5) * 1000); // Give 5s for lobby/countdown
    }

    this.activeSessions.set(sessionId, session);

    // Notify all players in the session
    players.forEach((socketId) => {
      this.io.to(socketId).emit("gameStart", {
        sessionId,
        startPlayer,
        endPlayer,
        mode,
        difficulty,
        opponent:
          mode === "multiplayer" ? players.find((p) => p !== socketId) : null,
      });
    });

    logger.info(`Game session ${sessionId} started and notified players.`);
  }

  async submitPath(sessionId: string, socketId: string, path: string[]) {
    logger.info(`Path submitted: sessionId=${sessionId}, socketId=${socketId}`);
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== "active") {
      logger.warn(`Inactive session for path submission: ${sessionId}`);
      return;
    }

    const allowedConnectionTypes = getConnectionTypesForDifficulty(
      session.difficulty
    );
    const isValid = await this.pathfinding.validatePath(
      path,
      session.startPlayer.id,
      session.endPlayer.id,
      allowedConnectionTypes
    );

    if (isValid) {
      if (session.mode === "single") {
        this.handleSinglePlayerWin(session, path);
      } else {
        this.handleMultiplayerWin(session, socketId, path);
      }
    } else {
      this.handleInvalidPath(session, socketId, path.length);
    }
  }

  private handleInvalidPath(
    session: GameSession,
    socketId: string,
    pathLength: number
  ) {
    // Decrement strikes only if the mode has them
    if (session.strikes !== undefined && session.maxStrikes !== undefined) {
      session.strikes--;
      this.io.to(socketId).emit("invalidPath", {
        pathLength,
        strikes: session.strikes,
      });

      // Let opponent know about the attempt
      const opponentId = session.players.find((p) => p !== socketId);
      if (opponentId) {
        this.io
          .to(opponentId)
          .emit("opponentAttemptedPath", { success: false, pathLength });
      }

      if (session.strikes <= 0) {
        logger.info(
          `Player ${socketId} in session ${session.id} ran out of strikes.`
        );
        this._endGame(session, "out_of_strikes", opponentId);
      }
    } else {
      // No strikes in this mode, just send invalid path event
      this.io.to(socketId).emit("invalidPath", { pathLength });
      // Let opponent know about the attempt
      const opponentId = session.players.find((p) => p !== socketId);
      if (opponentId) {
        this.io
          .to(opponentId)
          .emit("opponentAttemptedPath", { success: false, pathLength });
      }
    }
  }

  private async handleSinglePlayerWin(session: GameSession, path: string[]) {
    const timeElapsed = (Date.now() - session.startTime) / 1000;
    const score = Math.max(
      0,
      10000 - Math.floor(timeElapsed * 10) - (path.length - 1) * 100
    );

    const winningPathWithNames = (
      await this.pathfinding.convertIdsToNames([path])
    )[0];

    logger.info(
      `Single player game ${session.id} won. Score: ${score}, Time: ${timeElapsed}s`
    );

    this.io.to(session.players[0]).emit("gameEnd", {
      winnerId: session.players[0],
      reason: "path_found",
      winningPath: winningPathWithNames,
      score,
      time: timeElapsed,
    });

    this.activeSessions.delete(session.id);
  }

  private async handleMultiplayerWin(
    session: GameSession,
    winnerId: string,
    path: string[]
  ) {
    session.winner = winnerId;
    session.winningPath = path;
    session.status = "finished";

    const opponentId = session.players.find((p) => p !== winnerId);
    if (opponentId) {
      this.io.to(opponentId).emit("opponentAttemptedPath", {
        success: true,
        pathLength: path.length,
      });
    }

    const winningPathWithNames = (
      await this.pathfinding.convertIdsToNames([path])
    )[0];

    // Winner
    this.io.to(winnerId).emit("gameEnd", {
      winnerId: winnerId,
      reason: "path_found",
      winningPath: winningPathWithNames,
    });

    // Loser
    if (opponentId) {
      const solutionPaths = await this.findAndEmitSolutions(session, 3);
      this.io.to(opponentId).emit("gameEnd", {
        winnerId: winnerId,
        reason: "path_found",
        winningPath: winningPathWithNames,
        solutionPaths,
      });
    }

    if (session.timerId) clearTimeout(session.timerId);
    this.activeSessions.delete(session.id);
    logger.info(`Multiplayer game ${session.id} finished. Winner: ${winnerId}`);
  }

  private async findAndEmitSolutions(
    session: GameSession,
    limit: number = 3
  ): Promise<string[][]> {
    const solutionPathsById = await this.pathfinding.findShortestPaths(
      session.startPlayer.id,
      session.endPlayer.id,
      limit,
      getConnectionTypesForDifficulty(session.difficulty)
    );
    const solutionPathsByName = await this.pathfinding.convertIdsToNames(
      solutionPathsById
    );

    // Deduplicate paths after converting to names
    const uniquePathsByName = Array.from(
      new Set(solutionPathsByName.map((p) => JSON.stringify(p)))
    ).map((s) => JSON.parse(s));

    return uniquePathsByName;
  }

  playerReady(socketId: string, sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.players.includes(socketId)) {
      return;
    }
    if (session.mode !== "multiplayer") return;

    session.ready.set(socketId, true);
    logger.info(`Player ${socketId} is ready in session ${sessionId}`);

    const opponentId = session.players.find((p) => p !== socketId);
    if (opponentId) {
      this.io.to(opponentId).emit("opponentReady");
    }

    const allReady = Array.from(session.ready.values()).every((r) => r);
    if (allReady) {
      logger.info(
        `All players ready in session ${sessionId}. Starting countdown.`
      );
      session.status = "active";
      this.io.to(session.players[0]).emit("allPlayersReady");
      this.io.to(session.players[1]).emit("allPlayersReady");
    }
  }

  leaveQueue(socketId: string) {
    const queueIndex = this.waitingPlayers.findIndex(
      (p) => p.socketId === socketId
    );
    if (queueIndex > -1) {
      this.waitingPlayers.splice(queueIndex, 1);
      logger.info(
        `Player ${socketId} removed from queue. New queue length: ${this.waitingPlayers.length}`
      );
    }
  }

  handleDisconnect(socketId: string) {
    logger.info(`Handling disconnect for player: ${socketId}`);
    this.leaveQueue(socketId);

    const sessionToCancel = Array.from(this.activeSessions.values()).find(
      (session) => session.players.includes(socketId)
    );

    if (sessionToCancel && sessionToCancel.mode === "multiplayer") {
      logger.info(
        `Player ${socketId} was in active session ${sessionToCancel.id}. Ending game.`
      );
      if (sessionToCancel.timerId) clearTimeout(sessionToCancel.timerId);

      const winnerId = sessionToCancel.players.find((p) => p !== socketId);
      if (winnerId) {
        this.io.to(winnerId).emit("gameEnd", {
          winnerId: winnerId,
          winningPath: ["opponent_disconnected"],
        });
        logger.info(
          `Notified opponent ${winnerId} they won due to disconnect.`
        );
      }
      this.activeSessions.delete(sessionToCancel.id);
    } else if (sessionToCancel) {
      // Single player game, just remove the session
      this.activeSessions.delete(sessionToCancel.id);
      logger.info(`Single player session ${sessionToCancel.id} removed.`);
    }
  }

  forceEndGame(socketId: string, sessionId: string) {
    // This is a debug/testing method, can be removed for production
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const winnerId = session.players.find((p) => p !== socketId) || "none";
    session.players.forEach((p) =>
      this.io.to(p).emit("gameEnd", { winnerId, winningPath: ["simulation"] })
    );
    this.activeSessions.delete(sessionId);
  }

  async handleTimeout(sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== "active") return;

    logger.info(`Game session ${sessionId} timed out.`);
    session.status = "finished";
    const solutionPathsWithNames = await this.findAndEmitSolutions(session, 3);

    const gameEndPayload = {
      winnerId: null, // No winner on timeout
      winningPath: ["timeout"],
      solutionPaths: solutionPathsWithNames,
    };

    session.players.forEach((p) =>
      this.io.to(p).emit("gameEnd", gameEndPayload)
    );
    this.activeSessions.delete(sessionId);
  }

  handleGiveUp(socketId: string, sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (
      !session ||
      !session.players.includes(socketId) ||
      session.status !== "active"
    ) {
      logger.warn(
        `Invalid 'giveUp' request for session ${sessionId} from ${socketId}`
      );
      return;
    }
    logger.info(`Player ${socketId} gave up in session ${session.id}`);

    if (session.mode === "single") {
      this._endGame(session, "gave_up"); // No winner
    } else if (session.mode === "multiplayer") {
      const winnerId = session.players.find((p) => p !== socketId);
      this._endGame(session, "gave_up", winnerId);
    }
  }

  private async _endGame(
    session: GameSession,
    reason: string,
    winnerId?: string
  ) {
    if (session.status === "finished") return; // Already ended

    logger.info(
      `Ending game ${session.id}. Reason: ${reason}, Winner: ${winnerId}`
    );
    session.status = "finished";
    if (session.timerId) {
      clearTimeout(session.timerId);
    }

    const solutionPaths = await this.findAndEmitSolutions(session);

    session.players.forEach((playerSocketId) => {
      let finalReason = reason;
      // If there's a winner and this player is the winner, tell them their opponent gave up.
      if (reason === "gave_up" && winnerId && playerSocketId === winnerId) {
        finalReason = "opponent_gave_up";
      }

      this.io.to(playerSocketId).emit("gameEnd", {
        winnerId: winnerId,
        reason: finalReason,
        solutionPaths,
      });
    });

    this.activeSessions.delete(session.id);
  }
}
