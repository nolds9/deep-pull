import React from "react";
import { Box, Button, Typography, Stack, Paper, Chip } from "@mui/material";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../context/GameContext";

const EndGameScreen: React.FC = () => {
  const navigate = useNavigate();
  const { state, resetGame } = useGame();
  const { winnerId, winningPath, solutionPaths, score, reason } = state.context;

  const handlePlayAgain = () => {
    resetGame();
    navigate("/games/player-rush");
  };

  const handleHome = () => {
    resetGame();
    navigate("/");
  };

  const getGameResultMessage = () => {
    if (reason === "path_found") {
      return "Congratulations! You found the path!";
    } else if (reason === "gave_up") {
      return "You gave up.";
    } else if (reason === "opponent_gave_up") {
      return "Your opponent gave up. You win!";
    } else if (reason === "timeout") {
      return "Time's up!";
    } else if (reason === "out_of_strikes") {
      return "You ran out of strikes!";
    } else if (reason === "opponent_disconnected") {
      return "Your opponent disconnected. You win!";
    }
    return "Game Over";
  };

  const isWinner = winnerId === "current-user"; // This would need to be set based on actual user ID

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
        color: "white",
        p: 3,
      }}
    >
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: "center", width: "100%", maxWidth: 600 }}
      >
        <Typography variant="h3" gutterBottom fontWeight={700}>
          {isWinner ? "🎉 Victory!" : "Game Over"}
        </Typography>

        <Typography
          variant="h5"
          gutterBottom
          color={isWinner ? "success.main" : "error.main"}
        >
          {getGameResultMessage()}
        </Typography>

        {score && (
          <Paper
            elevation={3}
            sx={{
              p: 3,
              my: 3,
              backgroundColor: "rgba(255,255,255,0.1)",
              backdropFilter: "blur(10px)",
            }}
          >
            <Typography variant="h6" gutterBottom>
              Your Score: {score}
            </Typography>
          </Paper>
        )}

        {winningPath && winningPath.length > 0 && (
          <Paper
            elevation={3}
            sx={{
              p: 3,
              my: 3,
              backgroundColor: "rgba(255,255,255,0.1)",
              backdropFilter: "blur(10px)",
            }}
          >
            <Typography variant="h6" gutterBottom>
              Winning Path:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {winningPath.map((player: string, index: number) => (
                <Chip
                  key={index}
                  label={player}
                  color="success"
                  variant="outlined"
                  sx={{ color: "white", borderColor: "rgba(255,255,255,0.5)" }}
                />
              ))}
            </Stack>
          </Paper>
        )}

        {solutionPaths && solutionPaths.length > 0 && (
          <Paper
            elevation={3}
            sx={{
              p: 3,
              my: 3,
              backgroundColor: "rgba(255,255,255,0.1)",
              backdropFilter: "blur(10px)",
            }}
          >
            <Typography variant="h6" gutterBottom>
              All Possible Paths:
            </Typography>
            {solutionPaths.map((path: string[], pathIndex: number) => (
              <Box key={pathIndex} sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  Path {pathIndex + 1}:
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {path.map((player: string, playerIndex: number) => (
                    <Chip
                      key={playerIndex}
                      label={player}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{
                        color: "white",
                        borderColor: "rgba(255,255,255,0.5)",
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            ))}
          </Paper>
        )}

        <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={handlePlayAgain}
          >
            Play Again
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            size="large"
            onClick={handleHome}
          >
            Home
          </Button>
        </Stack>
      </motion.div>
    </Box>
  );
};

export default EndGameScreen;
