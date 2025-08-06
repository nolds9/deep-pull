import React from "react";
import { Box, Container } from "@mui/material";
import { Header } from "./Header";

interface MainLayoutProps {
  children: React.ReactNode;
  isHome?: boolean;
  title?: string;
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl";
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  isHome = false,
  title = "Player Rush",
  maxWidth = "md",
}) => {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: isHome
          ? "linear-gradient(135deg, #0f2027 0%, #2c5364 100%)"
          : "linear-gradient(135deg, #232526 0%, #414345 100%)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Header isHome={isHome} title={title} />
      <Container
        maxWidth={maxWidth}
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          py: 3,
        }}
      >
        {children}
      </Container>
    </Box>
  );
};
