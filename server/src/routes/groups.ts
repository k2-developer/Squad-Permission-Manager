import { Router, type Request, type Response, type NextFunction } from 'express';
import { Group } from '../models/Group.js';
import { WhitelistEntry } from '../models/WhitelistEntry.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { loadOrgForUser, loadGroupForUser } from '../middleware/orgAuth.js';
import { badRequest } from '../utils/errors.js';
import { sanitizeString, isValidObjectId, isValidSteamId } from '../utils/validators.js';
import { invalidateOutputCache } from '../services/whitelist.js';

const router = Router();

const GROUP_TYPES = new Set(['clan', 'vip', 'admin', 'custom']);
const SCOPES = new Set(['all', 'selected']);

/** Permissions list bounded to 32 well-formed items. */
function sanitizePermissions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((p): p is string => typeof p === 'string')
    .slice(0, 32)
    .map((p) => p.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32))
    .filter((p) => p.length > 0);
}

function sanitizeServerIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter(isValidObjectId).slice(0, 100);
}

/** Accept SteamID64 strings, drop dupes/non-conforming. */
function sanitizeManagerSteamIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const v of input) {
    if (typeof v === 'string' && isValidSteamId(v) && !out.includes(v)) out.push(v);
    if (out.length >= 100) break;
  }
  return out;
}

// List groups in an org — viewer+ membership required.
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await loadOrgForUser(
      req.query.orgId as string | undefined,
      req.user!.userId,
      req.user!.role,
      'viewer'
    );

    const groups = await Group.find({ orgId: req.query.orgId })
      // managers is now an array of SteamIDs (strings); no populate needed.
      .populate('serverIds', 'name')
      .sort({ type: 1, name: 1 });

    // One aggregate over the entries collection instead of N countDocuments —
    // the previous code did one round-trip per group, which scales badly.
    const groupIds = groups.map((g) => g._id);
    const counts = await WhitelistEntry.aggregate([
      { $match: { groupId: { $in: groupIds }, approved: true } },
      { $group: { _id: '$groupId', n: { $sum: 1 } } },
    ]);
    const countByGroup = new Map<string, number>(
      counts.map((c: any) => [String(c._id), c.n])
    );

    const result = groups.map((g) => ({
      ...g.toObject(),
      playerCount: countByGroup.get(String(g._id)) ?? 0,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Create group — admin+ in target org.
router.post(
  '/',
  authenticate,
  validateBody([
    { field: 'orgId', required: true, type: 'string' },
    { field: 'name', required: true, type: 'string', maxLength: 64 },
    { field: 'type', required: true, type: 'string' },
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        orgId, name, tag, type, permissions, serverScope, serverIds,
        playerLimit, requireApproval,
      } = req.body;

      if (!GROUP_TYPES.has(type)) {
        next(badRequest('Invalid group type'));
        return;
      }
      if (serverScope !== undefined && !SCOPES.has(serverScope)) {
        next(badRequest('Invalid serverScope'));
        return;
      }

      await loadOrgForUser(orgId, req.user!.userId, req.user!.role, 'admin');

      const group = await Group.create({
        orgId,
        name: sanitizeString(name),
        tag: tag ? sanitizeString(tag).slice(0, 10) : '',
        type,
        permissions: sanitizePermissions(permissions),
        serverScope: serverScope || 'all',
        serverIds: sanitizeServerIds(serverIds),
        playerLimit: Number.isFinite(+playerLimit) ? Math.max(0, Math.min(+playerLimit, 100000)) : 50,
        requireApproval: !!requireApproval,
      });

      res.status(201).json(group);
    } catch (err) {
      next(err);
    }
  }
);

// Update group — admin+ in the group's org.
router.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { group } = await loadGroupForUser(
      req.params.id,
      req.user!.userId,
      req.user!.steamId,
      req.user!.role,
      'admin'
    );

    const body = req.body ?? {};

    if (body.name !== undefined) group.name = sanitizeString(body.name);
    if (body.tag !== undefined) group.tag = sanitizeString(body.tag).slice(0, 10);
    if (body.permissions !== undefined) group.permissions = sanitizePermissions(body.permissions);
    if (body.serverScope !== undefined) {
      if (!SCOPES.has(body.serverScope)) { next(badRequest('Invalid serverScope')); return; }
      group.serverScope = body.serverScope;
    }
    if (body.serverIds !== undefined) group.serverIds = sanitizeServerIds(body.serverIds) as any;
    if (body.playerLimit !== undefined && Number.isFinite(+body.playerLimit)) {
      group.playerLimit = Math.max(0, Math.min(+body.playerLimit, 100000));
    }
    if (body.requireApproval !== undefined) group.requireApproval = !!body.requireApproval;
    if (body.managers !== undefined) group.managers = sanitizeManagerSteamIds(body.managers);

    await group.save();
    invalidateOutputCache();
    res.json(group);
  } catch (err) {
    next(err);
  }
});

// Delete group — admin+ in the group's org. Cascades to whitelist entries.
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { group } = await loadGroupForUser(
      req.params.id,
      req.user!.userId,
      req.user!.steamId,
      req.user!.role,
      'admin'
    );
    await Promise.all([
      WhitelistEntry.deleteMany({ groupId: group._id }),
      group.deleteOne(),
    ]);
    invalidateOutputCache();
    res.json({ message: 'Group deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
