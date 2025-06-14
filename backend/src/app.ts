import "reflect-metadata";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { AppDataSource } from "./config";
import { GameManager } from "./services/game-manager";
import * as dotenv from "dotenv";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

AppDataSource.initialize()
  .then(() => {
    console.log("Database connected");
    const gameManager = new GameManager(io);
    io.on("connection", (socket) => {
      socket.on("joinQueue", () => gameManager.joinQueue(socket.id));
      socket.on("submitPath", (data) =>
        gameManager.submitPath(data.sessionId, socket.id, data.path)
      );
    });
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database connection error:", err);
  });
