import React from "react";
import { Box, Button, Typography, Stack } from "@mui/material";
import { SignInButton, useAuth } from "@clerk/clerk-react";
import { useGame } from "../games/player-rush/context/GameContext";

const HomeScreen: React.FC = () => {
  const { isSignedIn } = useAuth();
  const { send } = useGame();

  const handlePlay = () => {
    send({ type: "PLAY" });
  };

  const handleHowToPlay = () => {
    send({ type: "HOW_TO_PLAY" });
  };

  const handleViewProfile = () => {
    send({ type: "VIEW_PROFILE" });
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
      }}
    >
      <Typography variant="h2" color="white" gutterBottom fontWeight={700}>
        Player Rush
      </Typography>
      <Stack spacing={2} direction="column" alignItems="center">
        {isSignedIn ? (
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={handlePlay}
          >
            Play
          </Button>
        ) : (
          <SignInButton mode="modal">
            <Button variant="contained" color="primary" size="large">
              Play
            </Button>
          </SignInButton>
        )}
        <Button
          variant="outlined"
          color="secondary"
          size="large"
          onClick={handleHowToPlay}
        >
          How to Play
        </Button>
        {isSignedIn && (
          <Button
            variant="text"
            color="inherit"
            size="medium"
            onClick={handleViewProfile}
          >
            View Profile
          </Button>
        )}
      </Stack>
    </Box>
  );
};

export default HomeScreen;
