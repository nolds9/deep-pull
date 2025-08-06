import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { MainLayout } from "./layouts/MainLayout";
import { GameProvider } from "./games/player-rush/context/GameContext";

// Import pages
import HomeScreen from "./pages/HomeScreen";
import ProfileScreen from "./pages/ProfileScreen";
import ModeScreen from "./pages/ModeScreen";
import HowToPlayScreen from "./pages/HowToPlayScreen";

// Import game screens
import GameScreen from "./games/player-rush/screens/GameScreen";
import LobbyScreen from "./games/player-rush/screens/LobbyScreen";
import EndGameScreen from "./games/player-rush/screens/EndGameScreen";
import QueueScreen from "./games/player-rush/screens/QueueScreen";

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <GameProvider>
        <MainLayout isHome={true}>
          <HomeScreen />
        </MainLayout>
      </GameProvider>
    ),
  },
  {
    path: "/profile",
    element: (
      <GameProvider>
        <MainLayout title="Profile">
          <ProfileScreen />
        </MainLayout>
      </GameProvider>
    ),
  },
  {
    path: "/mode",
    element: (
      <GameProvider>
        <MainLayout title="Select Mode">
          <ModeScreen />
        </MainLayout>
      </GameProvider>
    ),
  },
  {
    path: "/how-to-play",
    element: (
      <GameProvider>
        <MainLayout title="How to Play">
          <HowToPlayScreen />
        </MainLayout>
      </GameProvider>
    ),
  },
  // Game routes
  {
    path: "/game",
    element: (
      <GameProvider>
        <MainLayout title="Player Rush" maxWidth="xl">
          <GameScreen />
        </MainLayout>
      </GameProvider>
    ),
  },
  {
    path: "/lobby",
    element: (
      <GameProvider>
        <MainLayout title="Game Lobby">
          <LobbyScreen />
        </MainLayout>
      </GameProvider>
    ),
  },
  {
    path: "/queue",
    element: (
      <GameProvider>
        <MainLayout title="Finding Players...">
          <QueueScreen />
        </MainLayout>
      </GameProvider>
    ),
  },
  {
    path: "/end-game",
    element: (
      <GameProvider>
        <MainLayout title="Game Over">
          <EndGameScreen />
        </MainLayout>
      </GameProvider>
    ),
  },
]);

export const AppRouter: React.FC = () => {
  return <RouterProvider router={router} />;
};
