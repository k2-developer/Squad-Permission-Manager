import { Router, type Request, type Response, type NextFunction } from 'express';
import { Group } from '../models/Group.js';
import { WhitelistEntry } from '../models/WhitelistEntry.js';
import { User } from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { loadOrgForUser, loadGroupForUser } from '../middleware/orgAuth.js';
import { badRequest, notFound } from '../utils/errors.js';
import { sanitizeString, isValidSteamId } from '../utils/validators.js';
import { invalidateOutputCache } from '../services/whitelist.js';

/**
 * Internal-only CRUD for clan-type groups. Clans are private to the org —
 * no public pages, no application forms, no code-based sharing. The route
 * is a thin facade over Group filtered by type:'clan', so the Clans page
 * stays a first-class UX concept while the data model remains unified.
 *
 * Authorization is the same as Groups: admin/owner of the org for write,
 * any member for read.
 */

const router = Router();

/** Accept an array of SteamID64 strings, drop anything not matching the format. */
function sanitizeManagerSteamIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const v of input) {
    if (typeof v === 'string' && isValidSteamId(v) && !out.includes(v)) {
      out.push(v);
    }
    if (out.length >= 100) break;
  }
  return out;
}

/** Resolve SteamIDs to {steamId, displayName, avatar} where possible. */
async function resolveManagers(steamIds: string[]) {
  if (!steamIds.length) return [];
  const users = await User.find({ steamId: { $in: steamIds } }).select('steamId displayName avatar');
  const byId = new Map(users.map((u) => [u.steamId, u]));
  return steamIds.map((sid) => {
    const u = byId.get(sid);
    return {
      steamId: sid,
      displayName: u?.displayName ?? null,
      avatar: u?.avatar ?? '',
      registered: !!u,
    };
  });
}

async function projectClan(group: any) {
  const [playerCount, managers] = await Promise.all([
    WhitelistEntry.countDocuments({ groupId: group._id, approved: true }),
    resolveManagers(group.managers ?? []),
  ]);
  const obj = group.toObject();
  return { ...obj, playerCount, managers };
}

// List clans in an org — viewer+ membership.
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await loadOrgForUser(
      req.query.orgId,
      req.user!.userId,
      req.user!.role,
      'viewer'
    );
    const clans = await Group.find({ orgId: req.query.orgId, type: 'clan' })
      .populate('serverIds', 'name')
      .sort({ name: 1 });
    res.json(await Promise.all(clans.map(projectClan)));
  } catch (err) {
    next(err);
  }
});

// Create clan — admin+.
router.post(
  '/',
  authenticate,
  validateBody([
    { field: 'orgId', required: true, type: 'string' },
    { field: 'name', required: true, type: 'string', maxLength: 64 },
    { field: 'tag', required: true, type: 'string', maxLength: 10 },
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orgId, name, tag, playerLimit, requireApproval, managers, permissions } = req.body;
      await loadOrgForUser(orgId, req.user!.userId, req.user!.role, 'admin');

      const clan = await Group.create({
        orgId,
        type: 'clan',
        name: sanitizeString(name),
        tag: sanitizeString(tag).slice(0, 10),
        permissions: Array.isArray(permissions)
          ? permissions.filter((p: unknown): p is string => typeof p === 'string').slice(0, 32)
          : [],
        serverScope: 'all',
        playerLimit: Number.isFinite(+playerLimit) ? Math.max(1, Math.min(+playerLimit, 100000)) : 50,
        requireApproval: !!requireApproval,
        managers: sanitizeManagerSteamIds(managers),
      });

      res.status(201).json(await projectClan(clan));
    } catch (err) {
      next(err);
    }
  }
);

// Update clan — admin+ in clan's org.
router.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { group } = await loadGroupForUser(
      req.params.id,
      req.user!.userId,
      req.user!.steamId,
      req.user!.role,
      'admin'
    );
    if (group.type !== 'clan') { next(badRequest('Not a clan')); return; }

    const body = req.body ?? {};
    if (body.name !== undefined) group.name = sanitizeString(body.name);
    if (body.tag !== undefined) group.tag = sanitizeString(body.tag).slice(0, 10);
    if (body.playerLimit !== undefined && Number.isFinite(+body.playerLimit)) {
      group.playerLimit = Math.max(1, Math.min(+body.playerLimit, 100000));
    }
    if (body.requireApproval !== undefined) group.requireApproval = !!body.requireApproval;
    if (body.managers !== undefined) group.managers = sanitizeManagerSteamIds(body.managers);
    if (body.serverScope === 'all' || body.serverScope === 'selected') {
      group.serverScope = body.serverScope;
    }
    if (body.serverIds !== undefined && Array.isArray(body.serverIds)) {
      group.serverIds = body.serverIds
        .filter((id: unknown) => typeof id === 'string' && /^[0-9a-f]{24}$/i.test(id))
        .slice(0, 100) as any;
    }
    if (body.permissions !== undefined && Array.isArray(body.permissions)) {
      group.permissions = body.permissions
        .filter((p: unknown): p is string => typeof p === 'string')
        .slice(0, 32);
    }

    await group.save();
    invalidateOutputCache();
    res.json(await projectClan(group));
  } catch (err) {
    next(err);
  }
});

// Delete clan — admin+. Cascades to whitelist entries.
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { group } = await loadGroupForUser(
      req.params.id,
      req.user!.userId,
      req.user!.steamId,
      req.user!.role,
      'admin'
    );
    if (group.type !== 'clan') { next(badRequest('Not a clan')); return; }

    await Promise.all([
      WhitelistEntry.deleteMany({ groupId: group._id }),
      group.deleteOne(),
    ]);
    invalidateOutputCache();
    res.json({ message: 'Clan deleted' });
  } catch (err) {
    next(err);
  }
});

void notFound; // exported for future endpoints; suppress unused warning.

export default router;
