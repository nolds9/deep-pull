import React from "react";
import { Box, Button, Typography } from "@mui/material";

interface HowToPlayScreenProps {
  onBack: () => void;
}

const HowToPlayScreen: React.FC<HowToPlayScreenProps> = ({ onBack }) => {
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
        How to Play (placeholder)
      </Typography>
      <Typography variant="body1" color="white" gutterBottom>
        Connect the start player to the end player by finding a valid path of
        connections. (Full instructions coming soon!)
      </Typography>
      <Button variant="outlined" color="secondary" onClick={onBack}>
        Back
      </Button>
    </Box>
  );
};

export default HowToPlayScreen;
