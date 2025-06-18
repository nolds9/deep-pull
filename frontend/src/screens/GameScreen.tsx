import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Typography,
  Stack,
  Autocomplete,
  TextField,
  CircularProgress,
  Chip,
  Paper,
  Alert,
} from "@mui/material";
import type { Player } from "../types";
import { socket } from "../socket";
import type { GameMode } from "../state/gameMachine";

interface GameScreenProps {
  startPlayer: Player;
  endPlayer: Player;
  sessionId: string;
  onPathSubmit: (path: string[]) => void;
  mode?: GameMode;
  strikes: number;
  maxStrikes: number;
  stopwatch: number;
}

const PathConnection: React.FC<{ type?: string }> = ({ type }) => (
  <Box sx={{ mx: 0.5, color: "grey.500", alignSelf: "center" }}>
    <Typography variant="body2">{type || "→"}</Typography>
  </Box>
);

const GameScreen: React.FC<GameScreenProps> = ({
  startPlayer,
  endPlayer,
  sessionId,
  onPathSubmit,
  mode,
  strikes,
  maxStrikes,
  stopwatch,
}) => {
  const [path, setPath] = useState<Player[]>([startPlayer]);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<readonly Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "error" | "info" | "success";
    message: string;
  } | null>(null);

  useEffect(() => {
    const onInvalidPath = (data: { pathLength: number; strikes?: number }) => {
      let message = "That's not a valid connection!";
      if (data.strikes !== undefined) {
        message += ` ${data.strikes} strikes remaining.`;
      }
      setFeedback({ type: "error", message });
      const timer = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(timer);
    };

    const onOpponentAttempt = ({
      success,
      pathLength,
    }: {
      success: boolean;
      pathLength: number;
    }) => {
      const message = success
        ? `Your opponent found a path of length ${pathLength}!`
        : `Your opponent tried a path of length ${pathLength}.`;
      setFeedback({ type: success ? "info" : "info", message });
      const timer = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(timer);
    };

    socket.on("invalidPath", onInvalidPath);
    socket.on("opponentAttemptedPath", onOpponentAttempt);

    return () => {
      socket.off("invalidPath", onInvalidPath);
      socket.off("opponentAttemptedPath", onOpponentAttempt);
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (inputValue === "") {
      setOptions([]);
      return undefined;
    }

    setLoading(true);
    const fetchPlayers = async () => {
      try {
        const response = await fetch(
          `http://localhost:3001/api/players?search=${inputValue}`
        );
        const players = await response.json();
        if (active) {
          setOptions(players);
        }
      } catch (error) {
        console.error("Failed to fetch players", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const debounceTimer = setTimeout(() => {
      fetchPlayers();
    }, 300); // Debounce API calls

    return () => {
      active = false;
      clearTimeout(debounceTimer);
    };
  }, [inputValue]);

  const handleAddPlayer = (player: Player | null) => {
    if (player) {
      if (path.some((p) => p.id === player.id)) {
        setFeedback({
          type: "error",
          message: "Player is already in the path.",
        });
        setTimeout(() => setFeedback(null), 3000);
        return;
      }

      if (path[path.length - 1].id === endPlayer.id) {
        return;
      }
      setPath([...path, player]);

      // If the added player is the end player, clear the search
      if (player.id === endPlayer.id) {
        setInputValue("");
        setOptions([]);
      }
    }
  };

  const handleSubmit = () => {
    if (path.length > 1 && path[path.length - 1].id === endPlayer.id) {
      onPathSubmit(path.map((p) => p.id));
    } else {
      setFeedback({
        type: "error",
        message: "Path must end with the target player.",
      });
      setTimeout(() => setFeedback(null), 6000);
    }
  };

  const isPathComplete =
    path.length > 1 && path[path.length - 1].id === endPlayer.id;

  return (
    <Box
      sx={{
        flexGrow: 1,
        width: "100%",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        p: 3,
        background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
        color: "white",
      }}
    >
      <Stack
        direction="row"
        spacing={4}
        sx={{ position: "absolute", top: 24, left: 24, right: 24 }}
        justifyContent="space-between"
      >
        {mode === "single" && (
          <Typography variant="h4" fontWeight={700}>
            Time: {stopwatch.toFixed(0)}s
          </Typography>
        )}
        {maxStrikes > 0 && maxStrikes !== Infinity && (
          <Typography variant="h4" fontWeight={700}>
            Strikes: {strikes}/{maxStrikes}
          </Typography>
        )}
      </Stack>

      <Box sx={{ position: "absolute", top: 80, width: "100%", px: 2 }}>
        {feedback && (
          <Alert severity={feedback.type} sx={{ justifyContent: "center" }}>
            {feedback.message}
          </Alert>
        )}
      </Box>

      <Typography variant="h5" textAlign="center" gutterBottom>
        Find a path from{" "}
        <Typography component="strong" variant="h5" color="secondary.light">
          {startPlayer.name}
        </Typography>{" "}
        to{" "}
        <Typography component="strong" variant="h5" color="secondary.light">
          {endPlayer.name}
        </Typography>
      </Typography>

      <Paper
        elevation={3}
        sx={{
          p: 2,
          my: 2,
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
          alignItems: "center",
          justifyContent: "center",
          maxWidth: "90%",
          backgroundColor: "rgba(0,0,0,0.2)",
        }}
      >
        {path.map((player, index) => (
          <React.Fragment key={`${player.id}-${index}`}>
            <Chip
              label={player.name}
              color={
                player.id === startPlayer.id || player.id === endPlayer.id
                  ? "success"
                  : "primary"
              }
              sx={{ color: "white", fontWeight: "bold" }}
            />
            {index < path.length - 1 && <PathConnection />}
          </React.Fragment>
        ))}
      </Paper>

      {!isPathComplete && (
        <Autocomplete
          sx={{ width: 350, my: 2 }}
          open={open}
          onOpen={() => setOpen(true)}
          onClose={() => setOpen(false)}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          getOptionLabel={(option) => option.name}
          options={options}
          loading={loading}
          value={null}
          onChange={(_, newValue) => {
            handleAddPlayer(newValue);
          }}
          onInputChange={(_, newInputValue) => {
            setInputValue(newInputValue);
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search for next player"
              variant="outlined"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading ? (
                      <CircularProgress color="inherit" size={20} />
                    ) : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
          renderOption={(props, option) => (
            <li {...props} key={option.id}>
              <Typography variant="body1">{option.name}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                ({option.position})
              </Typography>
            </li>
          )}
        />
      )}

      {isPathComplete && (
        <Typography variant="h6" color="success.light" sx={{ my: 2 }}>
          Path complete! Ready to submit?
        </Typography>
      )}

      <Stack direction="row" spacing={2}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleSubmit}
          disabled={!isPathComplete}
        >
          Submit Path
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          size="large"
          onClick={() => {
            setPath([startPlayer]);
            setFeedback(null);
          }}
        >
          Reset
        </Button>
        <Button
          variant="contained"
          color="error"
          size="large"
          onClick={() => {
            socket.emit("giveUp", { sessionId });
          }}
        >
          Give Up
        </Button>
      </Stack>
    </Box>
  );
};

export default GameScreen;
