import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity({ name: "player_connections" })
export class PlayerConnection {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  player1_id!: string;

  @Column()
  player2_id!: string;

  @Column()
  connection_type!: string;

  @Column({ type: "jsonb", nullable: true })
  metadata!: any;
}
