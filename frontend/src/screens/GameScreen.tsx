import React from "react";
import { Box, Button, Typography } from "@mui/material";

interface GameScreenProps {
  onGameEnd: () => void;
}

const GameScreen: React.FC<GameScreenProps> = ({ onGameEnd }) => {
  return (
    <Box
      sx={{
        flexGrow: 1,
        width: "100%",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
      }}
    >
      <Typography variant="h4" color="white" gutterBottom>
        Game in progress (placeholder)
      </Typography>
      <Button variant="contained" color="primary" onClick={onGameEnd}>
        Simulate Game End
      </Button>
    </Box>
  );
};

export default GameScreen;
