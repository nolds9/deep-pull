import { createMachine, assign, fromCallback } from "xstate";

export interface GameContext {
  timer: number;
  draw: boolean;
}

export type GameEvent =
  | { type: "PLAY" }
  | { type: "HOW_TO_PLAY" }
  | { type: "BACK" }
  | { type: "MATCHED" }
  | { type: "COUNTDOWN_DONE" }
  | { type: "GAME_END" }
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
        MATCHED: "countdown",
        BACK: "home",
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
        GAME_END: "end",
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
          actions: assign({ draw: () => false }),
        },
        HOME: {
          target: "home",
          actions: assign({ draw: () => false }),
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
