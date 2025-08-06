import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { MainLayout } from "./layouts/MainLayout";

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
      <MainLayout isHome={true}>
        <HomeScreen />
      </MainLayout>
    ),
  },
  {
    path: "/profile",
    element: (
      <MainLayout title="Profile">
        <ProfileScreen />
      </MainLayout>
    ),
  },
  {
    path: "/mode",
    element: (
      <MainLayout title="Select Mode">
        <ModeScreen />
      </MainLayout>
    ),
  },
  {
    path: "/how-to-play",
    element: (
      <MainLayout title="How to Play">
        <HowToPlayScreen />
      </MainLayout>
    ),
  },
  // Game routes
  {
    path: "/game",
    element: (
      <MainLayout title="Player Rush" maxWidth="xl">
        <GameScreen />
      </MainLayout>
    ),
  },
  {
    path: "/lobby",
    element: (
      <MainLayout title="Game Lobby">
        <LobbyScreen />
      </MainLayout>
    ),
  },
  {
    path: "/queue",
    element: (
      <MainLayout title="Finding Players...">
        <QueueScreen />
      </MainLayout>
    ),
  },
  {
    path: "/end-game",
    element: (
      <MainLayout title="Game Over">
        <EndGameScreen />
      </MainLayout>
    ),
  },
]);

export const AppRouter: React.FC = () => {
  return <RouterProvider router={router} />;
};
