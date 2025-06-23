import React from "react";
import { Box, Button, Typography, Stack } from "@mui/material";
import { SignInButton } from "@clerk/clerk-react";

interface HomeScreenProps {
  onPlay: () => void;
  onHowToPlay: () => void;
  isSignedIn: boolean | undefined;
}

const HomeScreen: React.FC<HomeScreenProps> = ({
  onPlay,
  onHowToPlay,
  isSignedIn,
}) => {
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
            onClick={onPlay}
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
          onClick={onHowToPlay}
        >
          How to Play
        </Button>
      </Stack>
    </Box>
  );
};

export default HomeScreen;
