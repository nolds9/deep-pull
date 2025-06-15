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
  | { type: "GAME_END"; data: { winnerId?: string; winningPath: string[] } }
  | { type: "TIMER_TICK" }
  | { type: "TIMEOUT" }
  | { type: "PLAY_AGAIN" }
  | { type: "HOME" };

const gameTimerActor = fromCallback<GameEvent, { timer: number }>(
  ({ sendBack, input }) => {
    const interval = setInterval(() => {
      sendBack({ type: "TIMER_TICK" });
    }, 1000);

    const timeout = setTimeout(() => {
      sendBack({ type: "TIMEOUT" });
    }, input.timer * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }
);

export const gameMachine = createMachine({
  id: "game",
  types: {} as {
    context: GameContext;
    events: GameEvent;
  },
  initial: "home",
  context: {
    timer: 30,
    draw: false,
    myReady: false,
    opponentReady: false,
    startPlayer: undefined,
    endPlayer: undefined,
    sessionId: undefined,
    opponentId: undefined,
    winnerId: undefined,
    winningPath: undefined,
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
      entry: assign({ timer: () => 30, draw: () => false }),
      invoke: {
        id: "gameTimer",
        src: gameTimerActor,
        input: ({ context }) => ({ timer: context.timer }),
      },
      on: {
        GAME_END: {
          target: "end",
          actions: assign({
            winnerId: ({ event }) => event.data.winnerId,
            winningPath: ({ event }) => event.data.winningPath,
          }),
        },
        TIMER_TICK: {
          actions: assign({ timer: ({ context }) => context.timer - 1 }),
        },
        TIMEOUT: {
          target: "end",
          actions: assign({ draw: () => true }),
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
