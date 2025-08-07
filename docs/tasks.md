# Platform Development Tasks

This document outlines the necessary tasks to evolve the project into a scalable, multi-game platform as described in the architecture documents.

## 🚀 Frontend Rearchitecture

The goal is to implement the modular structure defined in `frontend_architecture.md`.

- [x] **Install Dependencies**:
  - [x] Install `react-router-dom` for client-side routing.
- [x] **Refactor Directory Structure**:
  - [x] Create `src/pages` for top-level screens.
  - [x] Create `src/games` to house individual game modules.
  - [x] Create `src/layouts` for shared layouts (e.g., Header, Footer).
  - [x] Create `src/hooks` for shared custom hooks.
  - [x] Create `src/services` for shared API/socket logic.
  - [x] Create `src/styles` for global styling and themes.
- [x] **Relocate Existing Code**:
  - [x] Move `HomeScreen`, `ProfileScreen` to `src/pages`.
  - [x] Create `src/games/player-rush` module.
  - [x] Move `GameScreen`, `LobbyScreen`, `EndGameScreen` into `src/games/player-rush/screens`.
  - [x] Move `gameMachine.ts` to `src/games/player-rush/state`.
  - [x] Move `socket.ts` to `src/services`.
- [x] **Update `App.tsx`**:
  - [x] Refactor `App.tsx` to use `react-router-dom` for navigation.
  - [x] Implement a `MainLayout` component.
  - [x] Remove the monolithic state-switching logic in favor of routing.
- [x] **Architectural Separation**:
  - [x] Separate navigation state from game state management.
  - [x] Create `PlatformContext` for game selection and shared state.
  - [x] Simplify XState machines to handle only game logic.
  - [x] Update all components to use React Router for navigation.
  - [x] Implement nested routing structure under `/games/[game-name]/`.
  - [x] Create comprehensive architecture documentation and rules.

## 🏗️ Backend Platform Enhancements

The goal is to evolve the backend from a single-game server to a multi-game platform foundation.

- [ ] **`GameManager` Rearchitecture**:
  - [ ] Refactor `GameManager` to support multiple game types.
  - [ ] Update the `joinQueue` socket event to accept a `gameType` parameter.
  - [ ] Implement a factory or strategy pattern for creating different game instances.
- [x] **Game Session Persistence**:
  - [x] Create a `GameSession` table schema in `etl/manage_schema.py`.
  - [x] Create the `GameSession` TypeORM entity.
  - [x] Update `GameManager` to save completed game sessions to the PostgreSQL database.
- [x] **Standardize Schema Management**:
  - [x] Use `etl/manage_schema.py` for creating and updating all application and data-pipeline tables.
- [x] **Leaderboard API**:
  - [x] Create a new REST API endpoint (e.g., `/api/leaderboard`).
  - [x] The endpoint should accept query parameters for `gameType` and `difficulty`.
  - [x] Implement logic to query persisted `game_sessions` and return ranked results.
- [x] **Data for Future Games**:
  - [x] Add `teams` and `team_season_leaders` tables to `etl/manage_schema.py`.
  - [x] Create `Team` and `TeamSeasonLeaders` TypeORM entities.
  - [x] Extend the Python ETL pipeline (`etl/mvp_pipeline.py`) to calculate and populate the `teams` and `team_season_leaders` tables.
