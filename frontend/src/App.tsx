import React from "react";
import {
  ThemeProvider,
  CssBaseline,
  createTheme,
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
} from "@mui/material";
import { useMachine } from "@xstate/react";
import { gameMachine } from "./state/gameMachine";
import type { GameEvent } from "./state/gameMachine";
import { socket } from "./socket";
import { AnimatePresence, motion } from "motion/react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useAuth,
  useUser,
} from "@clerk/clerk-react";

import HomeScreen from "./screens/HomeScreen";
import QueueScreen from "./screens/QueueScreen";
import LobbyScreen from "./screens/LobbyScreen";
import GameScreen from "./screens/GameScreen";
import EndGameScreen from "./screens/EndGameScreen";
import HowToPlayScreen from "./screens/HowToPlayScreen";
import Countdown from "./components/Countdown";
import GameTimer from "./components/GameTimer";
import ModeScreen from "./screens/ModeScreen";
import ProfileScreen from "./screens/ProfileScreen";

const theme = createTheme();

const getScreenBackground = (
  state: ReturnType<typeof useMachine<typeof gameMachine>>[0]
) => {
  if (state.matches("home") || state.matches("modeSelection")) {
    return "linear-gradient(135deg, #0f2027 0%, #2c5364 100%)";
  }
  if (state.matches("game")) {
    return "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)";
  }
  // Default for profile, howto, loading, end, lobby, countdown etc.
  return "linear-gradient(135deg, #232526 0%, #414345 100%)";
};

// Extract event data types from the GameEvent union
type GameStartData = Extract<GameEvent, { type: "GAME_START" }>["data"];
type GameEndData = Extract<GameEvent, { type: "GAME_END" }>["data"];

const Header = ({ isHome }: { isHome: boolean }) => {
  return (
    <AppBar position="static" color="transparent" elevation={0}>
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          {!isHome && "Player Rush"}
        </Typography>
        <SignedIn>
          <UserButton />
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <Button color="inherit">Sign In</Button>
          </SignInButton>
        </SignedOut>
      </Toolbar>
    </AppBar>
  );
};

export default function App() {
  const [state, send] = useMachine(gameMachine);
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();

  React.useEffect(() => {
    // Effect to manage socket connection based on auth state
    const manageSocketConnection = async () => {
      if (isSignedIn) {
        console.log("User is signed in, configuring socket...");

        // Provide a function to socket.auth. This is called on every connection
        // attempt, ensuring a fresh, valid token is used, which fixes the
        // "JWT expired" error on reconnects.
        socket.auth = async (cb) => {
          const token = await getToken();
          cb({ token });
        };

        // Sync user with backend
        const token = await getToken();
        if (token) {
          fetch(`${import.meta.env.VITE_API_BASE_URL}/api/user/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }

        if (socket.disconnected) {
          socket.connect();
        }
      } else {
        console.log("User is not signed in, disconnecting socket.");
        if (socket.connected) {
          socket.disconnect();
        }
      }
    };
    manageSocketConnection();
  }, [isSignedIn, getToken]);

  React.useEffect(() => {
    // This effect handles emitting socket events when the state machine requests it
    if (state.value === "loading" && state.context.difficulty) {
      if (!isSignedIn) {
        console.error("Attempted to start a game while not signed in.");
        send({ type: "BACK" }); // Or a more specific event
        return;
      }
      if (state.context.mode === "single") {
        socket.emit("startSinglePlayerGame", {
          difficulty: state.context.difficulty,
        });
      } else if (state.context.mode === "multiplayer") {
        socket.emit("joinQueue", { difficulty: state.context.difficulty });
      }
    }
  }, [
    state.value,
    state.context.mode,
    state.context.difficulty,
    isSignedIn,
    send,
  ]);

  React.useEffect(() => {
    const onConnect = () => console.log("Socket connected:", socket.id);
    const onGameStart = (data: GameStartData) => {
      console.log("Game started:", data);
      send({ type: "GAME_START", data });
    };

    const onOpponentReady = () => {
      console.log("Opponent is ready");
      send({ type: "OPPONENT_READY" });
    };

    const onAllPlayersReady = () => {
      console.log("All players are ready");
      send({ type: "ALL_PLAYERS_READY" });
    };

    const onGameEnd = (data: GameEndData) => {
      console.log("Game ended event received:", data);
      send({ type: "GAME_END", data });
    };

    socket.on("connect", onConnect);
    socket.on("gameStart", onGameStart);
    socket.on("opponentReady", onOpponentReady);
    socket.on("allPlayersReady", onAllPlayersReady);
    socket.on("gameEnd", onGameEnd);

    return () => {
      socket.off("connect", onConnect);
      socket.off("gameStart", onGameStart);
      socket.off("opponentReady", onOpponentReady);
      socket.off("allPlayersReady", onAllPlayersReady);
      socket.off("gameEnd", onGameEnd);
    };
  }, [send]);

  React.useEffect(() => {
    // This effect can be used to handle navigation for the UserButton
    if (window.location.pathname === "/profile" && state.value !== "profile") {
      send({ type: "VIEW_PROFILE" });
    }
  }, [state.value, send]);

  let content = null;

  if (state.matches("home")) {
    content = (
      <HomeScreen
        onPlay={() => {
          if (isSignedIn) {
            send({ type: "PLAY" });
          } else {
            // In a real app, you might trigger the sign-in modal here
            // For now, the button will be handled by Clerk's components
            console.log("Please sign in to play.");
          }
        }}
        onHowToPlay={() => send({ type: "HOW_TO_PLAY" })}
        isSignedIn={isSignedIn}
      />
    );
  } else if (state.matches("profile")) {
    content = <ProfileScreen onBack={() => send({ type: "BACK" })} />;
  } else if (state.matches("modeSelection")) {
    content = (
      <ModeScreen
        mode={state.context.mode}
        difficulty={state.context.difficulty}
        onModeChange={(mode) => send({ type: "SET_MODE", mode })}
        onDifficultyChange={(difficulty) =>
          send({ type: "SET_DIFFICULTY", difficulty })
        }
        onStart={() => send({ type: "START_GAME" })}
        onBack={() => send({ type: "BACK" })}
      />
    );
  } else if (state.matches("loading")) {
    content = (
      <QueueScreen
        mode={state.context.mode}
        onBack={() => {
          send({ type: "BACK" });
          if (state.context.mode === "multiplayer") {
            socket.emit("leaveQueue");
          }
        }}
      />
    );
  } else if (state.matches("lobby")) {
    content = (
      <LobbyScreen
        myReady={state.context.myReady}
        opponentReady={state.context.opponentReady}
        onReady={() => {
          send({ type: "READY_UP" });
          socket.emit("playerReady", { sessionId: state.context.sessionId });
        }}
      />
    );
  } else if (state.matches("countdown")) {
    content = <Countdown onDone={() => send({ type: "COUNTDOWN_DONE" })} />;
  } else if (state.matches("game")) {
    if (state.context.startPlayer && state.context.endPlayer) {
      content = (
        <>
          <GameScreen
            startPlayer={state.context.startPlayer}
            endPlayer={state.context.endPlayer}
            sessionId={state.context.sessionId!}
            onPathSubmit={(path: string[]) => {
              socket.emit("submitPath", {
                sessionId: state.context.sessionId,
                path: path,
              });
            }}
            mode={state.context.mode}
            strikes={state.context.strikes}
            maxStrikes={state.context.maxStrikes}
            stopwatch={state.context.stopwatch}
          />
          {state.context.mode === "multiplayer" && (
            <GameTimer seconds={state.context.timer} />
          )}
        </>
      );
    }
  } else if (state.matches("end")) {
    content = (
      <EndGameScreen
        isWinner={
          state.context.winnerId === user?.id || // Compare with Clerk user ID
          (state.context.mode === "single" && !!state.context.score)
        }
        reason={state.context.reason}
        winningPath={state.context.winningPath}
        solutionPaths={state.context.solutionPaths}
        onPlayAgain={() => send({ type: "PLAY_AGAIN" })}
        onHome={() => send({ type: "HOME" })}
        score={state.context.score}
        time={state.context.stopwatch}
        mode={state.context.mode}
      />
    );
  } else if (state.matches("howto")) {
    content = <HowToPlayScreen onBack={() => send({ type: "BACK" })} />;
  } else {
    content = <div>Unknown screen: {JSON.stringify(state.value)}</div>;
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          width: "100vw",
          overflow: "hidden",
          background: getScreenBackground(state),
        }}
      >
        <Header isHome={state.matches("home")} />
        <AnimatePresence mode="wait">
          <motion.div
            key={JSON.stringify(state.value)}
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.3 }}
            style={{
              display: "flex",
              flexDirection: "column",
              flexGrow: 1,
            }}
          >
            {content}
          </motion.div>
        </AnimatePresence>
      </Box>
    </ThemeProvider>
  );
}
