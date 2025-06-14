import React from "react";
import { ThemeProvider, CssBaseline, createTheme, Box } from "@mui/material";
import { useMachine } from "@xstate/react";
import { gameMachine } from "./state/gameMachine";

import HomeScreen from "./screens/HomeScreen.js";
import QueueScreen from "./screens/QueueScreen.js";
import GameScreen from "./screens/GameScreen.js";
import EndGameScreen from "./screens/EndGameScreen.js";
import HowToPlayScreen from "./screens/HowToPlayScreen.js";
import Countdown from "./components/Countdown";
import GameTimer from "./components/GameTimer";

const theme = createTheme();

export default function App() {
  const [state, send] = useMachine(gameMachine);

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
      content = (
        <QueueScreen
          onMatched={() => send({ type: "MATCHED" })}
          onBack={() => send({ type: "BACK" })}
        />
      );
      break;
    case "countdown":
      content = <Countdown onDone={() => send({ type: "COUNTDOWN_DONE" })} />;
      break;
    case "game":
      content = (
        <>
          <GameScreen onGameEnd={() => send({ type: "GAME_END" })} />
          <GameTimer seconds={state.context.timer} />
        </>
      );
      break;
    case "end":
      content = (
        <EndGameScreen
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
