import { Router, type Request, type Response, type NextFunction } from 'express';
import { WhitelistEntry } from '../models/WhitelistEntry.js';
import { Player } from '../models/Player.js';
import { Group } from '../models/Group.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  loadOrgForUser, loadEntryForUser, isClanManager, findManagedClans,
} from '../middleware/orgAuth.js';
import { isAdminTier } from '../middleware/roles.js';
import { badRequest, notFound, forbidden } from '../utils/errors.js';
import {
  isValidSteamId, isValidEosId, isValidObjectId, hasInjection, sanitizeString,
} from '../utils/validators.js';
import { invalidateOutputCache } from '../services/whitelist.js';
import { notifyWhitelistAction } from '../services/discord.js';

const router = Router();

/**
 * Scope-filter for clan-managers — a list of group _ids they manage.
 * For admin-tier (owner/admin) returns null (no filter applied).
 * For manager-role users with no managed clans, returns []  → empty result.
 */
async function scopeFilterForUser(orgId: string, steamId: string, role: string): Promise<string[] | null> {
  if (isAdminTier(role as any)) return null;
  const clans = await findManagedClans(orgId, steamId);
  return clans.map((c) => c._id.toString());
}

// List approved entries. Admin sees everything in org; manager sees only
// their managed clans.
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.query.orgId as string | undefined;
    const groupId = req.query.groupId as string | undefined;

    await loadOrgForUser(orgId, req.user!.userId, req.user!.role, 'viewer');

    const filter: any = { orgId, approved: true };

    const scoped = await scopeFilterForUser(orgId!, req.user!.steamId, req.user!.role);
    if (scoped !== null) {
      if (scoped.length === 0) { res.json([]); return; }
      filter.groupId = { $in: scoped };
    }

    if (groupId) {
      if (!isValidObjectId(groupId)) { next(badRequest('Invalid groupId')); return; }
      // Manager asked for a specific group — must be one they manage.
      if (scoped !== null && !scoped.includes(groupId)) {
        next(forbidden('Not your clan')); return;
      }
      filter.groupId = groupId;
    }

    const entries = await WhitelistEntry.find(filter)
      .populate('playerId', 'username steamId64 eosId discordUserId')
      // Nested populate: the entry shows which servers this group's whitelist
      // ends up on, so the frontend can render a "Servers" column without a
      // second round-trip.
      .populate({
        path: 'groupId',
        select: 'name tag type permissions serverScope serverIds',
        populate: { path: 'serverIds', select: 'name' },
      })
      .populate('insertedBy', 'displayName steamId')
      .sort({ createdAt: -1 });

    res.json(entries);
  } catch (err) {
    next(err);
  }
});

// List pending entries — same scope rules.
router.get('/pending', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.query.orgId as string | undefined;
    await loadOrgForUser(orgId, req.user!.userId, req.user!.role, 'viewer');

    const filter: any = { orgId, approved: false };
    const scoped = await scopeFilterForUser(orgId!, req.user!.steamId, req.user!.role);
    if (scoped !== null) {
      if (scoped.length === 0) { res.json([]); return; }
      filter.groupId = { $in: scoped };
    }

    const entries = await WhitelistEntry.find(filter)
      .populate('playerId', 'username steamId64 eosId')
      .populate('groupId', 'name tag type')
      .populate('insertedBy', 'displayName')
      .sort({ createdAt: -1 });

    res.json(entries);
  } catch (err) {
    next(err);
  }
});

// Add a player. Admin-tier — any group in the org. Clan-managers — only
// clans they manage, and only up to the clan's playerLimit.
router.post(
  '/',
  authenticate,
  validateBody([
    { field: 'username', required: true, type: 'string', maxLength: 64 },
    { field: 'orgId', required: true, type: 'string' },
    { field: 'groupId', required: true, type: 'string' },
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, steamId64, eosId, orgId, groupId, durationHours } = req.body;

      if (steamId64 && !isValidSteamId(steamId64)) { next(badRequest('Invalid Steam ID64')); return; }
      if (eosId && !isValidEosId(eosId)) { next(badRequest('Invalid EOS ID')); return; }
      if (!steamId64 && !eosId) { next(badRequest('steamId64 or eosId required')); return; }
      if (hasInjection(username)) { next(badRequest('Invalid username')); return; }
      if (!isValidObjectId(groupId)) { next(badRequest('Invalid groupId')); return; }

      await loadOrgForUser(orgId, req.user!.userId, req.user!.role, 'viewer');

      const group = await Group.findOne({ _id: groupId, orgId });
      if (!group) { next(notFound('Group not found')); return; }

      const adminTier = isAdminTier(req.user!.role as any);
      if (!adminTier) {
        // Manager-role users can only insert into clans they manage.
        if (!isClanManager(group, req.user!.steamId)) {
          next(forbidden('You can only add players to clans you manage'));
          return;
        }
      }

      const currentCount = await WhitelistEntry.countDocuments({ groupId, approved: true });
      if (currentCount >= group.playerLimit) {
        next(badRequest(`Group player limit (${group.playerLimit}) reached`)); return;
      }

      const playerFilter: any = {};
      if (steamId64) playerFilter.steamId64 = steamId64;
      else playerFilter.eosId = eosId;

      const player = await Player.findOneAndUpdate(
        playerFilter,
        {
          $set: {
            username: sanitizeString(username),
            ...(steamId64 && { steamId64 }),
            ...(eosId && { eosId }),
          },
        },
        { upsert: true, new: true }
      );

      const existing = await WhitelistEntry.findOne({ playerId: player._id, groupId });
      if (existing) { next(badRequest('Player already in this group')); return; }

      // Approval is gated by a single switch: `group.requireApproval`.
      // Both admins and clan-managers respect it identically — the group's
      // owner already decided whether their slots need a second pair of
      // eyes. Clan-managers can self-approve when their group allows it.
      const autoApprove = !group.requireApproval;

      const expiresAt = durationHours && Number.isFinite(+durationHours)
        ? new Date(Date.now() + Math.max(0, +durationHours) * 3600000)
        : undefined;

      let entry;
      try {
        entry = await WhitelistEntry.create({
          orgId,
          playerId: player._id,
          groupId,
          approved: autoApprove,
          insertedBy: req.user!.userId,
          expiresAt,
        });
      } catch (e: any) {
        // Unique index on (playerId, groupId) — a concurrent POST won the
        // race between our findOne and create. Return a clean 400 instead
        // of a 500.
        if (e?.code === 11000) {
          next(badRequest('Player already in this group'));
          return;
        }
        throw e;
      }

      // Post-insert re-check for playerLimit — closes the race between the
      // initial countDocuments and create() where two concurrent adds could
      // both pass the pre-check and overflow the group.
      // We use `_id: { $lte: entry._id }` so we identify OUR position in the
      // ordering — if we're past the limit, we're the overflow and roll
      // back. Earlier inserts stay.
      if (autoApprove) {
        const myPosition = await WhitelistEntry.countDocuments({
          groupId,
          approved: true,
          _id: { $lte: entry._id },
        });
        if (myPosition > group.playerLimit) {
          await entry.deleteOne();
          next(badRequest(`Group player limit (${group.playerLimit}) reached`));
          return;
        }
      }

      const populated = await WhitelistEntry.findById(entry._id)
        .populate('playerId', 'username steamId64 eosId')
        .populate('groupId', 'name tag type');

      if (autoApprove) invalidateOutputCache();

      if (!autoApprove) {
        notifyWhitelistAction('pending', {
          playerName: username,
          steamId64: steamId64 || '',
          groupName: group.name,
          clanName: group.tag || group.name,
          entryId: entry._id.toString(),
        });
      }

      res.status(201).json(populated);
    } catch (err) {
      next(err);
    }
  }
);

// Approve / reject / delete — entry must belong to a clan the user can act on.
router.patch('/:id/approve', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entry } = await loadEntryForUser(
      req.params.id,
      req.user!.userId,
      req.user!.steamId,
      req.user!.role,
      'moderator'
    );
    // Already-approved → idempotent no-op. Avoids double-toggling and a
    // pointless cache invalidate when two moderators click Approve at once.
    if (entry.approved) {
      const populated = await WhitelistEntry.findById(entry._id)
        .populate('playerId', 'username steamId64 eosId');
      res.json(populated);
      return;
    }
    // Re-check the player-limit at approval time — entries may have piled
    // up in pending while approved slots filled separately.
    const group = await Group.findById(entry.groupId).select('playerLimit');
    if (group) {
      const approvedCount = await WhitelistEntry.countDocuments({
        groupId: entry.groupId,
        approved: true,
      });
      if (approvedCount >= group.playerLimit) {
        next(badRequest(`Group player limit (${group.playerLimit}) reached`));
        return;
      }
    }
    entry.approved = true;
    await entry.save();
    const populated = await WhitelistEntry.findById(entry._id)
      .populate('playerId', 'username steamId64 eosId');
    invalidateOutputCache();
    res.json(populated);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/reject', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entry } = await loadEntryForUser(
      req.params.id,
      req.user!.userId,
      req.user!.steamId,
      req.user!.role,
      'moderator'
    );
    await entry.deleteOne();
    invalidateOutputCache();
    res.json({ message: 'Entry rejected' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entry } = await loadEntryForUser(
      req.params.id,
      req.user!.userId,
      req.user!.steamId,
      req.user!.role,
      'moderator'
    );
    await entry.deleteOne();
    invalidateOutputCache();
    res.json({ message: 'Entry removed' });
  } catch (err) {
    next(err);
  }
});

export default router;
