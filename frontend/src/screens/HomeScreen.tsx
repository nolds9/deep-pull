import React from "react";
import { Box, Button, Typography, Stack } from "@mui/material";

interface HomeScreenProps {
  onPlay: () => void;
  onHowToPlay: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onPlay, onHowToPlay }) => {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f2027 0%, #2c5364 100%)",
      }}
    >
      <Typography variant="h2" color="white" gutterBottom fontWeight={700}>
        Player Rush
      </Typography>
      <Stack spacing={2} direction="column" alignItems="center">
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={onPlay}
        >
          Play
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          size="large"
          onClick={onHowToPlay}
        >
          How to Play
        </Button>
      </Stack>
    </Box>
  );
};

export default HomeScreen;
