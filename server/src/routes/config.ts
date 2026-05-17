import { Router, type Request, type Response, type NextFunction } from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { authenticate } from '../middleware/auth.js';
import { loadOrgForUser } from '../middleware/orgAuth.js';
import { Server } from '../models/Server.js';
import { Group } from '../models/Group.js';
import { WhitelistEntry } from '../models/WhitelistEntry.js';
import { badRequest } from '../utils/errors.js';

const router = Router();

// Single source of truth for the displayed version — read once at startup
// from server/package.json. Avoids the previous setup where '1.0.0' was
// hardcoded in two places and drifted from the real package.json on bumps.
function readPackageVersion(): string {
  try {
    // In dev (tsx): __filename → server/src/routes/config.ts → walk up to server/.
    // In docker (compiled): /app/dist/routes/config.js → walk up to /app/.
    const here = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      join(here, '..', '..', 'package.json'),    // dev
      join(here, '..', 'package.json'),          // compiled (one fewer hop)
    ];
    for (const p of candidates) {
      try {
        const pkg = JSON.parse(readFileSync(p, 'utf8'));
        if (typeof pkg.version === 'string') return pkg.version;
      } catch { /* try next */ }
    }
  } catch { /* fall through */ }
  return '0.0.0';
}

const APP_VERSION = readPackageVersion();
export { APP_VERSION };

// Per-org dashboard stats. orgId is required and the caller must be a member.
router.get('/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.query.orgId as string | undefined;
    if (!orgId) { next(badRequest('orgId required')); return; }

    await loadOrgForUser(orgId, req.user!.userId, req.user!.role, 'viewer');

    const [serverCount, groupCount, entryCount, pendingCount] = await Promise.all([
      Server.countDocuments({ orgId }),
      Group.countDocuments({ orgId }),
      WhitelistEntry.countDocuments({ orgId, approved: true }),
      WhitelistEntry.countDocuments({ orgId, approved: false }),
    ]);

    res.json({ serverCount, groupCount, entryCount, pendingCount });
  } catch (err) {
    next(err);
  }
});

router.get('/info', (_req: Request, res: Response) => {
  res.json({ name: 'SquadPermissionManager', version: APP_VERSION });
});

export default router;
