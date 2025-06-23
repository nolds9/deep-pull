import { Router, Request, Response, NextFunction } from "express";
import { AppDataSource } from "../config";
import { Player } from "../entity/Player";
import { requireAuth } from "../middleware/auth";

const router = Router();

// GET /api/players?search=jefferson
router.get(
  "/",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const search = req.query.search as string;
      const playerRepo = AppDataSource.getRepository(Player);
      let players;
      if (search) {
        players = await playerRepo
          .createQueryBuilder("player")
          .where("LOWER(player.name) LIKE :search", {
            search: `%${search.toLowerCase()}%`,
          })
          .limit(20)
          .getMany();
        console.log(
          `[API] Player search: '${search}' → ${players.length} results`
        );
      } else {
        players = await playerRepo.find({ take: 20 });
        console.log(`[API] Player list: ${players.length} results`);
      }
      res.json(players);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/players/:id
router.get(
  "/:id",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const playerRepo = AppDataSource.getRepository(Player);
      const player = await playerRepo.findOneBy({ id: req.params.id });
      if (!player) {
        res.status(404).json({ error: "Player not found" });
        return;
      }
      res.json(player);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/players/random
router.get(
  "/random",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const playerRepo = AppDataSource.getRepository(Player);
      const count = await playerRepo.count();
      const randomIndex = Math.floor(Math.random() * count);
      // findOne does not support skip, so use find with skip/limit
      const players = await playerRepo.find({ skip: randomIndex, take: 1 });
      const player = players[0];
      if (!player) {
        res.status(404).json({ error: "No players found" });
        return;
      }
      res.json(player);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
