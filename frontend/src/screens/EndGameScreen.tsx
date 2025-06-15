import React from "react";
import { Box, Button, Typography, Stack, Paper, Chip } from "@mui/material";

interface EndGameScreenProps {
  isWinner: boolean;
  reason?: string;
  winningPath?: string[];
  solutionPaths?: string[][];
  onPlayAgain: () => void;
  onHome: () => void;
}

const EndGameScreen: React.FC<EndGameScreenProps> = ({
  isWinner,
  reason,
  winningPath,
  solutionPaths,
  onPlayAgain,
  onHome,
}) => {
  React.useEffect(() => {
    console.log("EndGameScreen props:", {
      isWinner,
      reason,
      winningPath,
      solutionPaths,
    });
  }, [isWinner, reason, winningPath, solutionPaths]);

  let title = "Game Over";
  let subtitle: string | null = null;

  if (reason === "opponent_disconnected") {
    title = "Opponent Disconnected";
    subtitle = "You win by default!";
  } else if (reason === "timeout") {
    title = "Time's Up!";
  } else if (isWinner) {
    title = "You Win!";
  } else {
    title = "You Lose";
  }

  const isRealWin = winningPath && winningPath.length > 1;

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
      <Typography variant="h4" color="white" gutterBottom>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body1" color="white" gutterBottom>
          {subtitle}
        </Typography>
      )}

      {isRealWin && (
        <>
          <Typography variant="h6" color="grey.400" sx={{ mt: 2 }}>
            Winning Path:
          </Typography>
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
                  <Typography sx={{ mx: 0.5, color: "grey.500" }}>→</Typography>
                )}
              </React.Fragment>
            ))}
          </Paper>
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
