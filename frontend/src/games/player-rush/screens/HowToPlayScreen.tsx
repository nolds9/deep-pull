import React from "react";
import { Box, Button, Typography, Stack, Paper, Chip } from "@mui/material";
import { useNavigate } from "react-router-dom";

const HowToPlayScreen: React.FC = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate("/games/player-rush");
  };

  const handlePlay = () => {
    navigate("/games/player-rush");
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
        p: 3,
      }}
    >
      <Typography variant="h3" color="white" gutterBottom fontWeight={700}>
        How to Play Player Rush
      </Typography>

      <Stack spacing={4} sx={{ maxWidth: 800, width: "100%" }}>
        <Paper
          elevation={3}
          sx={{
            p: 3,
            backgroundColor: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(10px)",
          }}
        >
          <Typography variant="h5" color="white" gutterBottom>
            🎯 Objective
          </Typography>
          <Typography variant="body1" color="white">
            Find a path connecting two NFL players through their relationships. You must create a chain of players where each consecutive pair has a valid connection.
          </Typography>
        </Paper>

        <Paper
          elevation={3}
          sx={{
            p: 3,
            backgroundColor: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(10px)",
          }}
        >
          <Typography variant="h5" color="white" gutterBottom>
            🔗 Valid Connections
          </Typography>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6" color="white" gutterBottom>
                Teammates
              </Typography>
              <Typography variant="body2" color="rgba(255,255,255,0.8)">
                Players who played on the same team during the same season
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Chip label="Tom Brady" size="small" color="primary" />
                <Chip label="→" size="small" variant="outlined" />
                <Chip label="Rob Gronkowski" size="small" color="primary" />
              </Stack>
            </Box>
            <Box>
              <Typography variant="h6" color="white" gutterBottom>
                College
              </Typography>
              <Typography variant="body2" color="rgba(255,255,255,0.8)">
                Players who attended the same university
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Chip label="Patrick Mahomes" size="small" color="primary" />
                <Chip label="→" size="small" variant="outlined" />
                <Chip label="Baker Mayfield" size="small" color="primary" />
              </Stack>
            </Box>
            <Box>
              <Typography variant="h6" color="white" gutterBottom>
                Draft Class
              </Typography>
              <Typography variant="body2" color="rgba(255,255,255,0.8)">
                Players drafted in the same year
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Chip label="Joe Burrow" size="small" color="primary" />
                <Chip label="→" size="small" variant="outlined" />
                <Chip label="Tua Tagovailoa" size="small" color="primary" />
              </Stack>
            </Box>
            <Box>
              <Typography variant="h6" color="white" gutterBottom>
                Position
              </Typography>
              <Typography variant="body2" color="rgba(255,255,255,0.8)">
                Players who play the same position
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Chip label="Aaron Rodgers" size="small" color="primary" />
                <Chip label="→" size="small" variant="outlined" />
                <Chip label="Josh Allen" size="small" color="primary" />
              </Stack>
            </Box>
          </Stack>
        </Paper>

        <Paper
          elevation={3}
          sx={{
            p: 3,
            backgroundColor: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(10px)",
          }}
        >
          <Typography variant="h5" color="white" gutterBottom>
            🎮 Game Modes
          </Typography>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6" color="white" gutterBottom>
                Single Player
              </Typography>
              <Typography variant="body2" color="rgba(255,255,255,0.8)">
                Race against the clock to find the shortest path. Your score is based on time and path length.
              </Typography>
            </Box>
            <Box>
              <Typography variant="h6" color="white" gutterBottom>
                Multiplayer
              </Typography>
              <Typography variant="body2" color="rgba(255,255,255,0.8)">
                Compete against another player to find the path first. Both players get the same challenge.
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <Paper
          elevation={3}
          sx={{
            p: 3,
            backgroundColor: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(10px)",
          }}
        >
          <Typography variant="h5" color="white" gutterBottom>
            🎚️ Difficulty Levels
          </Typography>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6" color="success.main" gutterBottom>
                Easy
              </Typography>
              <Typography variant="body2" color="rgba(255,255,255,0.8)">
                All connection types available. More strikes allowed. Shorter time limits.
              </Typography>
            </Box>
            <Box>
              <Typography variant="h6" color="warning.main" gutterBottom>
                Medium
              </Typography>
              <Typography variant="body2" color="rgba(255,255,255,0.8)">
                Limited to teammates and college connections. Fewer strikes. Moderate time limits.
              </Typography>
            </Box>
            <Box>
              <Typography variant="h6" color="error.main" gutterBottom>
                Hard
              </Typography>
              <Typography variant="body2" color="rgba(255,255,255,0.8)">
                Only teammate connections. Very few strikes. Longer time limits.
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <Paper
          elevation={3}
          sx={{
            p: 3,
            backgroundColor: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(10px)",
          }}
        >
          <Typography variant="h5" color="white" gutterBottom>
            💡 Tips
          </Typography>
          <Stack spacing={1}>
            <Typography variant="body2" color="rgba(255,255,255,0.8)">
              • Start with the most obvious connections first
            </Typography>
            <Typography variant="body2" color="rgba(255,255,255,0.8)">
              • Use the search function to find players quickly
            </Typography>
            <Typography variant="body2" color="rgba(255,255,255,0.8)">
              • Shorter paths usually score higher
            </Typography>
            <Typography variant="body2" color="rgba(255,255,255,0.8)">
              • Don't be afraid to start over if you're stuck
            </Typography>
          </Stack>
        </Paper>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handlePlay}
        >
          Start Playing
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          size="large"
          onClick={handleBack}
        >
          Back to Game
        </Button>
      </Stack>
    </Box>
  );
};

export default HowToPlayScreen;
