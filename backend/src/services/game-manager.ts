import { Server } from "socket.io";
import { Player } from "../entity/Player";
import { AppDataSource } from "../config";
import { PathfindingService } from "./pathfinding";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger";
import { PlayerSeasonalStats } from "../entity/PlayerSeasonalStats";
import { UserStats } from "../entity/UserStats";
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

interface PlayerInfo {
  userId: string;
}

interface GameSession {
  id: string;
  mode: GameMode;
  difficulty: Difficulty;
  players: Map<string, PlayerInfo>; // Map<socketId, { userId }>
  startPlayer: Player;
  endPlayer: Player;
  status: "waiting" | "active" | "finished";
  ready: Map<string, boolean>; // Map<socketId, isReady>
  winnerId?: string; // userId of the winner
  winningPath?: string[];
  startTime: number; // Unix timestamp
  timerId?: NodeJS.Timeout;
  strikes?: number;
  maxStrikes?: number;
}

export class GameManager {
  private activeSessions = new Map<string, GameSession>();
  private waitingPlayers: {
    socketId: string;
    userId: string;
    difficulty: Difficulty;
  }[] = [];
  private pathfinding: PathfindingService;
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    this.pathfinding = new PathfindingService();
  }

  async joinQueue(socketId: string, userId: string, difficulty: Difficulty) {
    if (this.waitingPlayers.some((p) => p.socketId === socketId)) {
      logger.warn(`Player ${socketId} (${userId}) is already in the queue.`);
      return;
    }
    this.waitingPlayers.push({ socketId, userId, difficulty });
    logger.info(
      `Player joined queue: ${socketId} (${userId}) with difficulty ${difficulty}. Queue length: ${this.waitingPlayers.length}`
    );

    while (this.waitingPlayers.length >= 2) {
      await this.startMultiplayerGame();
    }
  }

  private async startMultiplayerGame() {
    const [p1_data, p2_data] = this.waitingPlayers.splice(0, 2);
    const difficulty = p1_data.difficulty;

    const { startPlayer, endPlayer } = await this._selectPlayersForGame(
      difficulty
    );

    if (!startPlayer || !endPlayer) {
      logger.error(
        `Could not find valid start/end players for difficulty ${difficulty}. Re-queueing players.`
      );
      this.waitingPlayers.push(p1_data, p2_data);
      return;
    }

    const sessionId = uuidv4();
    const players = new Map<string, PlayerInfo>([
      [p1_data.socketId, { userId: p1_data.userId }],
      [p2_data.socketId, { userId: p2_data.userId }],
    ]);

    logger.info(
      `Starting MULTIPLAYER game: sessionId=${sessionId}, players=[${p1_data.socketId}(${p1_data.userId}), ${p2_data.socketId}(${p2_data.userId})], difficulty=${difficulty}`
    );
    this.createSession(
      sessionId,
      players,
      "multiplayer",
      difficulty,
      startPlayer,
      endPlayer
    );
  }

  async startSinglePlayerGame(
    socketId: string,
    userId: string,
    difficulty: Difficulty
  ) {
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
    const players = new Map<string, PlayerInfo>([[socketId, { userId }]]);
    logger.info(
      `Starting SINGLE PLAYER game: sessionId=${sessionId}, player=${socketId} (${userId}), difficulty=${difficulty}`
    );
    this.createSession(
      sessionId,
      players,
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
    players: Map<string, PlayerInfo>,
    mode: GameMode,
    difficulty: Difficulty,
    startPlayer: Player,
    endPlayer: Player
  ) {
    logger.info(
      `Game session ${sessionId}: startPlayer=${startPlayer.name}, endPlayer=${endPlayer.name}`
    );

    const socketIds = Array.from(players.keys());

    const session: GameSession = {
      id: sessionId,
      players,
      mode,
      difficulty,
      startPlayer,
      endPlayer,
      status: mode === "single" ? "active" : "waiting",
      ready: new Map(socketIds.map((p) => [p, false])),
      startTime: Date.now(),
      strikes: getStrikesForDifficulty(difficulty),
      maxStrikes: getStrikesForDifficulty(difficulty),
    };

    if (mode === "multiplayer") {
      session.timerId = setTimeout(() => {
        this.handleTimeout(sessionId);
      }, (60 + 5) * 1000);
    }

    this.activeSessions.set(sessionId, session);

    socketIds.forEach((socketId) => {
      this.io.to(socketId).emit("gameStart", {
        sessionId,
        startPlayer,
        endPlayer,
        mode,
        difficulty,
        opponentId:
          mode === "multiplayer"
            ? players.get(socketIds.find((s) => s !== socketId)!)!.userId
            : null,
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
    const playerInfo = session.players.get(socketId);
    if (!playerInfo) return; // Player not in session

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
        this.handleSinglePlayerWin(session, playerInfo.userId, path);
      } else {
        this.handleMultiplayerWin(session, playerInfo.userId, path);
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
    if (session.strikes !== undefined && session.maxStrikes !== undefined) {
      session.strikes--;
      this.io.to(socketId).emit("invalidPath", {
        pathLength,
        strikes: session.strikes,
      });

      const opponentSocketId = Array.from(session.players.keys()).find(
        (s) => s !== socketId
      );
      if (opponentSocketId) {
        this.io
          .to(opponentSocketId)
          .emit("opponentAttemptedPath", { success: false, pathLength });
      }

      if (session.strikes <= 0) {
        logger.info(`Player in session ${session.id} ran out of strikes.`);
        const winnerSocketId = opponentSocketId;
        const winnerInfo = winnerSocketId
          ? session.players.get(winnerSocketId)
          : undefined;
        this._endGame(session, "out_of_strikes", winnerInfo?.userId);
      }
    } else {
      this.io.to(socketId).emit("invalidPath", { pathLength });
      const opponentSocketId = Array.from(session.players.keys()).find(
        (s) => s !== socketId
      );
      if (opponentSocketId) {
        this.io
          .to(opponentSocketId)
          .emit("opponentAttemptedPath", { success: false, pathLength });
      }
    }
  }

  private async handleSinglePlayerWin(
    session: GameSession,
    userId: string,
    path: string[]
  ) {
    const timeElapsed = (Date.now() - session.startTime) / 1000;
    const score = Math.max(
      0,
      10000 - Math.floor(timeElapsed * 10) - (path.length - 1) * 100
    );

    const statsRepo = AppDataSource.getRepository(UserStats);
    const stats = await statsRepo.findOneBy({ user_id: userId });
    if (stats && score > stats.single_player_high_score) {
      stats.single_player_high_score = score;
      await statsRepo.save(stats);
      logger.info(`New high score for ${userId}: ${score}`);
    }

    const winningPathWithNames = (
      await this.pathfinding.convertIdsToNames([path])
    )[0];

    logger.info(
      `Single player game ${session.id} won by ${userId}. Score: ${score}`
    );
    const socketId = Array.from(session.players.keys())[0];
    this.io.to(socketId).emit("gameEnd", {
      winnerId: userId,
      reason: "path_found",
      winningPath: winningPathWithNames,
      score,
      time: timeElapsed,
    });

    this.activeSessions.delete(session.id);
  }

  private async handleMultiplayerWin(
    session: GameSession,
    winnerUserId: string,
    path: string[]
  ) {
    session.winnerId = winnerUserId;
    session.status = "finished";

    const statsRepo = AppDataSource.getRepository(UserStats);
    for (const [socketId, playerInfo] of session.players.entries()) {
      const stats = await statsRepo.findOneBy({ user_id: playerInfo.userId });
      if (stats) {
        if (playerInfo.userId === winnerUserId) {
          stats.multiplayer_wins++;
        } else {
          stats.multiplayer_losses++;
        }
        await statsRepo.save(stats);
      }
    }

    const winningPathWithNames = (
      await this.pathfinding.convertIdsToNames([path])
    )[0];

    const solutionPaths = await this.findAndEmitSolutions(session, 3);

    for (const [socketId, playerInfo] of session.players.entries()) {
      this.io.to(socketId).emit("gameEnd", {
        winnerId: winnerUserId,
        reason: "path_found",
        winningPath: winningPathWithNames,
        solutionPaths:
          playerInfo.userId !== winnerUserId ? solutionPaths : undefined,
      });
    }

    if (session.timerId) clearTimeout(session.timerId);
    this.activeSessions.delete(session.id);
    logger.info(
      `Multiplayer game ${session.id} finished. Winner: ${winnerUserId}`
    );
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
    if (!session || !session.players.has(socketId)) return;
    if (session.mode !== "multiplayer") return;

    session.ready.set(socketId, true);
    const playerInfo = session.players.get(socketId);
    logger.info(
      `Player ${socketId} (${playerInfo?.userId}) is ready in session ${sessionId}`
    );

    const opponentSocketId = Array.from(session.players.keys()).find(
      (s) => s !== socketId
    );
    if (opponentSocketId) {
      this.io.to(opponentSocketId).emit("opponentReady");
    }

    const allReady = Array.from(session.ready.values()).every((r) => r);
    if (allReady) {
      logger.info(
        `All players ready in session ${sessionId}. Starting countdown.`
      );
      session.status = "active";
      session.players.forEach((_, sockId) =>
        this.io.to(sockId).emit("allPlayersReady")
      );
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
      (session) => session.players.has(socketId)
    );

    if (sessionToCancel && sessionToCancel.mode === "multiplayer") {
      logger.info(
        `Player ${socketId} was in active session ${sessionToCancel.id}. Ending game.`
      );
      if (sessionToCancel.timerId) clearTimeout(sessionToCancel.timerId);

      const winnerSocketId = Array.from(sessionToCancel.players.keys()).find(
        (s) => s !== socketId
      );
      if (winnerSocketId) {
        const winnerInfo = sessionToCancel.players.get(winnerSocketId);
        if (winnerInfo) {
          this._endGame(
            sessionToCancel,
            "opponent_disconnected",
            winnerInfo.userId
          );
        }
      }
    } else if (sessionToCancel) {
      this.activeSessions.delete(sessionToCancel.id);
      logger.info(`Single player session ${sessionToCancel.id} removed.`);
    }
  }

  forceEndGame(socketId: string, sessionId: string) {
    // This is a debug/testing method, can be removed for production
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const winnerId =
      Array.from(session.players.keys()).find((p) => p !== socketId) || "none";
    session.players.forEach((_, p) =>
      this.io.to(p).emit("gameEnd", { winnerId, winningPath: ["simulation"] })
    );
    this.activeSessions.delete(sessionId);
  }

  async handleTimeout(sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== "active") return;
    this._endGame(session, "timeout");
  }

  handleGiveUp(socketId: string, sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (
      !session ||
      !session.players.has(socketId) ||
      session.status !== "active"
    ) {
      logger.warn(
        `Invalid 'giveUp' request for session ${sessionId} from ${socketId}`
      );
      return;
    }
    const playerInfo = session.players.get(socketId)!;
    logger.info(
      `Player ${socketId} (${playerInfo.userId}) gave up in session ${session.id}`
    );

    if (session.mode === "single") {
      this._endGame(session, "gave_up");
    } else if (session.mode === "multiplayer") {
      const winnerSocketId = Array.from(session.players.keys()).find(
        (s) => s !== socketId
      );
      const winnerInfo = winnerSocketId
        ? session.players.get(winnerSocketId)
        : undefined;
      this._endGame(session, "gave_up", winnerInfo?.userId);
    }
  }

  private async _endGame(
    session: GameSession,
    reason: string,
    winnerId?: string // This is a userId
  ) {
    if (session.status === "finished") return;

    logger.info(
      `Ending game ${session.id}. Reason: ${reason}, Winner: ${winnerId}`
    );
    session.status = "finished";
    if (session.timerId) {
      clearTimeout(session.timerId);
    }

    const statsRepo = AppDataSource.getRepository(UserStats);
    if (reason === "opponent_disconnected" && winnerId) {
      const stats = await statsRepo.findOneBy({ user_id: winnerId });
      if (stats) {
        stats.multiplayer_wins++;
        await statsRepo.save(stats);
      }
    }

    const solutionPaths = await this.findAndEmitSolutions(session);

    for (const [playerSocketId, playerInfo] of session.players.entries()) {
      let finalReason = reason;
      if (reason === "gave_up" && winnerId && playerInfo.userId === winnerId) {
        finalReason = "opponent_gave_up";
      }

      this.io.to(playerSocketId).emit("gameEnd", {
        winnerId: winnerId,
        reason: finalReason,
        solutionPaths,
      });
    }

    this.activeSessions.delete(session.id);
  }
}
