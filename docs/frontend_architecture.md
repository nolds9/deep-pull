# Frontend Architecture Guide

This document outlines the proposed architecture for the Deep-Pull frontend, designed to support multiple games, ensure scalability, and improve developer experience.

## 1. Core Principles

- **Modularity**: Each game should be a self-contained module.
- **Scalability**: The architecture should easily accommodate new games and features without major refactoring.
- **Reusability**: Shared components, hooks, and services should be easily accessible across the platform.
- **Clear Separation of Concerns**: A clean separation between UI, state management, and business logic.

## 2. Routing

To navigate between different games and pages (like Home, Profile, etc.), we will introduce `react-router-dom`. This is a standard and robust solution for routing in React applications.

### Key Routes:

- `/`: Home screen with game selection.
- `/profile`: User profile and stats screen.
- `/games`: A lobby to browse all available games.
- `/game/player-rush`: The entry point for the "Player Rush" game.
- `/game/gladiator-arena`: The entry point for a future "Gladiator Arena" game.

## 3. Directory Structure

The current structure is good for a single application, but we will reorganize it to support multiple games.

```
frontend/
└── src/
    ├── assets/
    ├── components/         # (REVISED) Shared, reusable UI components (Button, Card, Header, etc.)
    ├── layouts/            # (NEW) Main application layouts (e.g., MainLayout with header/footer)
    ├── hooks/              # (NEW) Shared custom hooks (e.g., useAuth, useSocket)
    ├── services/           # (NEW) Shared services (api.ts, socket.ts)
    ├── state/              # (REVISED) Global state management (e.g., user state, auth)
    ├── styles/             # (NEW) Global styles, theme definitions, CSS variables
    ├── types/              # (REVISED) Shared TypeScript types across the app
    ├── pages/              # (NEW) Top-level pages (HomeScreen, ProfileScreen, GameLobbyScreen)
    └── games/              # (NEW) All game-specific logic and components
        ├── player-rush/
        │   ├── components/ # Components specific to Player Rush
        │   ├── screens/    # GameScreen, EndScreen, etc. for Player Rush
        │   ├── state/      # XState machine and logic for Player Rush
        │   └── index.tsx   # Entry point for the Player Rush game module
        │
        └── gladiator-arena/ # Future game
            ├── components/
            ├── screens/
            └── state/
```

### Rationale:

- **`pages/`**: Contains the main static pages of the application, which act as entry points or informational views.
- **`components/`, `hooks/`, `services/`, `styles/`**: These directories at the root level contain all the shared logic and UI elements that can be used by any page or game. This promotes consistency and reduces code duplication.
- **`games/`**: This is the most significant change. Each subdirectory within `games/` is a self-contained game. This modular approach means:
  - A game can have its own specific state management (`game/player-rush/state`).
  - A game can have its own components that are not used anywhere else.
  - It's easy to add a new game by simply creating a new folder, without touching the code of other games.

## 4. State Management

- **Global State (Zustand or Redux Toolkit)**: While XState is excellent for complex component-level or game-specific state, a simpler global state manager should be used for shared application state like user authentication status, profile information, and site-wide notifications.
- **Game State (XState)**: We will continue to use XState for managing the complex state within each game. The state machine for each game will live inside its respective module (e.g., `src/games/player-rush/state/gameMachine.ts`).

## 5. Implementation Steps

1.  **Install `react-router-dom`**: `npm install react-router-dom`
2.  **Refactor `App.tsx`**:
    - Set up the main router using `<BrowserRouter>`.
    - Define the top-level routes for pages like Home and Profile.
    - Create a main layout component (`src/layouts/MainLayout.tsx`) that includes the `Header` and renders the child routes.
3.  **Move Files**:
    - Relocate existing screens (`HomeScreen`, `ProfileScreen`, etc.) to the new `src/pages/` directory.
    - Move game-specific screens (`GameScreen`, `LobbyScreen`, `EndGameScreen`) into `src/games/player-rush/screens/`.
    - Move the `gameMachine.ts` into `src/games/player-rush/state/`.
4.  **Create Game Entry Points**: Each game module will export a primary component that handles its internal logic, which will be rendered by the main router.
5.  **Update Imports**: Adjust all import paths to reflect the new directory structure.

This architecture will provide a solid foundation for building a multi-game platform, making future development faster and more organized.
