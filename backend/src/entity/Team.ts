import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity({ name: "teams" })
export class Team {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  @Column({ type: "varchar", length: 3, nullable: true })
  abbreviation!: string;

  @Column({ nullable: true })
  division!: string;

  @Column({ nullable: true })
  conference!: string;
}
