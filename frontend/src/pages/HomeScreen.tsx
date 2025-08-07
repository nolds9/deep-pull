import React from "react";
import {
  Box,
  Button,
  Typography,
  Stack,
  Card,
  CardContent,
  CardActions,
} from "@mui/material";
import { SignInButton, useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { usePlatform } from "../context/PlatformContext";

interface GameCard {
  id: string;
  title: string;
  description: string;
  status: "available" | "coming-soon" | "beta";
  color: string;
}

const games: GameCard[] = [
  {
    id: "player-rush",
    title: "Player Rush",
    description:
      "Connect NFL players through their relationships. Find paths from one player to another using connections like teammates, college, draft class, and position.",
    status: "available",
    color: "#1976d2",
  },
  {
    id: "gladiator",
    title: "Gladiator Arena",
    description:
      "Strategic team battles with NFL players. Build your roster and compete in tactical matchups.",
    status: "coming-soon",
    color: "#d32f2f",
  },
  {
    id: "team-battle",
    title: "Team Battle",
    description:
      "Epic team vs team battles with real NFL data. Lead your team to victory through strategic gameplay.",
    status: "coming-soon",
    color: "#388e3c",
  },
];

const HomeScreen: React.FC = () => {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();
  const { navigateToGame } = usePlatform();

  const handleGameSelect = (gameId: string) => {
    if (gameId === "player-rush") {
      navigateToGame("player-rush");
    } else {
      // For future games, show coming soon message
      console.log(`${gameId} coming soon!`);
    }
  };

  const handleViewProfile = () => {
    navigate("/profile");
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
        minHeight: "calc(100vh - 120px)",
        textAlign: "center",
        px: { xs: 2, sm: 4, md: 6 },
        py: 4,
      }}
    >
      <Typography
        variant="h1"
        color="white"
        gutterBottom
        fontWeight={700}
        sx={{
          fontSize: { xs: "2.5rem", sm: "3.5rem", md: "4.5rem", lg: "5rem" },
          mb: 2,
          textAlign: "center",
        }}
      >
        Deep Pull
      </Typography>
      <Typography
        variant="h5"
        color="rgba(255,255,255,0.8)"
        gutterBottom
        sx={{ mb: 6, textAlign: "center" }}
      >
        NFL Gaming Platform
      </Typography>

      <Stack
        spacing={3}
        direction={{ xs: "column", md: "row" }}
        alignItems="center"
        justifyContent="center"
        sx={{
          maxWidth: 1200,
          width: "100%",
          gap: 3,
        }}
      >
        {games.map((game) => (
          <Card
            key={game.id}
            sx={{
              width: { xs: "100%", md: 350 },
              height: 300,
              backgroundColor: "rgba(255,255,255,0.1)",
              backdropFilter: "blur(10px)",
              border: `2px solid ${game.color}`,
              transition: "all 0.3s ease",
              "&:hover": {
                transform: "translateY(-5px)",
                boxShadow: `0 8px 25px ${game.color}40`,
              },
            }}
          >
            <CardContent
              sx={{
                p: 3,
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Typography
                variant="h4"
                component="h2"
                gutterBottom
                sx={{ color: game.color, fontWeight: 700, mb: 2 }}
              >
                {game.title}
              </Typography>
              <Typography
                variant="body1"
                color="rgba(255,255,255,0.8)"
                sx={{ flexGrow: 1, mb: 2 }}
              >
                {game.description}
              </Typography>
              <Box sx={{ mt: "auto" }}>
                {game.status === "available" ? (
                  <Typography
                    variant="caption"
                    sx={{
                      color: "success.main",
                      fontWeight: 600,
                      textTransform: "uppercase",
                    }}
                  >
                    Available Now
                  </Typography>
                ) : (
                  <Typography
                    variant="caption"
                    sx={{
                      color: "warning.main",
                      fontWeight: 600,
                      textTransform: "uppercase",
                    }}
                  >
                    Coming Soon
                  </Typography>
                )}
              </Box>
            </CardContent>
            <CardActions sx={{ p: 3, pt: 0 }}>
              {game.status === "available" && isSignedIn ? (
                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  onClick={() => handleGameSelect(game.id)}
                  sx={{
                    backgroundColor: game.color,
                    "&:hover": {
                      backgroundColor: game.color,
                      opacity: 0.9,
                    },
                  }}
                >
                  Play Now
                </Button>
              ) : game.status === "available" ? (
                <SignInButton mode="modal">
                  <button
                    style={{
                      width: "100%",
                      padding: "12px 24px",
                      backgroundColor: game.color,
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontWeight: 500,
                      fontSize: "1rem",
                    }}
                  >
                    Sign In to Play
                  </button>
                </SignInButton>
              ) : (
                <Button
                  variant="outlined"
                  size="large"
                  fullWidth
                  disabled
                  sx={{
                    borderColor: game.color,
                    color: game.color,
                  }}
                >
                  Coming Soon
                </Button>
              )}
            </CardActions>
          </Card>
        ))}
      </Stack>

      {isSignedIn && (
        <Button
          variant="text"
          color="inherit"
          size="medium"
          onClick={handleViewProfile}
          sx={{
            fontSize: "1rem",
            color: "rgba(255,255,255,0.8)",
            mt: 4,
            "&:hover": {
              color: "white",
              backgroundColor: "rgba(255,255,255,0.1)",
            },
          }}
        >
          View Profile
        </Button>
      )}
    </Box>
  );
};

export default HomeScreen;
