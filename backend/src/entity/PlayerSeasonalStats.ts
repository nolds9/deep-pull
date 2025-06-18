import { Entity, PrimaryGeneratedColumn, Column, Index } from "typeorm";

@Entity({ name: "player_seasonal_stats" })
@Index(["player_id", "season"], { unique: true })
export class PlayerSeasonalStats {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  @Index()
  player_id!: string;

  @Column()
  season!: number;

  @Column({ type: "float", nullable: true })
  fantasy_points!: number;

  @Column({ type: "float", nullable: true })
  fantasy_points_ppr!: number;

  @Column({ type: "float", nullable: true })
  passing_yards!: number;

  @Column({ type: "float", nullable: true })
  passing_tds!: number;

  @Column({ type: "float", nullable: true })
  interceptions!: number;

  @Column({ type: "float", nullable: true })
  rushing_yards!: number;

  @Column({ type: "float", nullable: true })
  rushing_tds!: number;

  @Column({ type: "float", nullable: true })
  carries!: number;

  @Column({ type: "float", nullable: true })
  receiving_yards!: number;

  @Column({ type: "float", nullable: true })
  receiving_tds!: number;

  @Column({ type: "float", nullable: true })
  receptions!: number;

  @Column({ type: "float", nullable: true })
  targets!: number;
}
