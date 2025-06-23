import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Player } from "./Player";
import { Team } from "./Team";

@Entity({ name: "team_season_leaders" })
@Index(["team_id", "season"])
export class TeamSeasonLeaders {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  team_id!: string;

  @ManyToOne(() => Team)
  @JoinColumn({ name: "team_id" })
  team!: Team;

  @Column({ type: "int" })
  season!: number;

  @Column({ nullable: true })
  passing_leader_id?: string;

  @ManyToOne(() => Player)
  @JoinColumn({ name: "passing_leader_id" })
  passing_leader?: Player;

  @Column({ nullable: true })
  rushing_leader_id?: string;

  @ManyToOne(() => Player)
  @JoinColumn({ name: "rushing_leader_id" })
  rushing_leader?: Player;

  @Column({ type: "jsonb", nullable: true })
  receiving_leaders?: any;

  @CreateDateColumn()
  createdAt!: Date;
}
