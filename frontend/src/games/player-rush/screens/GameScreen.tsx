import React from "react";
import { Box, Button, Typography, Stack } from "@mui/material";
import { useNavigate } from "react-router-dom";

const GameScreen: React.FC = () => {
  const navigate = useNavigate();

  const handleGiveUp = () => {
    navigate("/end-game");
  };

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
        p: 3,
        background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
        color: "white",
      }}
    >
      <Typography variant="h3" gutterBottom fontWeight={700}>
        Game Screen
      </Typography>

      <Typography variant="h6" textAlign="center" sx={{ mb: 4 }}>
        Game functionality will be implemented in the next phase
      </Typography>

      <Stack direction="row" spacing={2}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={() => navigate("/end-game")}
        >
          Win Game
        </Button>
        <Button
          variant="contained"
          color="error"
          size="large"
          onClick={handleGiveUp}
        >
          Give Up
        </Button>
      </Stack>
    </Box>
  );
};

export default GameScreen;
