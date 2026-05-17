import { Router, type Request, type Response, type NextFunction } from 'express';
import { User } from '../models/User.js';
import { Group } from '../models/Group.js';
import { authenticate } from '../middleware/auth.js';
import { requireOwner } from '../middleware/roles.js';
import { notFound, badRequest, forbidden } from '../utils/errors.js';
import { isValidObjectId } from '../utils/validators.js';

const router = Router();

// User management is owner-only. Promoting somebody to admin or owner is a
// privileged action that should never be delegated.
router.get('/', authenticate, requireOwner, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await User.find()
      .select('-refreshToken')
      .populate('clanId', 'name tag')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// Update user role — owner only. Cannot demote yourself or assign a role
// you don't have the right to grant.
router.patch(
  '/:id/role',
  authenticate,
  requireOwner,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isValidObjectId(req.params.id)) { next(badRequest('Invalid user id')); return; }
      const { role } = req.body;
      if (!['owner', 'admin', 'manager'].includes(role)) {
        next(badRequest('Invalid role')); return;
      }
      if (req.params.id === req.user!.userId) {
        next(badRequest('Cannot change your own role')); return;
      }

      const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true })
        .select('-refreshToken');
      if (!user) { next(notFound('User not found')); return; }
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);

// Assign user to clan — owner only. Verifies that the clan group actually exists
// and is of type 'clan' (preventing accidental writes of arbitrary group IDs).
router.patch(
  '/:id/clan',
  authenticate,
  requireOwner,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isValidObjectId(req.params.id)) { next(badRequest('Invalid user id')); return; }
      const { clanId } = req.body;

      let normalizedClanId: string | null = null;
      if (clanId !== null && clanId !== undefined && clanId !== '') {
        if (!isValidObjectId(clanId)) { next(badRequest('Invalid clanId')); return; }
        const clan = await Group.findOne({ _id: clanId, type: 'clan' });
        if (!clan) { next(notFound('Clan not found')); return; }
        normalizedClanId = clanId;
      }

      const user = await User.findByIdAndUpdate(
        req.params.id,
        { clanId: normalizedClanId },
        { new: true }
      ).select('-refreshToken');
      if (!user) { next(notFound('User not found')); return; }
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);

// Delete user — owner only.
router.delete(
  '/:id',
  authenticate,
  requireOwner,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isValidObjectId(req.params.id)) { next(badRequest('Invalid user id')); return; }
      if (req.params.id === req.user!.userId) {
        next(badRequest('Cannot delete yourself')); return;
      }
      const user = await User.findByIdAndDelete(req.params.id);
      if (!user) { next(notFound('User not found')); return; }
      res.json({ message: 'User deleted' });
    } catch (err) {
      next(err);
    }
  }
);

void forbidden; // reserved for future endpoints

export default router;
