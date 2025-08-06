import { useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { socketService } from "../services/socket";

export const useSocket = () => {
  const { isSignedIn, getToken } = useAuth();

  const connect = useCallback(async () => {
    if (isSignedIn) {
      try {
        const token = await getToken();
        if (token) {
          return socketService.connect(token);
        }
      } catch (error) {
        console.error("Failed to get auth token:", error);
      }
    }
    return null;
  }, [isSignedIn, getToken]);

  const disconnect = useCallback(() => {
    socketService.disconnect();
  }, []);

  useEffect(() => {
    if (isSignedIn) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isSignedIn, connect, disconnect]);

  return {
    socket: socketService.getSocket(),
    isConnected: socketService.isConnected(),
    connect,
    disconnect,
    // Game methods
    joinQueue: socketService.joinQueue.bind(socketService),
    leaveQueue: socketService.leaveQueue.bind(socketService),
    submitPath: socketService.submitPath.bind(socketService),
    playerReady: socketService.playerReady.bind(socketService),
    giveUp: socketService.giveUp.bind(socketService),
  };
};
