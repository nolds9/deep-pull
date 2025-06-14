const { io } = require("socket.io-client");

const SERVER_URL = "http://localhost:3001";
const socket = io(SERVER_URL);

socket.on("connect", () => {
  console.log(`[TestClient] Connected as ${socket.id}`);
  socket.emit("joinQueue");
  console.log("[TestClient] Sent joinQueue");
});

socket.on("gameStart", (data) => {
  console.log("[TestClient] Game started!");
  console.log(JSON.stringify(data, null, 2));
  // For demo, auto-submit a fake path (startPlayer.id, endPlayer.id)
  setTimeout(() => {
    const path = [data.startPlayer.id, data.endPlayer.id];
    socket.emit("submitPath", { sessionId: data.sessionId, path });
    console.log(`[TestClient] Submitted path: ${path.join(" -> ")}`);
  }, 1000);
});

socket.on("gameEnd", (data) => {
  console.log("[TestClient] Game ended!");
  console.log(JSON.stringify(data, null, 2));
  socket.disconnect();
});

socket.on("disconnect", () => {
  console.log("[TestClient] Disconnected");
});
