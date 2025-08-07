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
        minHeight: "calc(100vh - 120px)", // Account for header
        textAlign: "center",
        px: { xs: 2, sm: 4, md: 6 },
        py: 4,
      }}
    >
      <Typography
        variant="h1"
        color="white"
        gutterBottom
        fontWeight={700}
        sx={{
          fontSize: { xs: "2.5rem", sm: "3.5rem", md: "4.5rem", lg: "5rem" },
          mb: 4,
          textAlign: "center",
        }}
      >
        Player Rush
      </Typography>
      <Stack
        spacing={3}
        direction="column"
        alignItems="center"
        sx={{
          maxWidth: { xs: "100%", sm: 400, md: 500 },
          width: "100%",
        }}
      >
        {isSignedIn ? (
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={handlePlay}
            sx={{
              fontSize: { xs: "1.1rem", sm: "1.2rem" },
              py: 1.5,
              px: 4,
              minWidth: { xs: 180, sm: 200 },
              width: { xs: "100%", sm: "auto" },
            }}
          >
            Play
          </Button>
        ) : (
          <SignInButton mode="modal">
            <button
              style={{
                fontSize: "1.1rem",
                padding: "12px 24px",
                minWidth: "180px",
                width: "100%",
                backgroundColor: "#1976d2",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Play
            </button>
          </SignInButton>
        )}
        <Button
          variant="outlined"
          color="secondary"
          size="large"
          onClick={handleHowToPlay}
          sx={{
            fontSize: { xs: "1rem", sm: "1.1rem" },
            py: 1.5,
            px: 4,
            minWidth: { xs: 180, sm: 200 },
            width: { xs: "100%", sm: "auto" },
            borderColor: "rgba(255,255,255,0.5)",
            color: "white",
            "&:hover": {
              borderColor: "white",
              backgroundColor: "rgba(255,255,255,0.1)",
            },
          }}
        >
          How to Play
        </Button>
        {isSignedIn && (
          <Button
            variant="text"
            color="inherit"
            size="medium"
            onClick={handleViewProfile}
            sx={{
              fontSize: "1rem",
              color: "rgba(255,255,255,0.8)",
              "&:hover": {
                color: "white",
                backgroundColor: "rgba(255,255,255,0.1)",
              },
            }}
          >
            View Profile
          </Button>
        )}
      </Stack>
    </Box>
  );
};

export default HomeScreen;
