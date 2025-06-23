import "reflect-metadata";
import { DataSource } from "typeorm";
import { Player } from "./entity/Player";
import { PlayerConnection } from "./entity/PlayerConnection";
import { PlayerSeasonalStats } from "./entity/PlayerSeasonalStats";
import { User } from "./entity/User";
import { UserStats } from "./entity/UserStats";
import * as dotenv from "dotenv";

dotenv.config();

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [Player, PlayerConnection, PlayerSeasonalStats, User, UserStats],
  synchronize: false, // Set to false for production, true for dev only if needed
  logging: true,
});
