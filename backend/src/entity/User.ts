import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from "typeorm";
import { UserStats } from "./UserStats";

@Entity({ name: "users" })
export class User {
  @PrimaryColumn()
  id!: string;

  @Column({ type: "varchar" })
  name!: string;

  @Column({ type: "varchar", unique: true, nullable: true })
  username!: string | null;

  @Column({ type: "text" })
  imageUrl!: string;

  @OneToOne(() => UserStats, (stats: UserStats) => stats.user)
  stats!: UserStats;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
