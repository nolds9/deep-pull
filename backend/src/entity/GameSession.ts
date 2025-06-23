import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User";
import { Player } from "./Player";

@Entity({ name: "game_sessions" })
export class GameSession {
  @PrimaryColumn("uuid")
  id!: string;

  @Column({ default: "player_rush" })
  game_type!: string;

  @Column()
  game_mode!: string;

  @Column()
  difficulty!: string;

  @Column()
  player1_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "player1_id" })
  player1!: User;

  @Column({ nullable: true })
  player2_id?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "player2_id" })
  player2?: User;

  @Column()
  start_player_id!: string;

  @ManyToOne(() => Player)
  @JoinColumn({ name: "start_player_id" })
  start_player!: Player;

  @Column()
  end_player_id!: string;

  @ManyToOne(() => Player)
  @JoinColumn({ name: "end_player_id" })
  end_player!: Player;

  @Column({ nullable: true })
  winner_id?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "winner_id" })
  winner?: User;

  @Column({ type: "jsonb", nullable: true })
  winning_path?: any;

  @Column({ type: "int", nullable: true })
  duration_ms?: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
