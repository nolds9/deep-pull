import React from "react";
import { Box, Typography } from "@mui/material";
import Countdown from "../components/Countdown";
import { useGame } from "../context/GameContext";

const CountdownScreen: React.FC = () => {
  const { send } = useGame();

  console.log("CountdownScreen: Component rendered");

  const handleCountdownDone = () => {
    console.log("CountdownScreen: Countdown done, sending COUNTDOWN_DONE");
    send({ type: "COUNTDOWN_DONE" });
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
        background: "linear-gradient(135deg, #232526 0%, #414345 100%)",
        color: "white",
        minHeight: "100vh",
      }}
    >
      <Typography variant="h4" gutterBottom textAlign="center" sx={{ mb: 4 }}>
        Get Ready!
      </Typography>
      <Countdown onDone={handleCountdownDone} />
    </Box>
  );
};

export default CountdownScreen;
