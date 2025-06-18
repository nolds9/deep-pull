import "reflect-metadata";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { AppDataSource } from "./config";
import { Difficulty, GameManager } from "./services/game-manager";
import * as dotenv from "dotenv";
import playerRoutes from "./routes/player";
import { logger } from "./utils/logger";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// --- REST API LOGGING ---
app.use(express.json());

// Log all REST requests
app.use((req, res, next) => {
  logger.info(
    `[REST] ${req.method} ${req.path} query=${JSON.stringify(
      req.query
    )} body=${JSON.stringify(req.body)}`
  );
  // Capture response status
  const start = Date.now();
  res.on("finish", () => {
    logger.info(
      `[REST] ${req.method} ${req.path} -> ${res.statusCode} (${
        Date.now() - start
      }ms)`
    );
  });
  next();
});

app.use("/api/players", playerRoutes);

// Error handling middleware
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error(
      `[REST ERROR] ${req.method} ${req.path} - ${err.stack || err}`
    );
    res.status(500).json({ error: "Internal server error" });
  }
);

// --- SOCKET.IO LOGGING ---
AppDataSource.initialize()
  .then(() => {
    logger.info("Database connected");
    const gameManager = new GameManager(io);
    io.on("connection", (socket) => {
      logger.info(`[Socket.io] Client connected: ${socket.id}`);
      // Log all incoming events
      const originalOn = socket.on.bind(socket);
      socket.on = (event: string, listener: (...args: any[]) => void) => {
        originalOn(event, (...args: any[]) => {
          logger.info(
            `[Socket.io] Received event '${event}' from ${
              socket.id
            } payload=${JSON.stringify(args)}`
          );
          listener(...args);
        });
        return socket;
      };
      // Register game events
      socket.on("joinQueue", (data: { difficulty: Difficulty }) =>
        gameManager.joinQueue(socket.id, data.difficulty)
      );
      socket.on("startSinglePlayerGame", (data: { difficulty: Difficulty }) => {
        gameManager.startSinglePlayerGame(socket.id, data.difficulty);
      });
      socket.on("leaveQueue", () => gameManager.leaveQueue(socket.id));
      socket.on("playerReady", (data) =>
        gameManager.playerReady(socket.id, data.sessionId)
      );
      socket.on("submitPath", (data) =>
        gameManager.submitPath(data.sessionId, socket.id, data.path)
      );
      socket.on("giveUp", (data) =>
        gameManager.handleGiveUp(socket.id, data.sessionId)
      );
      socket.on("forceEndGame", (data) => {
        gameManager.forceEndGame(socket.id, data.sessionId);
      });
      socket.on("disconnect", (reason) => {
        logger.info(
          `[Socket.io] Client disconnected: ${socket.id} reason=${reason}`
        );
        gameManager.handleDisconnect(socket.id);
      });
    });
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
      logger.info(`Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    logger.error("Database connection error:", err);
  });
