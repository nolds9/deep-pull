import React, { useState, useEffect } from "react";
import { Box, Button, Typography, Stack, TextField, Chip } from "@mui/material";
import { useGame } from "../context/GameContext";
import GameTimer from "../components/GameTimer";

const GameScreen: React.FC = () => {
  const { state, submitPath, giveUp } = useGame();
  const {
    startPlayer,
    endPlayer,
    timer,
    stopwatch,
    mode,
    strikes,
    maxStrikes,
  } = state.context;

  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [pathInput, setPathInput] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Clear feedback after 3 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const handlePathInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setPathInput(event.target.value);
  };

  const handleAddToPath = () => {
    const playerName = pathInput.trim();
    if (playerName && !currentPath.includes(playerName)) {
      setCurrentPath([...currentPath, playerName]);
      setPathInput("");
    }
  };

  const handleRemoveFromPath = (index: number) => {
    setCurrentPath(currentPath.filter((_, i) => i !== index));
  };

  const handleSubmitPath = () => {
    if (currentPath.length === 0) {
      setFeedback({
        type: "error",
        message: "Please add players to your path",
      });
      return;
    }

    // Check if path starts and ends with correct players
    if (currentPath[0] !== startPlayer?.name) {
      setFeedback({
        type: "error",
        message: `Path must start with ${startPlayer?.name}`,
      });
      return;
    }

    if (currentPath[currentPath.length - 1] !== endPlayer?.name) {
      setFeedback({
        type: "error",
        message: `Path must end with ${endPlayer?.name}`,
      });
      return;
    }

    submitPath(currentPath);
    setFeedback({ type: "info", message: "Path submitted! Checking..." });
  };

  const handleClearPath = () => {
    setCurrentPath([]);
    setFeedback(null);
  };

  const handleGiveUp = () => {
    giveUp();
  };

  const getTimeDisplay = () => {
    if (mode === "multiplayer") {
      return timer;
    } else {
      return stopwatch;
    }
  };

  const getTimeLabel = () => {
    if (mode === "multiplayer") {
      return "Time Remaining";
    } else {
      return "Time Elapsed";
    }
  };

  if (!startPlayer || !endPlayer) {
    return (
      <Box
        sx={{
          flexGrow: 1,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
          color: "white",
        }}
      >
        <Typography variant="h5">Loading game...</Typography>
      </Box>
    );
  }

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
        minHeight: "100vh",
      }}
    >
      {/* Game Timer */}
      <Box sx={{ position: "absolute", top: 24, right: 24, zIndex: 10 }}>
        <GameTimer seconds={getTimeDisplay()} />
        <Typography variant="body2" textAlign="center" sx={{ mt: 1 }}>
          {getTimeLabel()}
        </Typography>
      </Box>

      {/* Strikes Display */}
      {maxStrikes > 0 && (
        <Box sx={{ position: "absolute", top: 24, left: 24, zIndex: 10 }}>
          <Typography variant="h6" color="error">
            Strikes: {strikes}/{maxStrikes}
          </Typography>
        </Box>
      )}

      {/* Game Objective */}
      <Typography variant="h4" gutterBottom fontWeight={700} textAlign="center">
        Find the Path
      </Typography>

      <Stack spacing={3} sx={{ maxWidth: 600, width: "100%" }}>
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="h6" gutterBottom>
            From: <strong>{startPlayer.name}</strong>
          </Typography>
          <Typography variant="h6">
            To: <strong>{endPlayer.name}</strong>
          </Typography>
        </Box>

        {/* Path Input */}
        <Box>
          <Typography variant="h6" gutterBottom>
            Build Your Path
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Enter player name..."
              value={pathInput}
              onChange={handlePathInputChange}
              onKeyPress={(e) => e.key === "Enter" && handleAddToPath()}
              sx={{
                "& .MuiOutlinedInput-root": {
                  color: "white",
                  "& fieldset": { borderColor: "rgba(255,255,255,0.3)" },
                  "&:hover fieldset": { borderColor: "rgba(255,255,255,0.5)" },
                  "&.Mui-focused fieldset": { borderColor: "primary.main" },
                },
                "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.7)" },
                "& .MuiInputBase-input": { color: "white" },
              }}
            />
            <Button
              variant="contained"
              onClick={handleAddToPath}
              disabled={!pathInput.trim()}
            >
              Add
            </Button>
          </Stack>
        </Box>

        {/* Current Path Display */}
        {currentPath.length > 0 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Your Path:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {currentPath.map((player, index) => (
                <Chip
                  key={index}
                  label={player}
                  onDelete={() => handleRemoveFromPath(index)}
                  color="primary"
                  variant="outlined"
                  sx={{ color: "white", borderColor: "rgba(255,255,255,0.5)" }}
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* Feedback Message */}
        {feedback && (
          <Box
            sx={{
              p: 2,
              borderRadius: 1,
              backgroundColor:
                feedback.type === "error"
                  ? "error.dark"
                  : feedback.type === "success"
                  ? "success.dark"
                  : "info.dark",
            }}
          >
            <Typography variant="body1">{feedback.message}</Typography>
          </Box>
        )}

        {/* Action Buttons */}
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={handleSubmitPath}
            disabled={currentPath.length === 0}
          >
            Submit Path
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            size="large"
            onClick={handleClearPath}
            disabled={currentPath.length === 0}
          >
            Clear Path
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
      </Stack>
    </Box>
  );
};

export default GameScreen;
