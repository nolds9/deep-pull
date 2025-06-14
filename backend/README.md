# NFL Gaming Backend (MVP)

## Setup

1. Copy `.env.example` to `.env` and set your PostgreSQL connection string.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run in development mode:
   ```bash
   npm run dev
   ```

## Project Structure

- `src/entity/` - TypeORM entities (Player, PlayerConnection)
- `src/services/` - Game logic, matchmaking, pathfinding
- `src/types/` - TypeScript interfaces
- `src/app.ts` - Express + Socket.io server entrypoint

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
