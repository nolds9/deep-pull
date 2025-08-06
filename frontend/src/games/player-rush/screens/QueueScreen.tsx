import React, { useEffect } from "react";
import {
  Box,
  Button,
  Typography,
  Stack,
  CircularProgress,
} from "@mui/material";
import { useGame } from "../context/GameContext";

const QueueScreen: React.FC = () => {
  const { leaveQueue } = useGame();

  useEffect(() => {
    // The game context will handle joining the queue automatically
    // when the component mounts and the state is "loading" with multiplayer mode
  }, []);

  const handleBack = () => {
    leaveQueue();
    // The game context will handle navigation back to mode selection
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
        background: "linear-gradient(135deg, #232526 0%, #414345 100%)",
        color: "white",
      }}
    >
      <Typography variant="h3" gutterBottom fontWeight={700}>
        Finding Players...
      </Typography>

      <Stack spacing={3} alignItems="center">
        <CircularProgress size={60} color="primary" />
        <Typography variant="h6" textAlign="center">
          Waiting for other players to join
        </Typography>
        <Typography variant="body1" textAlign="center" color="grey.300">
          This may take a few moments
        </Typography>
      </Stack>

      <Button
        variant="outlined"
        color="secondary"
        size="large"
        onClick={handleBack}
      >
        Cancel
      </Button>
    </Box>
  );
};

export default QueueScreen;
