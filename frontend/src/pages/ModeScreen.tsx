import React, { useState } from "react";
import {
  Box,
  Button,
  Typography,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import type {
  GameMode,
  Difficulty,
} from "../games/player-rush/state/gameMachine";

const StyledToggleButton = (
  props: React.ComponentProps<typeof ToggleButton>
) => (
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
  const [mode, setMode] = useState<GameMode>("single");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");

  const handleModeChange = (
    event: React.MouseEvent<HTMLElement>,
    newMode: GameMode | null
  ) => {
    if (newMode !== null) {
      setMode(newMode);
    }
  };

  const handleDifficultyChange = (
    event: React.MouseEvent<HTMLElement>,
    newDifficulty: Difficulty | null
  ) => {
    if (newDifficulty !== null) {
      setDifficulty(newDifficulty);
    }
  };

  const handleStart = () => {
    // For now, just navigate to queue - we'll implement game logic later
    navigate("/queue");
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
        background: "linear-gradient(135deg, #0f2027 0%, #2c5364 100%)",
        color: "white",
      }}
    >
      <Typography variant="h3" gutterBottom fontWeight={700}>
        Choose Your Challenge
      </Typography>

      <Stack spacing={2} alignItems="center">
        <Typography variant="h5">Game Mode</Typography>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={handleModeChange}
          aria-label="game mode"
        >
          <StyledToggleButton value="single" aria-label="single player">
            Single Player
          </StyledToggleButton>
          <StyledToggleButton value="multiplayer" aria-label="multiplayer">
            Multiplayer
          </StyledToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Stack spacing={2} alignItems="center">
        <Typography variant="h5">Difficulty</Typography>
        <ToggleButtonGroup
          value={difficulty}
          exclusive
          onChange={handleDifficultyChange}
          aria-label="difficulty"
        >
          <StyledToggleButton value="easy" aria-label="easy">
            Easy
          </StyledToggleButton>
          <StyledToggleButton value="medium" aria-label="medium">
            Medium
          </StyledToggleButton>
          <StyledToggleButton value="hard" aria-label="hard">
            Hard
          </StyledToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Stack direction="row" spacing={2}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleStart}
        >
          Start Game
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          size="large"
          onClick={handleBack}
        >
          Back
        </Button>
      </Stack>
    </Box>
  );
};

export default ModeScreen;
