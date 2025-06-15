import React from "react";
import { ThemeProvider, CssBaseline, createTheme, Box } from "@mui/material";
import { useMachine } from "@xstate/react";
import { gameMachine } from "./state/gameMachine";
import { socket } from "./socket";
import type { Player } from "./types";

import HomeScreen from "./screens/HomeScreen.js";
import QueueScreen from "./screens/QueueScreen.js";
import LobbyScreen from "./screens/LobbyScreen.js";
import GameScreen from "./screens/GameScreen.js";
import EndGameScreen from "./screens/EndGameScreen.js";
import HowToPlayScreen from "./screens/HowToPlayScreen.js";
import Countdown from "./components/Countdown";
import GameTimer from "./components/GameTimer";

const theme = createTheme();

export default function App() {
  const [state, send] = useMachine(gameMachine);

  React.useEffect(() => {
    const onConnect = () => console.log("Socket connected:", socket.id);
    const onGameStart = (data: {
      sessionId: string;
      startPlayer: Player;
      endPlayer: Player;
      opponent: string;
    }) => {
      console.log("Game started:", data);
      send({
        type: "MATCHED",
        data: {
          sessionId: data.sessionId,
          startPlayer: data.startPlayer,
          endPlayer: data.endPlayer,
          opponentId: data.opponent,
        },
      });
    };

    const onOpponentReady = () => {
      console.log("Opponent is ready");
      send({ type: "OPPONENT_READY" });
    };

    const onAllPlayersReady = () => {
      console.log("All players are ready");
      send({ type: "ALL_PLAYERS_READY" });
    };

    const onGameEnd = (data: { winnerId?: string; winningPath: string[] }) => {
      console.log("Game ended:", data);
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

  let content = null;
  switch (state.value) {
    case "home":
      content = (
        <HomeScreen
          onPlay={() => send({ type: "PLAY" })}
          onHowToPlay={() => send({ type: "HOW_TO_PLAY" })}
        />
      );
      break;
    case "queue":
      content = <QueueScreen onBack={() => send({ type: "BACK" })} />;
      break;
    case "lobby":
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
      break;
    case "countdown":
      content = <Countdown onDone={() => send({ type: "COUNTDOWN_DONE" })} />;
      break;
    case "game":
      if (state.context.startPlayer && state.context.endPlayer) {
        content = (
          <>
            <GameScreen
              startPlayer={state.context.startPlayer}
              endPlayer={state.context.endPlayer}
              onGameEnd={() =>
                socket.emit("forceEndGame", {
                  sessionId: state.context.sessionId,
                })
              }
            />
            <GameTimer seconds={state.context.timer} />
          </>
        );
      }
      break;
    case "end":
      content = (
        <EndGameScreen
          isWinner={state.context.winnerId === socket.id}
          reason={state.context.winningPath?.[0]}
          onPlayAgain={() => send({ type: "PLAY_AGAIN" })}
          onHome={() => send({ type: "HOME" })}
        />
      );
      break;
    case "howto":
      content = <HowToPlayScreen onBack={() => send({ type: "BACK" })} />;
      break;
    default:
      content = <div>Unknown screen</div>;
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
        }}
      >
        {content}
      </Box>
    </ThemeProvider>
  );
}
