import { useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { socketService } from "../services/socket";

export const useSocket = () => {
  const { isSignedIn, getToken } = useAuth();

  const connect = useCallback(async () => {
    console.log("useSocket: connect called, isSignedIn:", isSignedIn);
    if (isSignedIn) {
      try {
        const token = await getToken();
        if (token) {
          console.log("useSocket: Got token, attempting socket connection");
          return socketService.connect(token);
        } else {
          console.log("useSocket: No token available");
        }
      } catch (error) {
        console.error("useSocket: Failed to get auth token:", error);
      }
    } else {
      console.log("useSocket: User not signed in, skipping connection");
    }
    return null;
  }, [isSignedIn, getToken]);

  const disconnect = useCallback(() => {
    console.log("useSocket: disconnect called");
    socketService.disconnect();
  }, []);

  useEffect(() => {
    console.log("useSocket: useEffect triggered, isSignedIn:", isSignedIn);
    if (isSignedIn) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      console.log("useSocket: cleanup - disconnecting");
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
    startSinglePlayerGame:
      socketService.startSinglePlayerGame.bind(socketService),
    submitPath: socketService.submitPath.bind(socketService),
    playerReady: socketService.playerReady.bind(socketService),
    giveUp: socketService.giveUp.bind(socketService),
  };
};
