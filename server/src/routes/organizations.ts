import { Router, type Request, type Response, type NextFunction } from 'express';
import { Organization } from '../models/Organization.js';
import { Server } from '../models/Server.js';
import { Group } from '../models/Group.js';
import { WhitelistEntry } from '../models/WhitelistEntry.js';
import { User } from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { getOrgRole, hasOrgRole } from '../middleware/orgAuth.js';
import { badRequest, notFound, forbidden } from '../utils/errors.js';
import { sanitizeString, isValidObjectId } from '../utils/validators.js';

const router = Router();

function canManageOrg(org: any, userId: string, userRole: string): boolean {
  if (userRole === 'owner') return true;
  return hasOrgRole(org, userId, 'admin');
}

// Get all orgs the user belongs to
router.get('/mine', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgs = await Organization.find({
      $or: [
        { ownerId: req.user!.userId },
        { 'members.userId': req.user!.userId },
      ],
    })
      .populate('ownerId', 'displayName avatar steamId')
      .sort({ createdAt: -1 });

    // Attach server count + player count
    const result = await Promise.all(
      orgs.map(async (org) => {
        const [serverCount, playerCount] = await Promise.all([
          Server.countDocuments({ orgId: org._id }),
          WhitelistEntry.countDocuments({ orgId: org._id, approved: true }),
        ]);
        return { ...org.toObject(), serverCount, playerCount };
      })
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Create org
router.post(
  '/',
  authenticate,
  validateBody([
    { field: 'name', required: true, type: 'string', maxLength: 100 },
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = req.body;
      const org = await Organization.create({
        name: sanitizeString(name),
        ownerId: req.user!.userId,
        members: [{ userId: req.user!.userId, role: 'owner' }],
      });
      res.status(201).json(org);
    } catch (err) {
      next(err);
    }
  }
);

// Get single org (with servers, groups, stats)
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isValidObjectId(req.params.id)) { next(badRequest('Invalid org id')); return; }
    const org = await Organization.findById(req.params.id)
      .populate('ownerId', 'displayName avatar steamId')
      .populate('members.userId', 'displayName avatar steamId');
    if (!org) { next(notFound('Organization not found')); return; }

    // Verify access
    const role = getOrgRole(org, req.user!.userId);
    if (!role && req.user!.role !== 'owner') {
      next(forbidden('Not a member of this organization'));
      return;
    }

    const [servers, groups, entryCount, pendingCount] = await Promise.all([
      Server.find({ orgId: org._id }).sort({ name: 1 }),
      Group.find({ orgId: org._id }).sort({ type: 1, name: 1 }),
      WhitelistEntry.countDocuments({ orgId: org._id, approved: true }),
      WhitelistEntry.countDocuments({ orgId: org._id, approved: false }),
    ]);

    res.json({
      ...org.toObject(),
      servers,
      groups,
      entryCount,
      pendingCount,
      myRole: role || (req.user!.role === 'owner' ? 'owner' : null),
    });
  } catch (err) {
    next(err);
  }
});

// Update org
router.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isValidObjectId(req.params.id)) { next(badRequest('Invalid org id')); return; }
    const org = await Organization.findById(req.params.id);
    if (!org) { next(notFound('Organization not found')); return; }
    if (!canManageOrg(org, req.user!.userId, req.user!.role)) {
      next(forbidden('Not authorized')); return;
    }

    if (req.body.name) org.name = sanitizeString(req.body.name);
    await org.save();
    res.json(org);
  } catch (err) {
    next(err);
  }
});

// Add or update member. Only the org owner can grant the `admin` per-org role —
// regular org admins can grant/change moderator and viewer only.
router.post('/:id/members', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isValidObjectId(req.params.id)) { next(badRequest('Invalid org id')); return; }
    const org = await Organization.findById(req.params.id);
    if (!org) { next(notFound('Organization not found')); return; }
    if (!canManageOrg(org, req.user!.userId, req.user!.role)) {
      next(forbidden('Not authorized')); return;
    }

    const { userId, role } = req.body;
    if (!userId || typeof userId !== 'string' || !isValidObjectId(userId)) {
      next(badRequest('Valid userId required')); return;
    }
    if (!['admin', 'moderator', 'viewer'].includes(role)) {
      next(badRequest('Invalid role')); return;
    }

    // Only org owner (or system-root) can grant the admin per-org role.
    const callerOrgRole = getOrgRole(org, req.user!.userId);
    if (role === 'admin' && callerOrgRole !== 'owner' && req.user!.role !== 'owner') {
      next(forbidden('Only the owner can grant admin role')); return;
    }

    // Ensure the target user actually exists — prevents writing dangling ObjectIds.
    const target = await User.findById(userId).select('_id');
    if (!target) { next(notFound('User not found')); return; }

    if (userId === org.ownerId.toString()) {
      next(badRequest('Owner cannot be re-added as a member')); return;
    }

    const existing = org.members.find((m) => m.userId.toString() === userId);
    if (existing) {
      existing.role = role;
    } else {
      org.members.push({ userId, role } as any);
    }

    await org.save();
    res.json(org);
  } catch (err) {
    next(err);
  }
});

// Remove member
router.delete('/:id/members/:userId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.userId)) {
      next(badRequest('Invalid id')); return;
    }
    const org = await Organization.findById(req.params.id);
    if (!org) { next(notFound('Organization not found')); return; }
    if (!canManageOrg(org, req.user!.userId, req.user!.role)) {
      next(forbidden('Not authorized')); return;
    }
    if (req.params.userId === org.ownerId.toString()) {
      next(badRequest('Cannot remove the owner')); return;
    }

    org.members = org.members.filter((m) => m.userId.toString() !== req.params.userId) as any;
    await org.save();
    res.json(org);
  } catch (err) {
    next(err);
  }
});

// Delete org
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isValidObjectId(req.params.id)) { next(badRequest('Invalid org id')); return; }
    const org = await Organization.findById(req.params.id);
    if (!org) { next(notFound('Organization not found')); return; }
    if (org.ownerId.toString() !== req.user!.userId && req.user!.role !== 'owner') {
      next(forbidden('Only owner can delete organization')); return;
    }

    // Cascade delete
    await Promise.all([
      Server.deleteMany({ orgId: org._id }),
      Group.deleteMany({ orgId: org._id }),
      WhitelistEntry.deleteMany({ orgId: org._id }),
      Organization.findByIdAndDelete(org._id),
    ]);

    res.json({ message: 'Organization deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
