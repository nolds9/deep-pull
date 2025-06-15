import { createMachine, assign, fromCallback } from "xstate";
import type { Player } from "../types";

export interface GameContext {
  timer: number;
  draw: boolean;
  myReady: boolean;
  opponentReady: boolean;
  startPlayer?: Player;
  endPlayer?: Player;
  sessionId?: string;
  opponentId?: string;
  winnerId?: string;
  winningPath?: string[];
  solutionPaths?: string[][];
}

export type GameEvent =
  | { type: "PLAY" }
  | { type: "HOW_TO_PLAY" }
  | { type: "BACK" }
  | {
      type: "MATCHED";
      data: {
        sessionId: string;
        startPlayer: Player;
        endPlayer: Player;
        opponentId: string;
      };
    }
  | { type: "READY_UP" }
  | { type: "OPPONENT_READY" }
  | { type: "ALL_PLAYERS_READY" }
  | { type: "COUNTDOWN_DONE" }
  | {
      type: "GAME_END";
      data: {
        winnerId?: string;
        winningPath: string[];
        solutionPaths?: string[][];
      };
    }
  | { type: "TIMER_TICK" }
  | { type: "PLAY_AGAIN" }
  | { type: "HOME" };

const gameTimerActor = fromCallback<GameEvent>(({ sendBack }) => {
  const interval = setInterval(() => {
    sendBack({ type: "TIMER_TICK" });
  }, 1000);

  return () => {
    clearInterval(interval);
  };
});

export const gameMachine = createMachine({
  id: "game",
  types: {} as {
    context: GameContext;
    events: GameEvent;
  },
  initial: "home",
  context: {
    timer: 60,
    draw: false,
    myReady: false,
    opponentReady: false,
    startPlayer: undefined,
    endPlayer: undefined,
    sessionId: undefined,
    opponentId: undefined,
    winnerId: undefined,
    winningPath: undefined,
    solutionPaths: undefined,
  },
  states: {
    home: {
      on: {
        PLAY: "queue",
        HOW_TO_PLAY: "howto",
      },
    },
    queue: {
      on: {
        MATCHED: {
          target: "lobby",
          actions: assign({
            sessionId: ({ event }) => event.data.sessionId,
            startPlayer: ({ event }) => event.data.startPlayer,
            endPlayer: ({ event }) => event.data.endPlayer,
            opponentId: ({ event }) => event.data.opponentId,
          }),
        },
        BACK: "home",
      },
    },
    lobby: {
      on: {
        READY_UP: {
          actions: assign({ myReady: () => true }),
        },
        OPPONENT_READY: {
          actions: assign({ opponentReady: () => true }),
        },
        ALL_PLAYERS_READY: "countdown",
      },
    },
    countdown: {
      after: {
        3000: { target: "game" },
      },
      on: {
        COUNTDOWN_DONE: "game",
      },
    },
    game: {
      entry: assign({ timer: () => 60, draw: () => false }),
      invoke: {
        id: "gameTimer",
        src: gameTimerActor,
      },
      on: {
        GAME_END: {
          target: "end",
          actions: assign({
            winnerId: ({ event }) => event.data.winnerId,
            winningPath: ({ event }) => event.data.winningPath,
            solutionPaths: ({ event }) => event.data.solutionPaths,
          }),
        },
        TIMER_TICK: {
          actions: assign({ timer: ({ context }) => context.timer - 1 }),
        },
      },
    },
    end: {
      on: {
        PLAY_AGAIN: {
          target: "queue",
          actions: assign({
            draw: () => false,
            myReady: false,
            opponentReady: false,
            startPlayer: undefined,
            endPlayer: undefined,
            sessionId: undefined,
            opponentId: undefined,
            winnerId: undefined,
            winningPath: undefined,
            solutionPaths: undefined,
          }),
        },
        HOME: {
          target: "home",
          actions: assign({
            draw: () => false,
            myReady: false,
            opponentReady: false,
            startPlayer: undefined,
            endPlayer: undefined,
            sessionId: undefined,
            opponentId: undefined,
            winnerId: undefined,
            winningPath: undefined,
            solutionPaths: undefined,
          }),
        },
      },
    },
    howto: {
      on: {
        BACK: "home",
      },
    },
  },
});
