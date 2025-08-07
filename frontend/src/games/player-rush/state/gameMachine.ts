import { createMachine, assign, fromCallback, stop } from "xstate";
import type { Player } from "../../../types";

export type GameMode = "single" | "multiplayer";
export type Difficulty = "easy" | "medium" | "hard";

export interface GameContext {
  timer: number;
  stopwatch: number;
  myReady: boolean;
  opponentReady: boolean;
  startPlayer?: Player;
  endPlayer?: Player;
  sessionId?: string;
  opponentId?: string;
  winnerId?: string;
  winningPath?: string[];
  solutionPaths?: string[][];
  mode: GameMode;
  difficulty: Difficulty;
  score: number;
  strikes: number;
  maxStrikes: number;
  reason?: string;
}

export type GameEvent =
  | { type: "SET_MODE"; mode: GameMode }
  | { type: "SET_DIFFICULTY"; difficulty: Difficulty }
  | { type: "START_GAME" }
  | {
      type: "GAME_START";
      data: {
        sessionId: string;
        startPlayer: Player;
        endPlayer: Player;
        opponentId?: string;
        mode: GameMode;
        difficulty: Difficulty;
        strikes: number;
        maxStrikes: number;
      };
    }
  | { type: "READY_UP" }
  | { type: "OPPONENT_READY" }
  | { type: "ALL_PLAYERS_READY" }
  | { type: "COUNTDOWN_DONE" }
  | {
      type: "GAME_END";
      data: {
        winnerId?: string | null;
        winningPath: string[];
        solutionPaths?: string[][];
        score?: number;
        reason?: string;
      };
    }
  | { type: "TIMER_TICK" }
  | { type: "STOPWATCH_TICK" }
  | { type: "PLAY_AGAIN" }
  | { type: "RESET" };

const gameTimerActor = fromCallback<GameEvent>(({ sendBack }) => {
  const interval = setInterval(() => {
    sendBack({ type: "TIMER_TICK" });
  }, 1000);
  return () => clearInterval(interval);
});

const stopwatchActor = fromCallback<GameEvent>(({ sendBack }) => {
  const interval = setInterval(() => {
    sendBack({ type: "STOPWATCH_TICK" });
  }, 1000);
  return () => clearInterval(interval);
});

export const gameMachine = createMachine(
  {
    id: "playerRushGame",
    types: {} as {
      context: GameContext;
      events: GameEvent;
    },
    context: {
      timer: 60,
      stopwatch: 0,
      myReady: false,
      opponentReady: false,
      score: 0,
      strikes: 0,
      maxStrikes: 0,
      mode: "single",
      difficulty: "easy",
    },
    initial: "idle",
    states: {
      idle: {
        on: {
          SET_MODE: {
            actions: assign({
              mode: ({ event }) => event.mode,
            }),
          },
          SET_DIFFICULTY: {
            actions: assign({
              difficulty: ({ event }) => event.difficulty,
            }),
          },
          START_GAME: "loading",
        },
      },
      loading: {
        on: {
          GAME_START: [
            {
              target: "lobby",
              guard: ({ event }) => event.data.mode === "multiplayer",
              actions: assign({
                sessionId: ({ event }) => event.data.sessionId,
                startPlayer: ({ event }) => event.data.startPlayer,
                endPlayer: ({ event }) => event.data.endPlayer,
                opponentId: ({ event }) => event.data.opponentId,
                strikes: ({ event }) => event.data.strikes,
                maxStrikes: ({ event }) => event.data.maxStrikes,
              }),
            },
            {
              target: "countdown",
              guard: ({ event }) => event.data.mode === "single",
              actions: assign({
                sessionId: ({ event }) => event.data.sessionId,
                startPlayer: ({ event }) => event.data.startPlayer,
                endPlayer: ({ event }) => event.data.endPlayer,
                strikes: ({ event }) => event.data.strikes,
                maxStrikes: ({ event }) => event.data.maxStrikes,
              }),
            },
          ],
        },
      },
      lobby: {
        on: {
          READY_UP: { actions: assign({ myReady: true }) },
          OPPONENT_READY: { actions: assign({ opponentReady: true }) },
          ALL_PLAYERS_READY: "countdown",
        },
      },
      countdown: {
        on: {
          COUNTDOWN_DONE: "game",
        },
      },
      game: {
        initial: "starting",
        states: {
          starting: {
            always: [
              { target: "runningMultiplayer", guard: "isMultiplayer" },
              { target: "runningSingleplayer" },
            ],
          },
          runningMultiplayer: {
            invoke: {
              id: "gameTimer",
              src: "gameTimer",
            },
            on: {
              TIMER_TICK: {
                actions: assign({ timer: ({ context }) => context.timer - 1 }),
              },
            },
          },
          runningSingleplayer: {
            invoke: {
              id: "stopwatch",
              src: "stopwatch",
            },
            on: {
              STOPWATCH_TICK: {
                actions: assign({
                  stopwatch: ({ context }) => context.stopwatch + 1,
                }),
              },
            },
          },
        },
        entry: assign({
          timer: 60,
          stopwatch: 0,
        }),
        on: {
          GAME_END: {
            target: "finished",
            actions: assign({
              winnerId: ({ event }) => event.data.winnerId || undefined,
              winningPath: ({ event }) => event.data.winningPath,
              solutionPaths: ({ event }) => event.data.solutionPaths,
              score: ({ event }) => event.data.score ?? 0,
              reason: ({ event }) => event.data.reason,
            }),
          },
        },
      },
      finished: {
        entry: [stop("gameTimer"), stop("stopwatch")],
        on: {
          PLAY_AGAIN: {
            target: "idle",
            actions: assign({
              myReady: false,
              opponentReady: false,
              winnerId: undefined,
              winningPath: undefined,
              solutionPaths: undefined,
              score: 0,
              reason: undefined,
            }),
          },
          RESET: {
            target: "idle",
            actions: assign({
              myReady: false,
              opponentReady: false,
              winnerId: undefined,
              winningPath: undefined,
              solutionPaths: undefined,
              score: 0,
              mode: "single",
              difficulty: "easy",
              reason: undefined,
            }),
          },
        },
      },
    },
  },
  {
    actors: {
      gameTimer: gameTimerActor,
      stopwatch: stopwatchActor,
    },
    guards: {
      isMultiplayer: ({ context }) => context.mode === "multiplayer",
      isSinglePlayer: ({ context }) => context.mode === "single",
    },
  }
);
