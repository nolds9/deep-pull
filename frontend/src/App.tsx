import React from "react";
import { ThemeProvider, CssBaseline, createTheme } from "@mui/material";
// Placeholder imports for screens (to be implemented)
import HomeScreen from "./screens/HomeScreen.js";
import QueueScreen from "./screens/QueueScreen.js";
import GameScreen from "./screens/GameScreen.js";
import EndGameScreen from "./screens/EndGameScreen.js";
import HowToPlayScreen from "./screens/HowToPlayScreen.js";

const theme = createTheme();

// For now, use React state for screen switching; will migrate to XState
export default function App() {
  const [screen, setScreen] = React.useState<
    "home" | "queue" | "countdown" | "game" | "end" | "howto"
  >("home");

  let content = null;
  switch (screen) {
    case "home":
      content = (
        <HomeScreen
          onPlay={() => setScreen("queue")}
          onHowToPlay={() => setScreen("howto")}
        />
      );
      break;
    case "queue":
      content = (
        <QueueScreen
          onMatched={() => setScreen("countdown")}
          onBack={() => setScreen("home")}
        />
      );
      break;
    case "countdown":
      content = <div>Countdown... (to be implemented)</div>;
      break;
    case "game":
      content = <GameScreen onGameEnd={() => setScreen("end")} />;
      break;
    case "end":
      content = (
        <EndGameScreen
          onPlayAgain={() => setScreen("queue")}
          onHome={() => setScreen("home")}
        />
      );
      break;
    case "howto":
      content = <HowToPlayScreen onBack={() => setScreen("home")} />;
      break;
    default:
      content = <div>Unknown screen</div>;
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {content}
    </ThemeProvider>
  );
}
