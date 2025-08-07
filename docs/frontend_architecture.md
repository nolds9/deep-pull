# Frontend Architecture

This document outlines the modular frontend architecture designed to support multiple games on a single platform.

## Directory Structure

```
src/
├── components/          # Shared UI components
├── context/            # Platform-level context providers
├── games/              # Individual game modules
│   ├── player-rush/    # Player Rush game
│   │   ├── components/ # Game-specific components
│   │   ├── context/    # Game-specific context
│   │   ├── screens/    # Game-specific screens
│   │   └── state/      # Game state machines
│   └── gladiator/      # Future Gladiator game
│       ├── components/ # Game-specific components
│       ├── context/    # Game-specific context
│       ├── screens/    # Game screens
│       └── state/      # Game state machines
├── hooks/              # Shared custom hooks
├── layouts/            # Shared layout components
├── pages/              # Platform-level pages
├── router.tsx          # Main router configuration
├── services/           # Shared services (API, sockets)
└── styles/             # Global styles and themes
```

## Navigation Structure

### Platform-Level Navigation

- **`/`** - Game selector (platform home)
- **`/profile`** - User profile and stats

### Game-Specific Navigation

Each game has its own navigation structure:

```
/games/[game-name]/
├── /                    # Game home screen
├── /how-to-play         # Game-specific instructions
├── /mode                # Game mode selection
├── /game                # Active gameplay
├── /lobby               # Multiplayer lobby
├── /queue               # Queue screen
├── /loading             # Loading screen
├── /countdown           # Countdown screen
└── /end-game           # Game results
```

## State Management Architecture

### Separation of Concerns

We follow a clear separation between **navigation state** and **game state**:

#### 1. **React Router for Navigation**

- Handles all routing and navigation logic
- Manages browser history and URL state
- Provides clean, declarative routing

#### 2. **XState for Game Logic**

- Manages only game-specific state
- Handles game flow, timers, and game events
- Pure game logic without navigation concerns

#### 3. **Context Providers**

- **Platform Context**: Manages game selection and shared platform state
- **Game Context**: Manages individual game state and socket communication

### Game-Specific State Machines

Each game has its own dedicated state machine located in its respective directory:

```
games/
└── [game-name]/
    ├── state/
    │   └── gameMachine.ts    # Game-specific state machine
    ├── context/
    │   └── GameContext.tsx   # Game-specific context
    └── screens/              # Game screens
```

**Benefits**:

- **Isolation**: Each game's state logic is completely separate
- **Maintainability**: Changes to one game don't affect others
- **Scalability**: Easy to add new games with their own state machines
- **Reusability**: Game state machines can be reused or extended

### Example: Adding a New Game

When adding a new game (e.g., "Gladiator"), you would:

1. **Create the directory structure**:

   ```
   games/gladiator/
   ├── components/
   ├── context/
   ├── screens/
   └── state/
   ```

2. **Create the game state machine**:

   ```typescript
   // games/gladiator/state/gameMachine.ts
   export const gladiatorMachine = createMachine({
     id: "gladiatorGame",
     // Game-specific states and logic
   });
   ```

3. **Create the game context**:

   ```typescript
   // games/gladiator/context/GladiatorContext.tsx
   export const GladiatorProvider = ({ children }) => {
     const [state, send] = useMachine(gladiatorMachine);
     // Game-specific context logic
   };
   ```

4. **Add routes to the router**:

   ```typescript
   {
     path: "/games/gladiator",
     element: <GladiatorProvider><Outlet /></GladiatorProvider>,
     children: [
       { path: "/", element: <GladiatorHomeScreen /> },
       { path: "/how-to-play", element: <GladiatorHowToPlayScreen /> },
       { path: "/arena", element: <ArenaScreen /> },
       // ... other game routes
     ],
   }
   ```

5. **Update platform context**:
   ```typescript
   export type GameType = "player-rush" | "gladiator" | "team-battle";
   ```

### Architecture Benefits

1. **🎯 Single Responsibility**: Each system has one clear purpose
2. **🔧 Easy Extension**: Adding new games is straightforward
3. **🧹 Cleaner Code**: No complex navigation logic in game state machines
4. **🔄 Better UX**: React Router provides proper browser history
5. **♻️ Reusable**: Game state machines can be reused across different routing setups

### Example Structure

```typescript
// Platform Context - handles game selection
const PlatformProvider = ({ children }) => {
  const [selectedGame, setSelectedGame] = useState<GameType | null>(null);
  const navigateToGame = (game: GameType) => {
    setSelectedGame(game);
    navigate(`/games/${game}`);
  };
  // ...
};

// Game Context - handles only game state
const GameProvider = ({ children }) => {
  const [state, send] = useMachine(gameMachine);
  // Only game logic, no navigation
  // ...
};
```

### Router Structure

```typescript
const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <PlatformProvider>
        <Outlet />
      </PlatformProvider>
    ),
    children: [
      { path: "/", element: <HomeScreen /> }, // Game selector
      { path: "/profile", element: <ProfileScreen /> },
      {
        path: "/games/player-rush",
        element: (
          <GameProvider>
            <Outlet />
          </GameProvider>
        ),
        children: [
          { path: "/", element: <PlayerRushHomeScreen /> },
          { path: "/how-to-play", element: <PlayerRushHowToPlayScreen /> },
          { path: "/mode", element: <ModeScreen /> },
          { path: "/game", element: <GameScreen /> },
          { path: "/lobby", element: <LobbyScreen /> },
          // ... other game routes
        ],
      },
      {
        path: "/games/gladiator",
        element: (
          <GladiatorProvider>
            <Outlet />
          </GladiatorProvider>
        ),
        children: [
          { path: "/", element: <GladiatorHomeScreen /> },
          { path: "/how-to-play", element: <GladiatorHowToPlayScreen /> },
          { path: "/arena", element: <ArenaScreen /> },
          // ... other gladiator routes
        ],
      },
    ],
  },
]);
```

## Game Module Structure

Each game follows this structure:

```
games/
└── [game-name]/
    ├── components/     # Game-specific UI components
    ├── context/        # Game context provider
    ├── screens/        # Game screens
    │   ├── HomeScreen.tsx           # Game home screen
    │   ├── HowToPlayScreen.tsx      # Game-specific instructions
    │   ├── ModeScreen.tsx           # Game mode selection
    │   ├── GameScreen.tsx           # Active gameplay
    │   ├── LobbyScreen.tsx          # Multiplayer lobby
    │   ├── QueueScreen.tsx          # Queue screen
    │   ├── LoadingScreen.tsx        # Loading screen
    │   ├── CountdownScreen.tsx      # Countdown screen
    │   └── EndGameScreen.tsx        # Game results
    ├── state/          # XState machine
    └── types.ts        # Game-specific types
```

### Adding a New Game

1. Create the game directory structure
2. Create game-specific context and state machine
3. Create game-specific screens (Home, HowToPlay, etc.)
4. Add routes to the router
5. Update platform context with new game type
6. No complex navigation logic needed!

## Best Practices

### ✅ Do

- Use React Router for all navigation
- Keep XState machines focused on game logic only
- Use context providers for shared state
- Follow the established directory structure
- Keep game state machines pure and reusable
- Place each game's state machine in its own directory
- Create game-specific home and how-to-play screens

### ❌ Don't

- Mix navigation logic with game state
- Use XState for routing decisions
- Create complex state machines that handle both navigation and game logic
- Hard-code navigation in game components
- Share state machines between different games
- Use platform-level screens for game-specific content

## Migration Guide

When migrating from mixed state management:

1. **Extract Navigation**: Move all navigation logic to React Router
2. **Simplify State Machines**: Remove navigation states and events
3. **Update Context**: Create separate platform and game contexts
4. **Update Components**: Use React Router hooks for navigation
5. **Create Game-Specific Screens**: Move game-specific content to game directories
6. **Test Thoroughly**: Ensure all navigation flows work correctly

This architecture ensures scalability, maintainability, and clean separation of concerns across the entire platform.
