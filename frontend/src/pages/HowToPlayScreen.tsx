import React from "react";
import { Box, Button, Typography, Stack } from "@mui/material";
import { useGame } from "../games/player-rush/context/GameContext";

const HowToPlayScreen: React.FC = () => {
  const { send } = useGame();

  const handleBack = () => {
    send({ type: "BACK" });
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
        gap: 3,
        p: 3,
      }}
    >
      <Typography variant="h3" color="white" gutterBottom fontWeight={700}>
        How to Play
      </Typography>

      <Stack spacing={3} sx={{ maxWidth: 600, textAlign: "center" }}>
        <Typography variant="h5" color="white">
          Find the Path
        </Typography>
        <Typography variant="body1" color="white">
          Connect NFL players through their relationships. Find a path from the
          starting player to the ending player using connections like:
        </Typography>

        <Stack spacing={2} sx={{ textAlign: "left" }}>
          <Typography variant="body1" color="white">
            • <strong>Teammates:</strong> Players who played on the same team
          </Typography>
          <Typography variant="body1" color="white">
            • <strong>College:</strong> Players who attended the same university
          </Typography>
          <Typography variant="body1" color="white">
            • <strong>Draft Class:</strong> Players drafted in the same year
          </Typography>
          <Typography variant="body1" color="white">
            • <strong>Position:</strong> Players who play the same position
          </Typography>
        </Stack>

        <Typography variant="h5" color="white" sx={{ mt: 2 }}>
          Game Modes
        </Typography>
        <Typography variant="body1" color="white">
          <strong>Single Player:</strong> Race against the clock to find the
          shortest path
        </Typography>
        <Typography variant="body1" color="white">
          <strong>Multiplayer:</strong> Compete against another player to find
          the path first
        </Typography>
      </Stack>

      <Button
        variant="outlined"
        color="secondary"
        size="large"
        onClick={handleBack}
      >
        Back to Home
      </Button>
    </Box>
  );
};

export default HowToPlayScreen;
