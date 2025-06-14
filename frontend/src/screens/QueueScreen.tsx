import React from "react";
import { Box, Button, Typography, Stack } from "@mui/material";

interface QueueScreenProps {
  onMatched: () => void;
  onBack: () => void;
}

const QueueScreen: React.FC<QueueScreenProps> = ({ onMatched, onBack }) => {
  const [dots, setDots] = React.useState("");
  React.useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length < 3 ? prev + "." : ""));
    }, 500);
    return () => clearInterval(interval);
  }, []);
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
        Waiting for opponent{dots}
      </Typography>
      <Stack spacing={2} direction="row">
        <Button variant="contained" color="primary" onClick={onMatched}>
          Simulate Match Found
        </Button>
        <Button variant="outlined" color="secondary" onClick={onBack}>
          Back
        </Button>
      </Stack>
    </Box>
  );
};

export default QueueScreen;
