# Project Working Memory

This document tracks the live implementation status of the platform rearchitecture. Refer to `tasks.md` for the full list of tasks.

## ⏳ In Progress

- _No tasks currently in progress._

## 🛑 Blocked

- _No tasks are currently blocked._

## ✅ Recently Completed

- [x] **Extend ETL for Team Data**:
  - Extended the Python ETL pipeline (`etl/mvp_pipeline.py`) to populate the `teams` and `team_season_leaders` tables.
  - The pipeline now fetches team metadata and calculates seasonal leaders for passing, rushing, and receiving.
  - Updated the `run_etl.py` script to report on these new data points.
- [x] **Standardize Schema Management**:
  - Consolidated all table definitions (`players`, `teams`, `users`, `user_stats`, `game_sessions`, `player_connections`, `player_seasonal_stats`, `team_season_leaders`) into `etl/manage_schema.py` as the single source of truth.
  - Added a `--recreate` flag to the script for robust schema resets.
  - Refactored `etl/mvp_pipeline.py` to clear and append data, respecting the master schema.
- [x] **Create Backend Entities**:
  - Created or updated all TypeORM entities in `backend/src/entity/` to perfectly match the database schema, including creating `GameSession.ts`, `Team.ts`, and `TeamSeasonLeaders.ts`.

---

## Developer Notes

- With the schema and entities fully aligned, the backend is now ready for the next phase of development, which includes updating the `GameManager` to persist game sessions.
