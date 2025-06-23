# Platform Development Tasks

This document outlines the necessary tasks to evolve the project into a scalable, multi-game platform as described in the architecture documents.

## 🚀 Frontend Rearchitecture

The goal is to implement the modular structure defined in `frontend_architecture.md`.

- [ ] **Install Dependencies**:
  - [ ] Install `react-router-dom` for client-side routing.
- [ ] **Refactor Directory Structure**:
  - [ ] Create `src/pages` for top-level screens.
  - [ ] Create `src/games` to house individual game modules.
  - [ ] Create `src/layouts` for shared layouts (e.g., Header, Footer).
  - [ ] Create `src/hooks` for shared custom hooks.
  - [ ] Create `src/services` for shared API/socket logic.
  - [ ] Create `src/styles` for global styling and themes.
- [ ] **Relocate Existing Code**:
  - [ ] Move `HomeScreen`, `ProfileScreen` to `src/pages`.
  - [ ] Create `src/games/player-rush` module.
  - [ ] Move `GameScreen`, `LobbyScreen`, `EndGameScreen` into `src/games/player-rush/screens`.
  - [ ] Move `gameMachine.ts` to `src/games/player-rush/state`.
  - [ ] Move `socket.ts` to `src/services`.
- [ ] **Update `App.tsx`**:
  - [ ] Refactor `App.tsx` to use `react-router-dom` for navigation.
  - [ ] Implement a `MainLayout` component.
  - [ ] Remove the monolithic state-switching logic in favor of routing.

## 🏗️ Backend Platform Enhancements

The goal is to evolve the backend from a single-game server to a multi-game platform foundation.

- [ ] **`GameManager` Rearchitecture**:
  - [ ] Refactor `GameManager` to support multiple game types.
  - [ ] Update the `joinQueue` socket event to accept a `gameType` parameter.
  - [ ] Implement a factory or strategy pattern for creating different game instances.
- [ ] **Game Session Persistence**:
  - [ ] Create a `GameSession` TypeORM entity based on `nfl_gaming_architecture.md`.
  - [ ] Update `GameManager` to save completed game sessions to the PostgreSQL database.
- [ ] **Standardize Schema Management**:
  - [ ] Use `etl/manage_schema.py` for creating and updating all non-data-pipeline tables (e.g., `users`, `game_sessions`, `team_season_leaders`).
- [ ] **Leaderboard API**:
  - [ ] Create a new REST API endpoint (e.g., `/api/leaderboard`).
  - [ ] The endpoint should accept query parameters for `gameType` and `difficulty`.
  - [ ] Implement logic to query persisted `game_sessions` and return ranked results.
- [ ] **Data for Future Games**:
  - [ ] Add the `team_season_leaders` table to the database schema (can use TypeORM entity or `etl/manage_schema.py`).
  - [ ] Extend the Python ETL pipeline (`etl/mvp_pipeline.py`) to calculate and populate this new table.
