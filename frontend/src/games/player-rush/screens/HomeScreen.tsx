import React from "react";
import { Box, Button, Typography, Stack } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useGame } from "../context/GameContext";

const HomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const { setMode, setDifficulty } = useGame();

  const handlePlay = () => {
    // Reset to default settings
    setMode("single");
    setDifficulty("easy");
    navigate("/games/player-rush");
  };

  const handleHowToPlay = () => {
    navigate("/games/player-rush/how-to-play");
  };

  const handleBack = () => {
    navigate("/");
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
        minHeight: "calc(100vh - 120px)",
        textAlign: "center",
        px: { xs: 2, sm: 4, md: 6 },
        py: 4,
      }}
    >
      <Typography
        variant="h1"
        color="white"
        gutterBottom
        fontWeight={700}
        sx={{
          fontSize: { xs: "2.5rem", sm: "3.5rem", md: "4.5rem", lg: "5rem" },
          mb: 4,
          textAlign: "center",
        }}
      >
        Player Rush
      </Typography>
      <Typography
        variant="h5"
        color="rgba(255,255,255,0.8)"
        gutterBottom
        sx={{ mb: 6, textAlign: "center", maxWidth: 600 }}
      >
        Connect NFL players through their relationships. Find paths from one player to another using connections like teammates, college, draft class, and position.
      </Typography>

      <Stack
        spacing={3}
        direction="column"
        alignItems="center"
        sx={{
          maxWidth: { xs: "100%", sm: 400, md: 500 },
          width: "100%",
        }}
      >
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handlePlay}
          sx={{
            fontSize: { xs: "1.1rem", sm: "1.2rem" },
            py: 1.5,
            px: 4,
            minWidth: { xs: 180, sm: 200 },
            width: { xs: "100%", sm: "auto" },
          }}
        >
          Play
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          size="large"
          onClick={handleHowToPlay}
          sx={{
            fontSize: { xs: "1rem", sm: "1.1rem" },
            py: 1.5,
            px: 4,
            minWidth: { xs: 180, sm: 200 },
            width: { xs: "100%", sm: "auto" },
            borderColor: "rgba(255,255,255,0.5)",
            color: "white",
            "&:hover": {
              borderColor: "white",
              backgroundColor: "rgba(255,255,255,0.1)",
            },
          }}
        >
          How to Play
        </Button>
        <Button
          variant="text"
          color="inherit"
          size="medium"
          onClick={handleBack}
          sx={{
            fontSize: "1rem",
            color: "rgba(255,255,255,0.8)",
            "&:hover": {
              color: "white",
              backgroundColor: "rgba(255,255,255,0.1)",
            },
          }}
        >
          Back to Games
        </Button>
      </Stack>
    </Box>
  );
};

export default HomeScreen;
