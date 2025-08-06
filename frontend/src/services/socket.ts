import { io, Socket } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

interface SocketEvents {
  connect: () => void;
  disconnect: (reason: string) => void;
  connect_error: (error: Error) => void;
  gameStart: (data: unknown) => void;
  gameEnd: (data: unknown) => void;
  opponentReady: () => void;
  allPlayersReady: () => void;
  invalidPath: (data: unknown) => void;
  opponentAttemptedPath: (data: unknown) => void;
  gameCreationError: (data: unknown) => void;
}

class SocketService {
  private socket: Socket<SocketEvents> | null = null;
  private authToken: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(token: string): Socket<SocketEvents> {
    this.authToken = token;

    this.socket = io(SERVER_URL, {
      transports: ["websocket"],
      auth: (cb) => {
        cb({ token });
      },
    });

    this.setupEventHandlers();
    return this.socket;
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      console.log("Socket connected:", this.socket?.id);
      this.reconnectAttempts = 0;
    });

    this.socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      if (reason === "io server disconnect") {
        // Server disconnected us, try to reconnect
        this.socket?.connect();
      }
    });

    this.socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      this.handleConnectionError();
    });
  }

  private handleConnectionError() {
    this.reconnectAttempts++;
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      console.log(
        `Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`
      );
      setTimeout(() => {
        if (this.socket && this.authToken) {
          this.socket.auth = (cb) => {
            cb({ token: this.authToken! });
          };
          this.socket.connect();
        }
      }, 1000 * this.reconnectAttempts); // Exponential backoff
    } else {
      console.error("Max reconnection attempts reached");
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.authToken = null;
    this.reconnectAttempts = 0;
  }

  getSocket(): Socket<SocketEvents> | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Game-specific methods
  joinQueue(difficulty: string) {
    if (this.socket) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.socket as any).emit("joinQueue", { difficulty });
    }
  }

  leaveQueue() {
    if (this.socket) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.socket as any).emit("leaveQueue");
    }
  }

  submitPath(sessionId: string, path: string[]) {
    if (this.socket) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.socket as any).emit("submitPath", { sessionId, path });
    }
  }

  playerReady(sessionId: string) {
    if (this.socket) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.socket as any).emit("playerReady", { sessionId });
    }
  }

  giveUp(sessionId: string) {
    if (this.socket) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.socket as any).emit("giveUp", { sessionId });
    }
  }
}

// Export singleton instance
export const socketService = new SocketService();

// Legacy export for backward compatibility during migration
export const socket = socketService.getSocket();
