import React from "react";
import { Box, Button, Typography, Stack } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";

const EndGameScreen: React.FC = () => {
  const navigate = useNavigate();

  const handlePlayAgain = () => {
    navigate("/mode");
  };

  const handleHome = () => {
    navigate("/");
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
      }}
    >
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: "center" }}
      >
        <Typography variant="h4" color="white" gutterBottom>
          Game Over
        </Typography>
        <Typography variant="body1" color="white" gutterBottom>
          Thanks for playing!
        </Typography>
      </motion.div>

      <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handlePlayAgain}
        >
          Play Again
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          size="large"
          onClick={handleHome}
        >
          Home
        </Button>
      </Stack>
    </Box>
  );
};

export default EndGameScreen;
