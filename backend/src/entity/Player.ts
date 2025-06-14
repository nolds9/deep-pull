import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity({ name: "players" })
export class Player {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  position!: string;

  @Column({ nullable: true })
  college!: string;

  @Column({ type: "int", nullable: true })
  draft_year!: number;

  @Column("simple-array", { nullable: true })
  teams!: string[];

  @Column({ type: "int", nullable: true })
  first_season!: number;

  @Column({ type: "int", nullable: true })
  last_season!: number;
}
