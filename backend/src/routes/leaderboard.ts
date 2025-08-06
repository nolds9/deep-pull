import express from "express";
import { AppDataSource } from "../config";
import { GameSession as DBGameSession } from "../entity/GameSession";
import { User } from "../entity/User";
import { Player } from "../entity/Player";
import { logger } from "../utils/logger";
import { MoreThanOrEqual } from "typeorm";

const router = express.Router();

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  gameType: string;
  difficulty: string;
  gameMode: string;
  durationMs: number;
  winCount: number;
  totalGames: number;
  winRate: number;
  averageDuration: number;
  bestTime?: number;
}

/**
 * GET /api/leaderboard
 * Query parameters:
 * - gameType: string (optional, defaults to "player_rush")
 * - difficulty: "easy" | "medium" | "hard" (optional)
 * - mode: "single" | "multiplayer" (optional)
 * - limit: number (optional, defaults to 50)
 * - timeRange: "all" | "week" | "month" (optional, defaults to "all")
 */
router.get("/", async (req, res) => {
  try {
    const {
      gameType = "player_rush",
      difficulty,
      mode,
      limit = 50,
      timeRange = "all",
    } = req.query;

    // Validate parameters
    if (
      difficulty &&
      !["easy", "medium", "hard"].includes(difficulty as string)
    ) {
      return res.status(400).json({ error: "Invalid difficulty parameter" });
    }

    if (mode && !["single", "multiplayer"].includes(mode as string)) {
      return res.status(400).json({ error: "Invalid mode parameter" });
    }

    if (timeRange && !["all", "week", "month"].includes(timeRange as string)) {
      return res.status(400).json({ error: "Invalid timeRange parameter" });
    }

    const gameSessionRepo = AppDataSource.getRepository(DBGameSession);
    const userRepo = AppDataSource.getRepository(User);

    // Build query conditions
    const whereConditions: any = {
      game_type: gameType,
    };

    if (difficulty) {
      whereConditions.difficulty = difficulty;
    }

    if (mode) {
      whereConditions.game_mode = mode;
    }

    // Add time range filter
    if (timeRange !== "all") {
      const now = new Date();
      let startDate: Date;

      if (timeRange === "week") {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (timeRange === "month") {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else {
        startDate = new Date(0); // Beginning of time
      }

      whereConditions.createdAt = MoreThanOrEqual(startDate);
    }

    // Get all game sessions matching criteria
    const gameSessions = await gameSessionRepo.find({
      where: whereConditions,
      order: { createdAt: "DESC" },
    });

    // Aggregate statistics by user
    const userStats = new Map<
      string,
      {
        userId: string;
        userName: string;
        gameType: string;
        difficulty: string;
        gameMode: string;
        winCount: number;
        totalGames: number;
        totalDuration: number;
        bestTime?: number;
        games: DBGameSession[];
      }
    >();

    for (const session of gameSessions) {
      const userId = session.player1_id;
      const userName = `User ${userId}`; // Simplified for now

      if (!userStats.has(userId)) {
        userStats.set(userId, {
          userId,
          userName,
          gameType: session.game_type,
          difficulty: session.difficulty,
          gameMode: session.game_mode,
          winCount: 0,
          totalGames: 0,
          totalDuration: 0,
          games: [],
        });
      }

      const stats = userStats.get(userId)!;
      stats.totalGames++;
      stats.totalDuration += session.duration_ms || 0;

      if (session.winner_id === userId) {
        stats.winCount++;
      }

      // Track best time (lowest duration for wins)
      if (session.winner_id === userId && session.duration_ms) {
        if (!stats.bestTime || session.duration_ms < stats.bestTime) {
          stats.bestTime = session.duration_ms;
        }
      }

      stats.games.push(session);
    }

    // Convert to leaderboard entries and sort
    const leaderboard: LeaderboardEntry[] = Array.from(userStats.values())
      .map((stats) => ({
        rank: 0, // Will be set after sorting
        userId: stats.userId,
        userName: stats.userName,
        gameType: stats.gameType,
        difficulty: stats.difficulty,
        gameMode: stats.gameMode,
        durationMs: stats.totalDuration,
        winCount: stats.winCount,
        totalGames: stats.totalGames,
        winRate:
          stats.totalGames > 0 ? (stats.winCount / stats.totalGames) * 100 : 0,
        averageDuration:
          stats.totalGames > 0 ? stats.totalDuration / stats.totalGames : 0,
        bestTime: stats.bestTime,
      }))
      .sort((a, b) => {
        // Primary sort: win rate (descending)
        if (a.winRate !== b.winRate) {
          return b.winRate - a.winRate;
        }
        // Secondary sort: total wins (descending)
        if (a.winCount !== b.winCount) {
          return b.winCount - a.winCount;
        }
        // Tertiary sort: best time (ascending, lower is better)
        if (a.bestTime && b.bestTime) {
          return a.bestTime - b.bestTime;
        }
        // Quaternary sort: average duration (ascending)
        return a.averageDuration - b.averageDuration;
      })
      .slice(0, parseInt(limit as string))
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    logger.info(
      `Leaderboard query: gameType=${gameType}, difficulty=${difficulty}, mode=${mode}, limit=${limit}, timeRange=${timeRange}, results=${leaderboard.length}`
    );

    res.json({
      leaderboard,
      query: {
        gameType,
        difficulty,
        mode,
        limit,
        timeRange,
      },
      total: leaderboard.length,
    });
  } catch (error) {
    logger.error("Leaderboard query failed:", error);
    console.error("Leaderboard error details:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res
      .status(500)
      .json({ error: "Failed to fetch leaderboard", details: errorMessage });
  }
});

/**
 * GET /api/leaderboard/user/:userId
 * Get leaderboard stats for a specific user
 */
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { gameType = "player_rush", difficulty, mode } = req.query;

    const gameSessionRepo = AppDataSource.getRepository(DBGameSession);

    const whereConditions: any = [
      { game_type: gameType, player1_id: userId },
      { game_type: gameType, player2_id: userId },
    ];

    // Apply filters to both conditions
    if (difficulty) {
      whereConditions.forEach((condition: any) => {
        condition.difficulty = difficulty;
      });
    }

    if (mode) {
      whereConditions.forEach((condition: any) => {
        condition.game_mode = mode;
      });
    }

    const userSessions = await gameSessionRepo.find({
      where: whereConditions,
      order: { createdAt: "DESC" },
    });

    const stats = {
      userId,
      totalGames: userSessions.length,
      wins: userSessions.filter((s) => s.winner_id === userId).length,
      losses: userSessions.filter((s) => s.winner_id && s.winner_id !== userId)
        .length,
      winRate:
        userSessions.length > 0
          ? (userSessions.filter((s) => s.winner_id === userId).length /
              userSessions.length) *
            100
          : 0,
      averageDuration:
        userSessions.length > 0
          ? userSessions.reduce((sum, s) => sum + (s.duration_ms || 0), 0) /
            userSessions.length
          : 0,
      bestTime: userSessions
        .filter((s) => s.winner_id === userId && s.duration_ms)
        .reduce(
          (best, s) => (!best || s.duration_ms! < best ? s.duration_ms! : best),
          0 as number | undefined
        ),
      recentGames: userSessions.slice(0, 10).map((s) => ({
        id: s.id,
        gameMode: s.game_mode,
        difficulty: s.difficulty,
        startPlayer: s.start_player_id,
        endPlayer: s.end_player_id,
        won: s.winner_id === userId,
        durationMs: s.duration_ms,
        createdAt: s.createdAt,
      })),
    };

    res.json(stats);
  } catch (error) {
    logger.error("User leaderboard query failed:", error);
    res.status(500).json({ error: "Failed to fetch user stats" });
  }
});

export default router;
