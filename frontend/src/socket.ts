import { io } from "socket.io-client";

const SERVER_URL = "http://localhost:3001";

// Create and export the socket client instance.
export const socket = io(SERVER_URL, {
  transports: ["websocket"], // Explicitly use websockets for reliability
});
