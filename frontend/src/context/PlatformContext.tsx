import React, { createContext, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";

export type GameType = "player-rush" | "gladiator" | "team-battle";

interface PlatformContextType {
  selectedGame: GameType | null;
  setSelectedGame: (game: GameType | null) => void;
  navigateToGame: (game: GameType) => void;
  navigateToHome: () => void;
}

const PlatformContext = createContext<PlatformContextType | null>(null);

export const usePlatform = () => {
  const context = useContext(PlatformContext);
  if (!context) {
    throw new Error("usePlatform must be used within a PlatformProvider");
  }
  return context;
};

interface PlatformProviderProps {
  children: React.ReactNode;
}

export const PlatformProvider: React.FC<PlatformProviderProps> = ({
  children,
}) => {
  const navigate = useNavigate();
  const [selectedGame, setSelectedGame] = useState<GameType | null>(null);

  const navigateToGame = (game: GameType) => {
    setSelectedGame(game);
    navigate(`/games/${game}`);
  };

  const navigateToHome = () => {
    setSelectedGame(null);
    navigate("/");
  };

  const contextValue: PlatformContextType = {
    selectedGame,
    setSelectedGame,
    navigateToGame,
    navigateToHome,
  };

  return (
    <PlatformContext.Provider value={contextValue}>
      {children}
    </PlatformContext.Provider>
  );
};
