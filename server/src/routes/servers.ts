import { Router, type Request, type Response, type NextFunction } from 'express';
import { Server } from '../models/Server.js';
import { Group } from '../models/Group.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { loadOrgForUser, loadServerForUser } from '../middleware/orgAuth.js';
import { sanitizeString, slugify } from '../utils/validators.js';
import { invalidateOutputCache } from '../services/whitelist.js';
import crypto from 'crypto';

const router = Router();

// List servers for an org — viewer+ membership in that org is required.
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await loadOrgForUser(
      req.query.orgId as string | undefined,
      req.user!.userId,
      req.user!.role,
      'viewer'
    );
    const servers = await Server.find({ orgId: req.query.orgId }).sort({ name: 1 });
    res.json(servers);
  } catch (err) {
    next(err);
  }
});

// Create server — org admin or owner in that org.
router.post(
  '/',
  authenticate,
  validateBody([
    { field: 'orgId', required: true, type: 'string' },
    { field: 'name', required: true, type: 'string', maxLength: 100 },
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orgId, name, address, slug } = req.body;
      await loadOrgForUser(orgId, req.user!.userId, req.user!.role, 'admin');

      const cleanName = sanitizeString(name);
      const cleanSlug = slugify(typeof slug === 'string' && slug ? slug : cleanName);

      const server = await Server.create({
        orgId,
        name: cleanName,
        address: address ? sanitizeString(address) : '',
        slug: cleanSlug,
      });

      res.status(201).json(server);
    } catch (err) {
      next(err);
    }
  }
);

// Update server — org admin or owner.
router.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { server } = await loadServerForUser(
      req.params.id,
      req.user!.userId,
      req.user!.role,
      'admin'
    );

    // Per-field handling — the previous loop trusted JS to coerce, which
    // meant a string '60' from the UI ended up in a `number` schema field.
    if (req.body.name !== undefined) server.name = sanitizeString(String(req.body.name));
    if (req.body.address !== undefined) server.address = sanitizeString(String(req.body.address));
    if (req.body.cacheTtl !== undefined) {
      const n = Number(req.body.cacheTtl);
      if (Number.isFinite(n)) server.cacheTtl = Math.max(0, Math.min(n, 86400));
    }
    if (req.body.preferEosId !== undefined) server.preferEosId = !!req.body.preferEosId;

    // Slug is cosmetic; pass-through `slugify` to enforce [a-z0-9-]/length.
    if (req.body.slug !== undefined) {
      server.slug = slugify(String(req.body.slug));
    }

    await server.save();
    res.json(server);
  } catch (err) {
    next(err);
  }
});

// Regenerate secret token — org admin or owner. Rotating someone else's token
// would silently break their live Squad server, so this is admin-only.
router.post('/:id/regenerate-token', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { server } = await loadServerForUser(
      req.params.id,
      req.user!.userId,
      req.user!.role,
      'admin'
    );
    server.secretToken = crypto.randomBytes(20).toString('hex');
    await server.save();
    invalidateOutputCache();
    res.json({ secretToken: server.secretToken });
  } catch (err) {
    next(err);
  }
});

// Delete server — org admin or owner.
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { server } = await loadServerForUser(
      req.params.id,
      req.user!.userId,
      req.user!.role,
      'admin'
    );
    // Pull this server's id from every group's `serverIds` so we don't leave
    // dangling references that the UI would silently ignore and the INI
    // builder would skip.
    await Group.updateMany(
      { orgId: server.orgId, serverIds: server._id },
      { $pull: { serverIds: server._id } }
    );
    await server.deleteOne();
    invalidateOutputCache();
    res.json({ message: 'Server deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
