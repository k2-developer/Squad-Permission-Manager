import { Router, type Request, type Response, type NextFunction } from 'express';
import { WhitelistEntry } from '../models/WhitelistEntry.js';
import { Group } from '../models/Group.js';
import { Player } from '../models/Player.js';
import { Server } from '../models/Server.js';
import {
  authenticateApiKey,
  requireApiPermission,
  apiKeyOrgId,
} from '../middleware/apiKeyAuth.js';
import { validateBody } from '../middleware/validate.js';
import {
  isValidSteamId, isValidEosId, isValidObjectId, hasInjection, sanitizeString,
} from '../utils/validators.js';
import { badRequest, notFound } from '../utils/errors.js';
import { invalidateOutputCache } from '../services/whitelist.js';

/**
 * Public REST API authenticated by `Authorization: Bearer spm_...`.
 * All operations are automatically scoped to the org the API key belongs to,
 * regardless of any IDs in the request. The caller cannot escape that scope.
 *
 * Designed for: Discord bots, donation-platform webhooks (Boosty, Patreon,
 * Tebex), monitoring tools, custom integrations.
 */
const router = Router();

router.use(authenticateApiKey);

// ──────────────────────────────────────────────────────────────────────
// Groups & Servers — read-only lookups so a webhook knows what to write to.
// ──────────────────────────────────────────────────────────────────────

router.get('/groups', requireApiPermission('groups:read'), async (req, res, next) => {
  try {
    const groups = await Group.find({ orgId: apiKeyOrgId(req) })
      .select('_id name tag type permissions playerLimit requireApproval')
      .sort({ type: 1, name: 1 });
    res.json(groups);
  } catch (err) { next(err); }
});

router.get('/servers', requireApiPermission('servers:read'), async (req, res, next) => {
  try {
    const servers = await Server.find({ orgId: apiKeyOrgId(req) })
      .select('_id name address cacheTtl')
      .sort({ name: 1 });
    res.json(servers);
  } catch (err) { next(err); }
});

// ──────────────────────────────────────────────────────────────────────
// Players — search by steamId / eosId / discord username.
// ──────────────────────────────────────────────────────────────────────

router.get('/players/:steamOrEos', requireApiPermission('players:read'), async (req, res, next) => {
  try {
    const raw = req.params.steamOrEos;
    const id = typeof raw === 'string' ? raw : '';
    const player = isValidSteamId(id)
      ? await Player.findOne({ steamId64: id })
      : isValidEosId(id)
        ? await Player.findOne({ eosId: id })
        : null;
    if (!player) { next(notFound('Player not found')); return; }
    res.json(player);
  } catch (err) { next(err); }
});

// ──────────────────────────────────────────────────────────────────────
// Whitelist — read.
// ──────────────────────────────────────────────────────────────────────

router.get('/whitelist', requireApiPermission('whitelist:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = apiKeyOrgId(req);
    const filter: any = { orgId, approved: true };

    if (req.query.groupId) {
      if (!isValidObjectId(req.query.groupId)) { next(badRequest('Invalid groupId')); return; }
      // Ensure group belongs to this key's org before filtering by it.
      const group = await Group.findOne({ _id: req.query.groupId, orgId });
      if (!group) { next(notFound('Group not found')); return; }
      filter.groupId = req.query.groupId;
    }

    if (req.query.approved === 'false') filter.approved = false;
    if (req.query.approved === 'any') delete filter.approved;

    const entries = await WhitelistEntry.find(filter)
      .populate('playerId', 'username steamId64 eosId discordUserId')
      .populate('groupId', 'name tag type')
      .sort({ createdAt: -1 })
      .limit(1000);

    res.json(entries);
  } catch (err) { next(err); }
});

// ──────────────────────────────────────────────────────────────────────
// Whitelist — write. Add a player.
// ──────────────────────────────────────────────────────────────────────

router.post(
  '/whitelist',
  requireApiPermission('whitelist:write'),
  validateBody([
    { field: 'username', required: true, type: 'string', maxLength: 64 },
    { field: 'groupId', required: true, type: 'string' },
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = apiKeyOrgId(req);
      const { username, steamId64, eosId, groupId, durationHours, autoApprove } = req.body;

      if (steamId64 && !isValidSteamId(steamId64)) { next(badRequest('Invalid steamId64')); return; }
      if (eosId && !isValidEosId(eosId)) { next(badRequest('Invalid eosId')); return; }
      if (!steamId64 && !eosId) { next(badRequest('steamId64 or eosId required')); return; }
      if (hasInjection(username)) { next(badRequest('Invalid username')); return; }
      if (!isValidObjectId(groupId)) { next(badRequest('Invalid groupId')); return; }

      const group = await Group.findOne({ _id: groupId, orgId });
      if (!group) { next(notFound('Group not found')); return; }

      // The "approve" permission gates auto-approve. Without it the entry
      // lands in pending and needs panel review even if autoApprove was set.
      const apiKey = (req as any).apiKey;
      const canApprove = apiKey.permissions.includes('whitelist:approve');
      const wantApprove = autoApprove !== false && (!group.requireApproval || canApprove);

      const currentCount = await WhitelistEntry.countDocuments({ groupId, approved: true });
      if (wantApprove && currentCount >= group.playerLimit) {
        next(badRequest(`Group player limit (${group.playerLimit}) reached`));
        return;
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

      const expiresAt = durationHours && Number.isFinite(+durationHours)
        ? new Date(Date.now() + Math.max(0, +durationHours) * 3600000)
        : undefined;

      let entry;
      try {
        entry = await WhitelistEntry.create({
          orgId,
          playerId: player._id,
          groupId,
          approved: wantApprove,
          insertedBy: apiKey.createdBy,
          expiresAt,
        });
      } catch (e: any) {
        if (e?.code === 11000) {
          next(badRequest('Player already in this group'));
          return;
        }
        throw e;
      }

      // Post-insert re-check of playerLimit — same race-fix as the panel UI
      // route. Two concurrent POSTs could both pass the pre-check and
      // overflow the group; we roll back whichever insert is past the limit
      // (identified by `_id <= ours`).
      if (wantApprove) {
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
        invalidateOutputCache();
      }

      const populated = await WhitelistEntry.findById(entry._id)
        .populate('playerId', 'username steamId64 eosId')
        .populate('groupId', 'name tag type');
      res.status(201).json(populated);
    } catch (err) { next(err); }
  }
);

// ──────────────────────────────────────────────────────────────────────
// Whitelist — remove a player from a group (by player + group, or entry id).
// ──────────────────────────────────────────────────────────────────────

router.delete('/whitelist/:entryId', requireApiPermission('whitelist:write'), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.entryId)) { next(badRequest('Invalid entryId')); return; }
    // Scope check — entry must belong to this key's org.
    const entry = await WhitelistEntry.findOneAndDelete({
      _id: req.params.entryId,
      orgId: apiKeyOrgId(req),
    });
    if (!entry) { next(notFound('Entry not found')); return; }
    invalidateOutputCache();
    res.json({ message: 'Entry removed' });
  } catch (err) { next(err); }
});

router.delete(
  '/whitelist/by-player',
  requireApiPermission('whitelist:write'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { steamId64, eosId, groupId } = req.query;
      if (!groupId || !isValidObjectId(groupId)) {
        next(badRequest('groupId is required'));
        return;
      }
      const orgId = apiKeyOrgId(req);
      const group = await Group.findOne({ _id: groupId, orgId });
      if (!group) { next(notFound('Group not found')); return; }

      let player = null;
      if (typeof steamId64 === 'string' && isValidSteamId(steamId64)) {
        player = await Player.findOne({ steamId64 });
      } else if (typeof eosId === 'string' && isValidEosId(eosId)) {
        player = await Player.findOne({ eosId });
      } else {
        next(badRequest('valid steamId64 or eosId required'));
        return;
      }
      if (!player) { next(notFound('Player not found')); return; }

      const deleted = await WhitelistEntry.findOneAndDelete({
        playerId: player._id,
        groupId,
        orgId,
      });
      if (!deleted) { next(notFound('Entry not found')); return; }
      invalidateOutputCache();
      res.json({ message: 'Entry removed' });
    } catch (err) { next(err); }
  }
);

// ──────────────────────────────────────────────────────────────────────
// Whitelist — approve (separate scope; webhooks shouldn't auto-bypass review
// unless explicitly granted).
// ──────────────────────────────────────────────────────────────────────

router.post(
  '/whitelist/:entryId/approve',
  requireApiPermission('whitelist:approve'),
  async (req, res, next) => {
    try {
      if (!isValidObjectId(req.params.entryId)) { next(badRequest('Invalid entryId')); return; }
      const entry = await WhitelistEntry.findOneAndUpdate(
        { _id: req.params.entryId, orgId: apiKeyOrgId(req) },
        { approved: true },
        { new: true }
      );
      if (!entry) { next(notFound('Entry not found')); return; }
      invalidateOutputCache();
      res.json(entry);
    } catch (err) { next(err); }
  }
);

// Identity endpoint — for clients to verify their key works and discover scope.
router.get('/me', (req, res) => {
  const k = (req as any).apiKey;
  res.json({
    name: k.name,
    prefix: k.prefix,
    orgId: k.orgId,
    permissions: k.permissions,
    expiresAt: k.expiresAt,
    lastUsedAt: k.lastUsedAt,
  });
});

export default router;
