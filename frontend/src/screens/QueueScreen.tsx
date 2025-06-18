import React from "react";
import { Box, Button, Typography, Stack } from "@mui/material";
import type { GameMode } from "../state/gameMachine";

interface QueueScreenProps {
  onBack: () => void;
  mode?: GameMode;
}

const QueueScreen: React.FC<QueueScreenProps> = ({ onBack, mode }) => {
  const [dots, setDots] = React.useState("");

  React.useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length < 3 ? prev + "." : ""));
    }, 500);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const text =
    mode === "multiplayer" ? "Waiting for opponent" : "Creating your game";

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
        {text}
        {dots}
      </Typography>
      <Stack spacing={2} direction="row">
        <Button variant="outlined" color="secondary" onClick={onBack}>
          Back
        </Button>
      </Stack>
    </Box>
  );
};

export default QueueScreen;
