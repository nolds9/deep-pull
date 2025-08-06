import React from "react";
import { Box, Button, Typography, Stack } from "@mui/material";
import { SignInButton, useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";

const HomeScreen: React.FC = () => {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();

  const handlePlay = () => {
    navigate("/mode");
  };

  const handleHowToPlay = () => {
    navigate("/how-to-play");
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
      </Stack>
    </Box>
  );
};

export default HomeScreen;
