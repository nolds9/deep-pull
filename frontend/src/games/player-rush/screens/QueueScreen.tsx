import React from "react";
import {
  Box,
  Button,
  Typography,
  Stack,
  CircularProgress,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

const QueueScreen: React.FC = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate("/mode");
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
        background: "linear-gradient(135deg, #232526 0%, #414345 100%)",
        color: "white",
      }}
    >
      <Typography variant="h3" gutterBottom fontWeight={700}>
        Finding Players...
      </Typography>

      <Stack spacing={3} alignItems="center">
        <CircularProgress size={60} color="primary" />
        <Typography variant="h6" textAlign="center">
          Waiting for other players to join
        </Typography>
        <Typography variant="body1" textAlign="center" color="grey.300">
          This may take a few moments
        </Typography>
      </Stack>

      <Button
        variant="outlined"
        color="secondary"
        size="large"
        onClick={handleBack}
      >
        Cancel
      </Button>
    </Box>
  );
};

export default QueueScreen;
