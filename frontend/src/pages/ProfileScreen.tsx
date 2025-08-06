import React from "react";
import { Box, Button, Typography, Stack, Paper } from "@mui/material";
import { useUser } from "@clerk/clerk-react";
import { useGame } from "../games/player-rush/context/GameContext";

const ProfileScreen: React.FC = () => {
  const { user } = useUser();
  const { send } = useGame();

  const handleBack = () => {
    send({ type: "BACK" });
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
      }}
    >
      <Typography variant="h3" color="white" gutterBottom fontWeight={700}>
        Profile
      </Typography>

      <Paper
        elevation={3}
        sx={{
          p: 3,
          backgroundColor: "rgba(255,255,255,0.1)",
          backdropFilter: "blur(10px)",
          color: "white",
          minWidth: 300,
        }}
      >
        <Stack spacing={2}>
          <Typography variant="h6">User Information</Typography>
          <Typography>
            <strong>Name:</strong> {user?.fullName || "N/A"}
          </Typography>
          <Typography>
            <strong>Email:</strong>{" "}
            {user?.primaryEmailAddress?.emailAddress || "N/A"}
          </Typography>
          <Typography>
            <strong>User ID:</strong> {user?.id || "N/A"}
          </Typography>
        </Stack>
      </Paper>

      <Button
        variant="outlined"
        color="secondary"
        size="large"
        onClick={handleBack}
      >
        Back to Home
      </Button>
    </Box>
  );
};

export default ProfileScreen;
