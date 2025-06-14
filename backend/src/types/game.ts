export interface Player {
  id: string;
  name: string;
  position: string;
  college: string;
  draft_year: number;
  teams: string[];
  first_season: number;
  last_season: number;
}

export interface Connection {
  player1_id: string;
  player2_id: string;
  connection_type: "teammate" | "college" | "draft_class" | "position";
  metadata: Record<string, any>;
}

export interface GameSession {
  id: string;
  players: [string, string]; // socket IDs
  startPlayer: Player;
  endPlayer: Player;
  status: "waiting" | "active" | "finished";
  winner?: string;
  winningPath?: string[];
  startTime?: Date;
}
