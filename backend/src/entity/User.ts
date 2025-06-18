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

  @Column()
  name!: string;

  @Column({ unique: true })
  username!: string;

  @Column()
  imageUrl!: string;

  @OneToOne(() => UserStats, (stats: UserStats) => stats.user)
  stats!: UserStats;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
