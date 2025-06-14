import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity({ name: "player_connections" })
export class PlayerConnection {
  @PrimaryColumn()
  player1_id!: string;

  @PrimaryColumn()
  player2_id!: string;

  @PrimaryColumn()
  connection_type!: string;

  @Column({ type: "jsonb", nullable: true })
  metadata!: any;
}
