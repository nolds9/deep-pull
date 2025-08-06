import React, { createContext, useContext, useEffect, useRef } from "react";
import { useMachine } from "@xstate/react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../../../hooks/useSocket";
import {
  gameMachine,
  type GameMode,
  type Difficulty,
} from "../state/gameMachine";
import type { Player } from "../../../types";
import type { ActorRefFrom, StateFrom } from "xstate";

interface GameContextType {
  state: StateFrom<typeof gameMachine>;
  send: ActorRefFrom<typeof gameMachine>["send"];
  mode: GameMode;
  difficulty: Difficulty;
  setMode: (mode: GameMode) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  startGame: () => void;
  joinQueue: () => void;
  leaveQueue: () => void;
  submitPath: (path: string[]) => void;
  playerReady: () => void;
  giveUp: () => void;
}

const GameContext = createContext<GameContextType | null>(null);

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
};

interface GameProviderProps {
  children: React.ReactNode;
}

export const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
  const navigate = useNavigate();
  const {
    socket,
    joinQueue: socketJoinQueue,
    leaveQueue: socketLeaveQueue,
    submitPath: socketSubmitPath,
    playerReady: socketPlayerReady,
    giveUp: socketGiveUp,
  } = useSocket();

  const [state, send] = useMachine(gameMachine);

  const socketRef = useRef(socket);
  socketRef.current = socket;

  // Navigation effects based on game state
  useEffect(() => {
    const currentState = state.value;

    if (typeof currentState === "string") {
      switch (currentState) {
        case "home":
          navigate("/");
          break;
        case "modeSelection":
          navigate("/mode");
          break;
        case "loading":
          if (state.context.mode === "multiplayer") {
            navigate("/queue");
          }
          break;
        case "lobby":
          navigate("/lobby");
          break;
        case "game":
          navigate("/game");
          break;
        case "end":
          navigate("/end-game");
          break;
        case "howto":
          navigate("/how-to-play");
          break;
        case "profile":
          navigate("/profile");
          break;
      }
    }
  }, [state.value, navigate, state.context.mode]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleGameStart = (data: unknown) => {
      const gameData = data as {
        sessionId: string;
        startPlayer: Player;
        endPlayer: Player;
        opponentId?: string;
        mode: GameMode;
        difficulty: Difficulty;
        strikes: number;
        maxStrikes: number;
      };
      send({ type: "GAME_START", data: gameData });
    };

    const handleGameEnd = (data: unknown) => {
      const gameData = data as {
        winnerId?: string | null;
        winningPath: string[];
        solutionPaths?: string[][];
        score?: number;
        reason?: string;
      };
      send({ type: "GAME_END", data: gameData });
    };

    const handleOpponentReady = () => {
      send({ type: "OPPONENT_READY" });
    };

    const handleAllPlayersReady = () => {
      send({ type: "ALL_PLAYERS_READY" });
    };

    const handleInvalidPath = (data: unknown) => {
      // Handle invalid path feedback
      console.log("Invalid path:", data);
    };

    const handleOpponentAttemptedPath = (data: unknown) => {
      // Handle opponent path attempt feedback
      console.log("Opponent attempted path:", data);
    };

    const handleGameCreationError = (data: unknown) => {
      const errorData = data as { message: string };
      console.error("Game creation error:", errorData.message);
      // Navigate back to mode selection
      navigate("/mode");
    };

    socket.on("gameStart", handleGameStart);
    socket.on("gameEnd", handleGameEnd);
    socket.on("opponentReady", handleOpponentReady);
    socket.on("allPlayersReady", handleAllPlayersReady);
    socket.on("invalidPath", handleInvalidPath);
    socket.on("opponentAttemptedPath", handleOpponentAttemptedPath);
    socket.on("gameCreationError", handleGameCreationError);

    return () => {
      socket.off("gameStart", handleGameStart);
      socket.off("gameEnd", handleGameEnd);
      socket.off("opponentReady", handleOpponentReady);
      socket.off("allPlayersReady", handleAllPlayersReady);
      socket.off("invalidPath", handleInvalidPath);
      socket.off("opponentAttemptedPath", handleOpponentAttemptedPath);
      socket.off("gameCreationError", handleGameCreationError);
    };
  }, [socket, send, navigate]);

  const setMode = (mode: GameMode) => {
    send({ type: "SET_MODE", mode });
  };

  const setDifficulty = (difficulty: Difficulty) => {
    send({ type: "SET_DIFFICULTY", difficulty });
  };

  const startGame = () => {
    send({ type: "START_GAME" });
  };

  const joinQueue = () => {
    if (socket && state.context.difficulty) {
      socketJoinQueue(state.context.difficulty);
    }
  };

  const leaveQueue = () => {
    if (socket) {
      socketLeaveQueue();
    }
  };

  const submitPath = (path: string[]) => {
    if (socket && state.context.sessionId) {
      socketSubmitPath(state.context.sessionId, path);
    }
  };

  const playerReady = () => {
    if (socket && state.context.sessionId) {
      socketPlayerReady(state.context.sessionId);
    }
  };

  const giveUp = () => {
    if (socket && state.context.sessionId) {
      socketGiveUp(state.context.sessionId);
    }
  };

  const contextValue: GameContextType = {
    state,
    send,
    mode: state.context.mode,
    difficulty: state.context.difficulty,
    setMode,
    setDifficulty,
    startGame,
    joinQueue,
    leaveQueue,
    submitPath,
    playerReady,
    giveUp,
  };

  return (
    <GameContext.Provider value={contextValue}>{children}</GameContext.Provider>
  );
};
