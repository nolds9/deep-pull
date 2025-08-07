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
    startSinglePlayerGame: socketStartSinglePlayerGame,
    submitPath: socketSubmitPath,
    playerReady: socketPlayerReady,
    giveUp: socketGiveUp,
  } = useSocket();

  const [state, send] = useMachine(gameMachine);

  const socketRef = useRef(socket);
  socketRef.current = socket;

  // Track the last logged state to prevent duplicate logs
  const lastLoggedState = useRef<string | null>(null);

  // Navigation effects based on game state
  useEffect(() => {
    const currentState = state.value;
    const stateString =
      typeof currentState === "string"
        ? currentState
        : JSON.stringify(currentState);

    // Only log if the state has actually changed
    if (lastLoggedState.current !== stateString) {
      console.log(
        "Game state changed to:",
        currentState,
        "context:",
        state.context
      );
      console.log("State type:", typeof currentState);
      console.log("State string:", stateString);
      lastLoggedState.current = stateString;
    }

    // Handle both string states and compound states
    if (typeof currentState === "string") {
      switch (currentState) {
        case "home":
          if (window.location.pathname !== "/") {
            navigate("/");
          }
          break;
        case "modeSelection":
          if (window.location.pathname !== "/mode") {
            navigate("/mode");
          }
          break;
        case "loading":
          if (state.context.mode === "multiplayer") {
            if (window.location.pathname !== "/queue") {
              navigate("/queue");
            }
          } else {
            if (window.location.pathname !== "/loading") {
              navigate("/loading");
            }
          }
          break;
        case "lobby":
          if (window.location.pathname !== "/lobby") {
            navigate("/lobby");
          }
          break;
        case "end":
          if (window.location.pathname !== "/end-game") {
            navigate("/end-game");
          }
          break;
        case "howto":
          if (window.location.pathname !== "/how-to-play") {
            navigate("/how-to-play");
          }
          break;
        case "profile":
          if (window.location.pathname !== "/profile") {
            navigate("/profile");
          }
          break;
        case "countdown":
          console.log("Navigation: Navigating to /countdown");
          console.log(
            "Navigation: Current URL before navigation:",
            window.location.pathname
          );
          if (window.location.pathname !== "/countdown") {
            navigate("/countdown");
            console.log("Navigation: Navigate function called");
          }
          break;
      }
    } else if (typeof currentState === "object" && currentState !== null) {
      // Handle compound states
      if ("game" in currentState) {
        if (window.location.pathname !== "/game") {
          navigate("/game");
        }
      } else if ("countdown" in currentState) {
        if (window.location.pathname !== "/countdown") {
          navigate("/countdown");
        }
      }
    }
  }, [state.value, state.context, navigate, state.context.mode]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleGameStart = (data: unknown) => {
      console.log("Received gameStart event:", data);
      console.log(
        "Current state machine state before transition:",
        state.value
      );
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
      console.log("Sending GAME_START to state machine with data:", gameData);
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

    // For single player games, we need to call the backend to start a game
    if (state.context.mode === "single" && socket && state.context.difficulty) {
      // Call the backend to start a single player game
      // The backend will emit a gameStart event when the game is ready
      console.log(
        "Starting single player game with difficulty:",
        state.context.difficulty
      );
      socketStartSinglePlayerGame(state.context.difficulty);
    }
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
