import React from "react";
import { Box, Button, Typography, Stack } from "@mui/material";
import { socket } from "../socket";

interface QueueScreenProps {
  onBack: () => void;
}

const QueueScreen: React.FC<QueueScreenProps> = ({ onBack }) => {
  const [dots, setDots] = React.useState("");

  React.useEffect(() => {
    // When the component mounts, emit an event to join the server queue.
    socket.emit("joinQueue");
    console.log("Emitted joinQueue event");

    const interval = setInterval(() => {
      setDots((prev) => (prev.length < 3 ? prev + "." : ""));
    }, 500);

    return () => {
      clearInterval(interval);
      socket.emit("leaveQueue");
      console.log("Emitted leaveQueue event");
    };
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
        <Button variant="outlined" color="secondary" onClick={onBack}>
          Back
        </Button>
      </Stack>
    </Box>
  );
};

export default QueueScreen;
