import React from "react";
import { Box, Button, Typography, Stack } from "@mui/material";

interface EndGameScreenProps {
  onPlayAgain: () => void;
  onHome: () => void;
}

const EndGameScreen: React.FC<EndGameScreenProps> = ({
  onPlayAgain,
  onHome,
}) => {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #232526 0%, #414345 100%)",
      }}
    >
      <Typography variant="h4" color="white" gutterBottom>
        Game Over (placeholder)
      </Typography>
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
