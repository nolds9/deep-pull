import React from "react";
import { createBrowserRouter, RouterProvider, Outlet } from "react-router-dom";
import { MainLayout } from "./layouts/MainLayout";
import { PlatformProvider } from "./context/PlatformContext";
import { GameProvider } from "./games/player-rush/context/GameContext";

// Import pages
import HomeScreen from "./pages/HomeScreen";
import ProfileScreen from "./pages/ProfileScreen";

// Import game screens
import GameScreen from "./games/player-rush/screens/GameScreen";
import LobbyScreen from "./games/player-rush/screens/LobbyScreen";
import EndGameScreen from "./games/player-rush/screens/EndGameScreen";
import QueueScreen from "./games/player-rush/screens/QueueScreen";
import LoadingScreen from "./games/player-rush/screens/LoadingScreen";
import CountdownScreen from "./games/player-rush/screens/CountdownScreen";
import ModeScreen from "./games/player-rush/screens/ModeScreen";
import PlayerRushHomeScreen from "./games/player-rush/screens/HomeScreen";
import PlayerRushHowToPlayScreen from "./games/player-rush/screens/HowToPlayScreen";

// Root layout component that includes PlatformProvider
const RootLayout: React.FC = () => {
  return (
    <PlatformProvider>
      <Outlet />
    </PlatformProvider>
  );
};

// Game layout component that includes GameProvider
const GameLayout: React.FC = () => {
  return (
    <GameProvider>
      <Outlet />
    </GameProvider>
  );
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: (
          <MainLayout isHome={true}>
            <HomeScreen />
          </MainLayout>
        ),
      },
      {
        path: "profile",
        element: (
          <MainLayout title="Profile">
            <ProfileScreen />
          </MainLayout>
        ),
      },
      // Game routes - nested under /games/player-rush
      {
        path: "games/player-rush",
        element: <GameLayout />,
        children: [
          {
            index: true,
            element: (
              <MainLayout title="Player Rush">
                <PlayerRushHomeScreen />
              </MainLayout>
            ),
          },
          {
            path: "how-to-play",
            element: (
              <MainLayout title="How to Play Player Rush">
                <PlayerRushHowToPlayScreen />
              </MainLayout>
            ),
          },
          {
            path: "mode",
            element: (
              <MainLayout title="Select Mode">
                <ModeScreen />
              </MainLayout>
            ),
          },
          {
            path: "game",
            element: (
              <MainLayout title="Player Rush" maxWidth="xl">
                <GameScreen />
              </MainLayout>
            ),
          },
          {
            path: "lobby",
            element: (
              <MainLayout title="Game Lobby">
                <LobbyScreen />
              </MainLayout>
            ),
          },
          {
            path: "queue",
            element: (
              <MainLayout title="Finding Players...">
                <QueueScreen />
              </MainLayout>
            ),
          },
          {
            path: "loading",
            element: (
              <MainLayout title="Loading...">
                <LoadingScreen />
              </MainLayout>
            ),
          },
          {
            path: "countdown",
            element: (
              <MainLayout title="Get Ready!">
                <CountdownScreen />
              </MainLayout>
            ),
          },
          {
            path: "end-game",
            element: (
              <MainLayout title="Game Over">
                <EndGameScreen />
              </MainLayout>
            ),
          },
        ],
      },
    ],
  },
]);

export const AppRouter: React.FC = () => {
  return <RouterProvider router={router} />;
};
