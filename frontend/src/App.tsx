import React from "react";
import { ThemeProvider, CssBaseline, createTheme } from "@mui/material";
import { AppRouter } from "./router";

const theme = createTheme();

// Auth wrapper component - socket connection is handled by GameProvider
const AuthWrapper: React.FC = () => {
  return <AppRouter />;
};

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthWrapper />
    </ThemeProvider>
  );
}
