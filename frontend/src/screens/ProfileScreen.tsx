import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Avatar,
  Stack,
  CircularProgress,
  Button,
} from "@mui/material";
import { useAuth, useUser } from "@clerk/clerk-react";

interface UserStats {
  single_player_high_score: number;
  multiplayer_wins: number;
  multiplayer_losses: number;
}

interface ProfileScreenProps {
  onBack: () => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ onBack }) => {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = await getToken();
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/user/me`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (response.ok) {
          const data = await response.json();
          setStats(data.stats);
        }
      } catch (error) {
        console.error("Failed to fetch user stats", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [getToken]);

  if (loading || !user) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexGrow: 1,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flexGrow: 1,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        p: 3,
        background: "linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%)",
        color: "white",
      }}
    >
      <Paper
        elevation={6}
        sx={{
          p: 4,
          borderRadius: 4,
          textAlign: "center",
          backgroundColor: "rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(10px)",
        }}
      >
        <Avatar
          src={user.imageUrl}
          alt={user.fullName || "User Avatar"}
          sx={{
            width: 100,
            height: 100,
            mx: "auto",
            mb: 2,
            border: "2px solid white",
          }}
        />
        <Typography variant="h4" gutterBottom fontWeight={700}>
          {user.fullName}
        </Typography>
        <Typography variant="h6" color="grey.300" gutterBottom>
          @{user.username}
        </Typography>

        <Stack spacing={2} sx={{ mt: 4 }}>
          <Typography variant="h5">Combat Record</Typography>
          <Stack direction="row" spacing={4} justifyContent="center">
            <Box>
              <Typography variant="h4">
                {stats?.multiplayer_wins ?? 0}
              </Typography>
              <Typography variant="body1">Wins</Typography>
            </Box>
            <Box>
              <Typography variant="h4">
                {stats?.multiplayer_losses ?? 0}
              </Typography>
              <Typography variant="body1">Losses</Typography>
            </Box>
          </Stack>
          <Typography variant="h5" sx={{ mt: 3 }}>
            Single Player
          </Typography>
          <Box>
            <Typography variant="h4">
              {stats?.single_player_high_score ?? 0}
            </Typography>
            <Typography variant="body1">High Score</Typography>
          </Box>
        </Stack>
      </Paper>
      <Button
        variant="outlined"
        color="secondary"
        onClick={onBack}
        sx={{ mt: 3 }}
      >
        Back
      </Button>
    </Box>
  );
};

export default ProfileScreen;
