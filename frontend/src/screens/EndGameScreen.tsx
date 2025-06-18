import React from "react";
import { Box, Button, Typography, Stack, Paper, Chip } from "@mui/material";
import type { GameMode } from "../state/gameMachine";
import { motion } from "motion/react";

interface EndGameScreenProps {
  isWinner: boolean;
  reason?: string;
  winningPath?: string[];
  solutionPaths?: string[][];
  onPlayAgain: () => void;
  onHome: () => void;
  mode?: GameMode;
  score?: number;
  time?: number;
}

const EndGameScreen: React.FC<EndGameScreenProps> = ({
  isWinner,
  reason,
  winningPath,
  solutionPaths,
  onPlayAgain,
  onHome,
  mode,
  score,
  time,
}) => {
  React.useEffect(() => {
    console.log("EndGameScreen props:", {
      isWinner,
      reason,
      winningPath,
      solutionPaths,
      mode,
      score,
      time,
    });
  }, [isWinner, reason, winningPath, solutionPaths, mode, score, time]);

  let title = "Game Over";
  let subtitle: string | null = null;

  if (reason === "opponent_disconnected") {
    title = "Opponent Disconnected";
    subtitle = "You win by default!";
  } else if (reason === "timeout") {
    title = "Time's Up!";
  } else if (reason === "out_of_strikes") {
    title = "Out of Strikes!";
    subtitle = "Better luck next time.";
  } else if (reason === "gave_up") {
    title = "You Gave Up";
    subtitle = "Every champion was once a contender that refused to give up.";
  } else if (reason === "opponent_gave_up") {
    title = "Opponent Gave Up!";
    subtitle = "You win!";
  } else if (isWinner) {
    title = mode === "single" ? "Path Found!" : "You Win!";
  } else {
    title = "You Lose";
  }

  const isPathFoundWin =
    reason === "path_found" ||
    (isWinner &&
      winningPath &&
      winningPath.length > 1 &&
      !["opponent_disconnected", "timeout"].includes(reason ?? ""));

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
      }}
    >
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: "center" }}
      >
        <Typography variant="h4" color="white" gutterBottom>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body1" color="white" gutterBottom>
            {subtitle}
          </Typography>
        )}
      </motion.div>

      {mode === "single" && isWinner && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Box sx={{ my: 2, textAlign: "center" }}>
            <Typography variant="h5" color="secondary.light">
              Score: {score}
            </Typography>
            <Typography variant="body1" color="grey.400">
              Time: {time?.toFixed(1)}s
            </Typography>
          </Box>
        </motion.div>
      )}

      {isPathFoundWin && winningPath && (
        <>
          <Typography variant="h6" color="grey.400" sx={{ mt: 2 }}>
            Your Path:
          </Typography>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Paper
              elevation={3}
              sx={{
                p: 2,
                my: 2,
                display: "flex",
                flexWrap: "wrap",
                gap: 1,
                alignItems: "center",
                justifyContent: "center",
                maxWidth: "90%",
                backgroundColor: "rgba(0,0,0,0.2)",
              }}
            >
              {winningPath.map((node, index) => (
                <React.Fragment key={`${node}-${index}`}>
                  <Chip
                    label={node}
                    color="primary"
                    sx={{ color: "white", fontWeight: "bold" }}
                  />
                  {index < winningPath.length - 1 && (
                    <Typography sx={{ mx: 0.5, color: "grey.500" }}>
                      →
                    </Typography>
                  )}
                </React.Fragment>
              ))}
            </Paper>
          </motion.div>
        </>
      )}

      {!isWinner && solutionPaths && solutionPaths.length > 0 && (
        <>
          <Typography variant="h6" color="grey.400" sx={{ mt: 3 }}>
            Here are some ways you could have won:
          </Typography>
          {solutionPaths.map((solution, index) => (
            <Paper
              key={index}
              elevation={3}
              sx={{
                p: 2,
                my: 1,
                display: "flex",
                flexWrap: "wrap",
                gap: 1,
                alignItems: "center",
                justifyContent: "center",
                maxWidth: "90%",
                backgroundColor: "rgba(0,0,0,0.2)",
              }}
            >
              {solution.map((node, nodeIndex) => (
                <React.Fragment key={`${node}-${nodeIndex}`}>
                  <Chip
                    label={node}
                    color="primary"
                    sx={{ color: "white", fontWeight: "bold" }}
                  />
                  {nodeIndex < solution.length - 1 && (
                    <Typography sx={{ mx: 0.5, color: "grey.500" }}>
                      →
                    </Typography>
                  )}
                </React.Fragment>
              ))}
            </Paper>
          ))}
        </>
      )}

      <Stack spacing={2} direction="row" sx={{ mt: 3 }}>
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
