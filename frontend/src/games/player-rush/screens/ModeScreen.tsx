import React from "react";
import {
  Box,
  Button,
  Typography,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import type { ToggleButtonProps } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useGame } from "../context/GameContext";

const StyledToggleButton = (props: ToggleButtonProps) => (
  <ToggleButton
    {...props}
    sx={{
      color: "white",
      borderColor: "rgba(255,255,255,0.5)",
      "&.Mui-selected, &.Mui-selected:hover": {
        color: "white",
        backgroundColor: "primary.main",
      },
      ...props.sx,
    }}
  />
);

const ModeScreen: React.FC = () => {
  const navigate = useNavigate();
  const { mode, difficulty, setMode, setDifficulty, startGame, joinQueue } =
    useGame();

  const handleModeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newMode: typeof mode | null
  ) => {
    if (newMode !== null) {
      setMode(newMode);
    }
  };

  const handleDifficultyChange = (
    _event: React.MouseEvent<HTMLElement>,
    newDifficulty: typeof difficulty | null
  ) => {
    if (newDifficulty !== null) {
      setDifficulty(newDifficulty);
    }
  };

  const handleStart = () => {
    startGame();
    if (mode === "multiplayer") {
      joinQueue();
      navigate("/games/player-rush/queue");
    } else {
      navigate("/games/player-rush/loading");
    }
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
        gap: 4,
        p: 3,
        minHeight: "calc(100vh - 120px)", // Account for header
        textAlign: "center",
      }}
    >
      <Typography
        variant="h3"
        gutterBottom
        fontWeight={700}
        sx={{
          fontSize: { xs: "2rem", sm: "2.5rem", md: "3rem" },
          mb: 4,
        }}
      >
        Choose Your Challenge
      </Typography>

      <Stack
        spacing={3}
        alignItems="center"
        sx={{ maxWidth: 600, width: "100%" }}
      >
        <Box sx={{ width: "100%" }}>
          <Typography variant="h5" gutterBottom>
            Game Mode
          </Typography>
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={handleModeChange}
            aria-label="game mode"
            sx={{ width: "100%", justifyContent: "center" }}
          >
            <StyledToggleButton
              value="single"
              aria-label="single player"
              sx={{ minWidth: 150 }}
            >
              Single Player
            </StyledToggleButton>
            <StyledToggleButton
              value="multiplayer"
              aria-label="multiplayer"
              sx={{ minWidth: 150 }}
            >
              Multiplayer
            </StyledToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ width: "100%" }}>
          <Typography variant="h5" gutterBottom>
            Difficulty
          </Typography>
          <ToggleButtonGroup
            value={difficulty}
            exclusive
            onChange={handleDifficultyChange}
            aria-label="difficulty"
            sx={{ width: "100%", justifyContent: "center" }}
          >
            <StyledToggleButton
              value="easy"
              aria-label="easy"
              sx={{ minWidth: 100 }}
            >
              Easy
            </StyledToggleButton>
            <StyledToggleButton
              value="medium"
              aria-label="medium"
              sx={{ minWidth: 100 }}
            >
              Medium
            </StyledToggleButton>
            <StyledToggleButton
              value="hard"
              aria-label="hard"
              sx={{ minWidth: 100 }}
            >
              Hard
            </StyledToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleStart}
          sx={{
            fontSize: "1.1rem",
            py: 1.5,
            px: 4,
            minWidth: 150,
          }}
        >
          Start Game
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          size="large"
          onClick={handleBack}
          sx={{
            fontSize: "1.1rem",
            py: 1.5,
            px: 4,
            minWidth: 150,
            borderColor: "rgba(255,255,255,0.5)",
            color: "white",
            "&:hover": {
              borderColor: "white",
              backgroundColor: "rgba(255,255,255,0.1)",
            },
          }}
        >
          Back
        </Button>
      </Stack>
    </Box>
  );
};

export default ModeScreen;
