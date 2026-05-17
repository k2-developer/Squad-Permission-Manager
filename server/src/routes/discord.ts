import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roles.js';
import { getDiscordStatus, getDiscordGuilds, getDiscordChannels, getDiscordRoles } from '../services/discord.js';

const router = Router();

router.get('/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(getDiscordStatus());
  } catch (err) {
    next(err);
  }
});

router.get('/guilds', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(getDiscordGuilds());
  } catch (err) {
    next(err);
  }
});

router.get('/channels', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guildId = req.query.guildId as string;
    res.json(await getDiscordChannels(guildId));
  } catch (err) {
    next(err);
  }
});

router.get('/roles', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guildId = req.query.guildId as string;
    res.json(await getDiscordRoles(guildId));
  } catch (err) {
    next(err);
  }
});

export default router;
