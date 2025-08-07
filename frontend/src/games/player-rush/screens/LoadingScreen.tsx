import React from "react";
import { Box, Typography, CircularProgress } from "@mui/material";
import { useGame } from "../context/GameContext";

const LoadingScreen: React.FC = () => {
  const { state } = useGame();
  const { mode } = state.context;

  console.log("LoadingScreen: Component rendered, mode:", mode);

  const getLoadingMessage = () => {
    if (mode === "multiplayer") {
      return "Finding players...";
    } else {
      return "Setting up your game...";
    }
  };

  return (
    <Box
      sx={{
        flexGrow: 1,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #232526 0%, #414345 100%)",
        color: "white",
        minHeight: "100vh",
        gap: 3,
      }}
    >
      <CircularProgress size={60} color="primary" />
      <Typography variant="h5" textAlign="center">
        {getLoadingMessage()}
      </Typography>
      <Typography variant="body1" textAlign="center" color="grey.300">
        Please wait...
      </Typography>
    </Box>
  );
};

export default LoadingScreen;
