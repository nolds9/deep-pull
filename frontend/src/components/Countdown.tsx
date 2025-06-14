import React from "react";
import { Typography, Box } from "@mui/material";

interface CountdownProps {
  onDone: () => void;
}

const sequence = [3, 2, 1, "GO!"];

const Countdown: React.FC<CountdownProps> = ({ onDone }) => {
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    if (step < sequence.length - 1) {
      const timeout = setTimeout(() => setStep((s) => s + 1), 700);
      return () => clearTimeout(timeout);
    } else {
      // Call onDone after "GO!" is shown for a moment
      const timeout = setTimeout(onDone, 700);
      return () => clearTimeout(timeout);
    }
  }, [step, onDone]);

  return (
    <Box
      sx={{
        flexGrow: 1,
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #232526 0%, #414345 100%)",
      }}
    >
      <Typography
        variant="h1"
        color="white"
        fontWeight={700}
        sx={{ fontSize: { xs: 64, md: 120 }, transition: "all 0.2s" }}
      >
        {sequence[step]}
      </Typography>
    </Box>
  );
};

export default Countdown;
