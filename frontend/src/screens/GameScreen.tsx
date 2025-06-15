import React from "react";
import { Box, Button, Typography } from "@mui/material";
import type { Player } from "../types";

interface GameScreenProps {
  startPlayer: Player;
  endPlayer: Player;
  onGameEnd: () => void;
}

const GameScreen: React.FC<GameScreenProps> = ({
  startPlayer,
  endPlayer,
  onGameEnd,
}) => {
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
        Find a path from <strong>{startPlayer.name}</strong> to{" "}
        <strong>{endPlayer.name}</strong>
      </Typography>
      <Button variant="contained" color="primary" onClick={onGameEnd}>
        Simulate Game End
      </Button>
    </Box>
  );
};

export default GameScreen;
