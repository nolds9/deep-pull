import { Router, Request, Response, NextFunction } from "express";
import { AppDataSource } from "../config";
import { User } from "../entity/User";
import { UserStats } from "../entity/UserStats";
import { requireAuth } from "../middleware/auth";
import { getAuth, clerkClient } from "@clerk/express";

const router = Router();

const syncUserWithClerk = async (userId: string): Promise<User> => {
  // Fetch user data from Clerk
  const clerkUser = await clerkClient.users.getUser(userId);

  // Prepare user data from Clerk
  const name =
    clerkUser.firstName && clerkUser.lastName
      ? `${clerkUser.firstName} ${clerkUser.lastName}`
      : clerkUser.firstName || clerkUser.username || `User_${userId.slice(5)}`;

  const userData = {
    name: name,
    username: clerkUser.username,
    imageUrl: clerkUser.imageUrl,
  };

  // Use a transaction to ensure atomicity
  return AppDataSource.transaction(async (transactionalEntityManager) => {
    const userRepo = transactionalEntityManager.getRepository(User);
    const statsRepo = transactionalEntityManager.getRepository(UserStats);

    let user = await userRepo.findOneBy({ id: userId });

    if (user) {
      // Update existing user
      userRepo.merge(user, userData);
    } else {
      // Create new user if they don't exist
      user = userRepo.create({ id: userId, ...userData });
    }
    await userRepo.save(user);

    // Check for stats and create if they don't exist
    const stats = await statsRepo.findOneBy({ user_id: userId });
    if (!stats) {
      const newStats = statsRepo.create({ user_id: userId });
      await statsRepo.save(newStats);
    }

    // Return the complete user profile with stats
    return userRepo.findOneOrFail({
      where: { id: userId },
      relations: ["stats"],
    });
  });
};

// All routes here require authentication
router.use(requireAuth);

// GET /api/user/me - Get current user's profile and stats, syncing on first load.
router.get("/me", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await syncUserWithClerk(userId);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// POST /api/user/sync - Can be used for an explicit profile refresh.
router.post(
  "/sync",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const user = await syncUserWithClerk(userId);
      res.status(200).json(user);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
