import { Router, Request, Response, NextFunction } from "express";
import { AppDataSource } from "../config";
import { User } from "../entity/User";
import { UserStats } from "../entity/UserStats";
import { requireAuth } from "../middleware/auth";
import { clerkClient } from "@clerk/clerk-sdk-node";

const router = Router();

// All routes here require authentication
router.use(requireAuth);

// GET /api/user/me - Get current user's profile and stats
router.get("/me", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: req.auth.userId },
      relations: ["stats"],
    });

    if (!user) {
      // If user not in our DB, sync them
      const clerkUser = await clerkClient.users.getUser(req.auth.userId);
      const newUser = userRepo.create({
        id: req.auth.userId,
        name: `${clerkUser.firstName} ${clerkUser.lastName}`.trim(),
        username: clerkUser.username!,
        imageUrl: clerkUser.imageUrl,
      });
      const user = await userRepo.save(newUser);
      const statsRepo = AppDataSource.getRepository(UserStats);
      const newStats = statsRepo.create({ user_id: user.id });
      await statsRepo.save(newStats);

      const freshUser = await userRepo.findOne({
        where: { id: user.id },
        relations: ["stats"],
      });
      return res.status(200).json(freshUser);
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
});

// POST /api/user/sync - This is now effectively handled by the GET /me endpoint on first login.
// We can keep it for explicit frontend calls if needed, or remove it.
// For now, I will simplify it and make it just an update operation.
router.post(
  "/sync",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userRepo = AppDataSource.getRepository(User);
      const clerkUser = await clerkClient.users.getUser(req.auth.userId);

      const user = await userRepo.findOneBy({ id: req.auth.userId });

      if (!user) {
        return res.status(404).json({
          error: "User not found for sync. Should be created on GET /me.",
        });
      }

      user.name = `${clerkUser.firstName} ${clerkUser.lastName}`.trim();
      user.username = clerkUser.username!;
      user.imageUrl = clerkUser.imageUrl;
      await userRepo.save(user);

      const freshUser = await userRepo.findOne({
        where: { id: user.id },
        relations: ["stats"],
      });

      res.status(200).json(freshUser);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
