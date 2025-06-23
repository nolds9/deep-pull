import {
  Entity,
  PrimaryColumn,
  Column,
  OneToOne,
  JoinColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./User";

@Entity({ name: "user_stats" })
export class UserStats {
  @PrimaryColumn()
  user_id!: string;

  @OneToOne(() => User, (user) => user.stats)
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ default: 0 })
  single_player_high_score!: number;

  @Column({ default: 0 })
  multiplayer_wins!: number;

  @Column({ default: 0 })
  multiplayer_losses!: number;

  @UpdateDateColumn()
  updatedAt!: Date;
}
