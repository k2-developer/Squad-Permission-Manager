import { Router, type Request, type Response, type NextFunction } from 'express';
import { generateWhitelistIniByToken } from '../services/whitelist.js';
import { outputLimiter } from '../middleware/rateLimit.js';
import { notFound } from '../utils/errors.js';

const router = Router();

router.use(outputLimiter);

async function serveByToken(token: string, res: Response, next: NextFunction): Promise<void> {
  if (!/^[0-9a-f]{40}$/i.test(token)) {
    next(notFound('Not found'));
    return;
  }
  // Tokens in DB are always lowercase hex (crypto.randomBytes(...).toString('hex'))
  // — accept any case in the URL but match case-sensitive against storage,
  // otherwise an admin typing TOKEN in uppercase silently 404s.
  const ini = await generateWhitelistIniByToken(token.toLowerCase());
  if (ini === null) {
    next(notFound('Not found'));
    return;
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(ini);
}

/**
 * Squad server pulls this endpoint via RemoteAdminListHosts.cfg.
 *
 * Two URL shapes are accepted (both equivalent):
 *   http://your-panel.com/output/<40-hex-token>
 *   http://your-panel.com/output/<slug>/<40-hex-token>
 *
 * The slug is purely cosmetic (readable in configs/logs); auth is 100% the
 * secret token. A wrong/missing slug with the right token still serves —
 * collisions on slug don't matter and we don't enforce uniqueness.
 *
 * The INI includes all groups that have serverScope="all" or include this
 * server in serverIds.
 */
// Two-segment form wins when both segments are present. Express picks the
// first matching route, so /:slug/:token must be declared first.
router.get('/:slug/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await serveByToken(req.params.token as string, res, next);
  } catch (err) {
    next(err);
  }
});

router.get('/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // A bare slug (no token after it) cannot authenticate — bail early so we
    // don't log it as a missing-token attempt and to keep behaviour
    // unambiguous with the two-segment form above.
    const tok = req.params.token as string;
    if (!/^[0-9a-f]{40}$/i.test(tok)) {
      next(notFound('Not found'));
      return;
    }
    await serveByToken(tok, res, next);
  } catch (err) {
    next(err);
  }
});

export default router;
