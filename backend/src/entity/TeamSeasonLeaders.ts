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

  @Column({ type: "jsonb", nullable: true })
  passing_leader?: any;

  @Column({ type: "jsonb", nullable: true })
  rushing_leader?: any;

  @Column({ type: "jsonb", nullable: true })
  receiving_leaders?: any;

  @CreateDateColumn()
  createdAt!: Date;
}
