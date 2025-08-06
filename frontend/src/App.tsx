import React from "react";
import { ThemeProvider, CssBaseline, createTheme } from "@mui/material";
import { ClerkProvider } from "@clerk/clerk-react";
import { AppRouter } from "./router";
import { useSocket } from "./hooks/useSocket";

const theme = createTheme();

// Auth wrapper component to handle socket connection
const AuthWrapper: React.FC = () => {
  // Initialize socket connection when user is authenticated
  useSocket();

  return <AppRouter />;
};

export default function App() {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error("Missing Publishable Key");
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthWrapper />
      </ThemeProvider>
    </ClerkProvider>
  );
}
