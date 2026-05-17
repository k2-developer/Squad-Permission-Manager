import { Router, type Request, type Response, type NextFunction } from 'express';
import { ApiKey, generateApiKey, API_PERMISSIONS, type ApiPermission } from '../models/ApiKey.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { loadOrgForUser } from '../middleware/orgAuth.js';
import { badRequest, notFound, forbidden } from '../utils/errors.js';
import { sanitizeString, isValidObjectId } from '../utils/validators.js';

const router = Router();

function validatePermissions(input: unknown): ApiPermission[] {
  if (!Array.isArray(input)) return [];
  const set = new Set<ApiPermission>();
  for (const p of input) {
    if (typeof p === 'string' && (API_PERMISSIONS as string[]).includes(p)) {
      set.add(p as ApiPermission);
    }
  }
  return [...set];
}

// List keys for an org. Never returns keyHash. Admin+ in org.
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const org = await loadOrgForUser(
      req.query.orgId,
      req.user!.userId,
      req.user!.role,
      'admin'
    );

    const keys = await ApiKey.find({ orgId: org._id })
      .select('-keyHash')
      .populate('createdBy', 'displayName')
      .sort({ createdAt: -1 });
    res.json(keys);
  } catch (err) {
    next(err);
  }
});

// Create key. Returns the raw key ONCE — caller MUST store it client-side.
// Admin+ in org.
router.post(
  '/',
  authenticate,
  validateBody([
    { field: 'orgId', required: true, type: 'string' },
    { field: 'name', required: true, type: 'string', maxLength: 100 },
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const org = await loadOrgForUser(
        req.body.orgId,
        req.user!.userId,
        req.user!.role,
        'admin'
      );

      const permissions = validatePermissions(req.body.permissions);
      if (permissions.length === 0) {
        next(badRequest('At least one permission is required'));
        return;
      }

      let expiresAt: Date | null = null;
      if (req.body.expiresInDays !== undefined && req.body.expiresInDays !== null) {
        const days = Number(req.body.expiresInDays);
        if (!Number.isFinite(days) || days < 1 || days > 3650) {
          next(badRequest('expiresInDays must be 1..3650'));
          return;
        }
        expiresAt = new Date(Date.now() + days * 86400000);
      }

      const { key, hash, prefix } = generateApiKey();

      const doc = await ApiKey.create({
        name: sanitizeString(req.body.name),
        keyHash: hash,
        prefix,
        orgId: org._id,
        permissions,
        createdBy: req.user!.userId,
        expiresAt,
      });

      // Critical: include `key` only here. Subsequent reads never expose it.
      res.status(201).json({
        _id: doc._id,
        name: doc.name,
        prefix: doc.prefix,
        permissions: doc.permissions,
        expiresAt: doc.expiresAt,
        createdAt: doc.createdAt,
        key,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Revoke key — soft-delete via revokedAt (audit trail). Admin+ in key's org.
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isValidObjectId(req.params.id)) { next(badRequest('Invalid id')); return; }
    const key = await ApiKey.findById(req.params.id);
    if (!key) { next(notFound('API key not found')); return; }

    await loadOrgForUser(
      key.orgId.toString(),
      req.user!.userId,
      req.user!.role,
      'admin'
    );

    key.revokedAt = new Date();
    await key.save();
    res.json({ message: 'API key revoked' });
  } catch (err) {
    next(err);
  }
});

// Permission list — what scopes are available to grant.
router.get('/permissions', authenticate, (_req: Request, res: Response) => {
  res.json(API_PERMISSIONS);
});

// Suppress unused-warning during refactors.
void forbidden;

export default router;
