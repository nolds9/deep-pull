import React from "react";
import { Box, Button, Typography, Paper, Chip, Stack } from "@mui/material";
import { useGame } from "../context/GameContext";

const PlayerCard: React.FC<{ name: string; isReady: boolean }> = ({
  name,
  isReady,
}) => (
  <Paper
    elevation={3}
    sx={{
      p: 2,
      textAlign: "center",
      border: 2,
      borderColor: isReady ? "success.main" : "grey.700",
      width: 200,
    }}
  >
    <Typography variant="h6">{name}</Typography>
    <Chip
      label={isReady ? "Ready" : "Not Ready"}
      color={isReady ? "success" : "default"}
      sx={{ mt: 1 }}
    />
  </Paper>
);

const LobbyScreen: React.FC = () => {
  const { state, playerReady } = useGame();
  const { myReady, opponentReady } = state.context;

  const handleReady = () => {
    playerReady();
  };

  const handleBack = () => {
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
        p: 3,
        background: "linear-gradient(135deg, #232526 0%, #414345 100%)",
        color: "white",
      }}
    >
      <Typography variant="h3" gutterBottom fontWeight={700}>
        Match Found!
      </Typography>
      <Stack
        direction="row"
        spacing={4}
        sx={{ my: 4, width: "100%", maxWidth: 600, justifyContent: "center" }}
      >
        <PlayerCard name="You" isReady={myReady} />
        <Typography variant="h4" sx={{ alignSelf: "center" }}>
          VS
        </Typography>
        <PlayerCard name="Opponent" isReady={opponentReady} />
      </Stack>
      <Stack direction="row" spacing={2}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleReady}
          disabled={myReady}
        >
          {myReady ? "Waiting for Opponent..." : "Ready"}
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          size="large"
          onClick={handleBack}
        >
          Leave
        </Button>
      </Stack>
    </Box>
  );
};

export default LobbyScreen;
