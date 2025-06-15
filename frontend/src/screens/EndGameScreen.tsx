import React from "react";
import { Box, Button, Typography, Stack } from "@mui/material";

interface EndGameScreenProps {
  isWinner: boolean;
  reason?: string;
  onPlayAgain: () => void;
  onHome: () => void;
}

const EndGameScreen: React.FC<EndGameScreenProps> = ({
  isWinner,
  reason,
  onPlayAgain,
  onHome,
}) => {
  let title = "Game Over";
  let subtitle: string | null = null;

  if (reason === "opponent_disconnected") {
    title = "Opponent Disconnected";
    subtitle = "You win by default!";
  } else if (isWinner) {
    title = "You Win!";
  } else {
    title = "You Lose";
  }

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
      }}
    >
      <Typography variant="h4" color="white" gutterBottom>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body1" color="white" gutterBottom>
          {subtitle}
        </Typography>
      )}
      <Stack spacing={2} direction="row">
        <Button variant="contained" color="primary" onClick={onPlayAgain}>
          Play Again
        </Button>
        <Button variant="outlined" color="secondary" onClick={onHome}>
          Home
        </Button>
      </Stack>
    </Box>
  );
};

export default EndGameScreen;
