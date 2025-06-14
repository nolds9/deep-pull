import React from "react";
import { Typography, Box } from "@mui/material";

interface GameTimerProps {
  seconds: number;
}

const GameTimer: React.FC<GameTimerProps> = ({ seconds }) => {
  return (
    <Box sx={{ position: "absolute", top: 24, right: 24, zIndex: 10 }}>
      <Typography
        variant="h3"
        color={seconds <= 5 ? "error" : "white"}
        fontWeight={700}
      >
        {seconds}s
      </Typography>
    </Box>
  );
};

export default GameTimer;
