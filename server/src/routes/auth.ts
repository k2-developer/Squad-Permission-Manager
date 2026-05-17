import { Router, type Request, type Response, type NextFunction } from 'express';
import crypto from 'crypto';
import passport from 'passport';
import { Strategy as SteamStrategy } from 'passport-steam';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { Organization } from '../models/Organization.js';
import { Group } from '../models/Group.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  authenticate,
  setAuthCookies,
  clearAuthCookies,
  REVOKED_ERROR_CODE,
  type JwtPayload,
} from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { unauthorized } from '../utils/errors.js';

const router = Router();

// Hash refresh token before storing in DB
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Ensure there is exactly one organization in this single-tenant instance.
 * Creates "Default Org" on first call, owned by the first user. Idempotent.
 *
 * Newly registered Steam users get added to this org as members — they
 * still need a role bump (or to be added to a clan's managers list) to
 * actually do anything inside it.
 */
async function ensureDefaultOrg(ownerUserId: string): Promise<void> {
  const existing = await Organization.findOne({});
  if (existing) {
    const isMember = existing.ownerId.toString() === ownerUserId
      || existing.members.some((m) => m.userId.toString() === ownerUserId);
    if (!isMember) {
      existing.members.push({ userId: ownerUserId, role: 'viewer' } as any);
      await existing.save();
    }
    return;
  }
  await Organization.create({
    name: 'Default Org',
    ownerId: ownerUserId,
    members: [{ userId: ownerUserId, role: 'owner' }],
  });
}

// Setup passport-steam strategy
if (config.steam.apiKey) {
  passport.use(
    new SteamStrategy(
      {
        returnURL: config.steam.returnUrl,
        realm: config.steam.realm,
        apiKey: config.steam.apiKey,
      },
      (_identifier: string, profile: any, done: any) => {
        done(null, {
          steamId: profile.id,
          displayName: profile.displayName,
          avatar: profile.photos?.[2]?.value || profile.photos?.[0]?.value || '',
        });
      }
    )
  );
}

// Redirect to Steam login
router.get('/steam', authLimiter, passport.authenticate('steam', { session: false }));

// Steam callback — create/update user, set httpOnly cookies
router.get(
  '/steam/callback',
  passport.authenticate('steam', { session: false, failureRedirect: config.clientUrl }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const steamProfile = req.user as unknown as {
        steamId: string;
        displayName: string;
        avatar: string;
      };

      if (!steamProfile?.steamId) {
        res.redirect(`${config.clientUrl}/login?error=steam_failed`);
        return;
      }

      // Access policy:
      //   - The very first SteamID to ever log in becomes the owner (bootstrap).
      //   - Owners and admins (already-promoted users) can log in unconditionally.
      //   - Everyone else needs their SteamID listed in at least one clan's
      //     `managers` array. Otherwise the login is rejected.
      //   - If a previously-allowed manager is removed from every clan's
      //     managers list, their next login is also rejected (revoked).
      const existing = await User.findOne({ steamId: steamProfile.steamId });
      // "First user" really means "no owner exists yet" — not "no users
      // exist" (which would falsely trigger after every wipe-but-keep-clans
      // operation). Using `exists({role: 'owner'})` also lets us narrow the
      // race window: even if two parallel callbacks both see no owner, the
      // post-upsert reconciliation below catches it.
      const ownerExists = await User.exists({ role: 'owner' });
      const isFirstUser = !ownerExists;

      const isAdminTier = existing && (existing.role === 'owner' || existing.role === 'admin');
      const isClanLeader = await Group.exists({ type: 'clan', managers: steamProfile.steamId });

      if (!isFirstUser && !isAdminTier && !isClanLeader) {
        // No access. Bounce back to /login with a code the UI can localise.
        res.redirect(`${config.clientUrl}/login?error=not_invited`);
        return;
      }

      const user = await User.findOneAndUpdate(
        { steamId: steamProfile.steamId },
        {
          $set: {
            displayName: steamProfile.displayName,
            avatar: steamProfile.avatar,
            lastLogin: new Date(),
          },
          $setOnInsert: {
            steamId: steamProfile.steamId,
            role: isFirstUser ? 'owner' : 'manager',
          },
        },
        { upsert: true, new: true }
      );

      // Reconcile the rare race where two simultaneous first-time logins
      // both read `ownerExists === false` and both inserted as 'owner'. Keep
      // the earliest-created owner; demote anyone else to manager.
      if (user.role === 'owner') {
        const earliestOwner = await User.findOne({ role: 'owner' }).sort({ createdAt: 1 });
        if (earliestOwner && !earliestOwner._id.equals(user._id)) {
          user.role = 'manager';
          await user.save();
        }
      }

      // Ensure the single Default Org exists and the user is a member of it.
      await ensureDefaultOrg(user._id.toString());

      const tokenPayload: JwtPayload = {
        userId: user._id.toString(),
        steamId: user.steamId,
        role: user.role,
      };

      const accessToken = signAccessToken(tokenPayload);
      const refreshToken = signRefreshToken(tokenPayload);

      // Store HASHED refresh token in DB
      user.refreshToken = hashToken(refreshToken);
      await user.save();

      // Set httpOnly cookies — NEVER pass tokens in URL
      setAuthCookies(res, accessToken, refreshToken);
      res.redirect(`${config.clientUrl}/auth/callback`);
    } catch (err) {
      next(err);
    }
  }
);

// Refresh access token — rate limited
router.post('/refresh', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.spm_refresh;
    if (!refreshToken) {
      next(unauthorized('Refresh token required'));
      return;
    }

    const payload = verifyRefreshToken(refreshToken);

    // Verify hashed token matches stored one
    const user = await User.findById(payload.userId);
    const tokenHash = hashToken(refreshToken);
    if (!user || user.refreshToken !== tokenHash) {
      clearAuthCookies(res);
      next(unauthorized('Invalid refresh token'));
      return;
    }

    // Revoke check — same as authenticate(). Prevents issuing a fresh
    // access token to a user whose access was withdrawn between the access
    // expiring and the refresh firing.
    if (user.role === 'manager') {
      const stillManager = await Group.exists({ type: 'clan', managers: user.steamId });
      if (!stillManager) {
        user.refreshToken = null;
        await user.save();
        clearAuthCookies(res);
        next(unauthorized('Access revoked', REVOKED_ERROR_CODE));
        return;
      }
    }

    const newPayload: JwtPayload = {
      userId: user._id.toString(),
      steamId: user.steamId,
      role: user.role,
    };

    const newAccessToken = signAccessToken(newPayload);
    const newRefreshToken = signRefreshToken(newPayload);

    // Rotate: hash and store new refresh token, invalidating old one
    user.refreshToken = hashToken(newRefreshToken);
    await user.save();

    setAuthCookies(res, newAccessToken, newRefreshToken);
    res.json({ ok: true });
  } catch {
    clearAuthCookies(res);
    next(unauthorized('Invalid refresh token'));
  }
});

// Get current user profile
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.user!.userId)
      .select('-refreshToken')
      .populate('clanId', 'name tag');
    if (!user) {
      next(unauthorized('User not found'));
      return;
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// Logout — clear refresh token + cookies
router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await User.findByIdAndUpdate(req.user!.userId, { refreshToken: null });
    clearAuthCookies(res);
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// DEV-ONLY: instant login without Steam.
// Requires BOTH `NODE_ENV !== 'production'` AND explicit `DEV_LOGIN_ENABLED=true`.
// Additionally refuses requests unless the server is bound to loopback
// AND the request itself arrives from loopback, so a misconfigured exposure
// (e.g. NODE_ENV unset on a public-facing host) cannot grant root.
// ──────────────────────────────────────────────
if (config.devLoginEnabled) {
  const isLoopbackHost = config.bindHost === '127.0.0.1' || config.bindHost === '::1';

  router.post('/dev-login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isLoopbackHost) {
        next(unauthorized('dev-login disabled (server not on loopback)'));
        return;
      }
      // Use the actual TCP source, NOT req.ip — with `trust proxy: 1` set
      // for legitimate reverse-proxy use, req.ip honours X-Forwarded-For
      // and is spoofable by anyone sitting between client and server.
      const peer = req.socket?.remoteAddress || '';
      if (peer !== '127.0.0.1' && peer !== '::1' && peer !== '::ffff:127.0.0.1') {
        next(unauthorized('dev-login only available from loopback'));
        return;
      }
      const userCount = await User.countDocuments();
      const isFirst = userCount === 0;

      // Dev-login synthetic user always acts as owner — this endpoint is
      // already gated by DEV_LOGIN_ENABLED + loopback, so granting full
      // access is the expected behaviour for local development.
      const user = await User.findOneAndUpdate(
        { steamId: '00000000000000000' },
        {
          $set: {
            displayName: 'Dev User',
            avatar: '',
            lastLogin: new Date(),
            role: 'owner',
          },
          $setOnInsert: {
            steamId: '00000000000000000',
          },
        },
        { upsert: true, new: true }
      );
      void isFirst;

      await ensureDefaultOrg(user._id.toString());

      const payload: JwtPayload = {
        userId: user._id.toString(),
        steamId: user.steamId,
        role: user.role,
      };

      const accessToken = signAccessToken(payload);
      const refreshToken = signRefreshToken(payload);

      user.refreshToken = hashToken(refreshToken);
      await user.save();

      setAuthCookies(res, accessToken, refreshToken);
      res.json({ ok: true, role: user.role });
    } catch (err) {
      next(err);
    }
  });

  // Expose dev mode flag (loopback only — same X-Forwarded-For
  // spoofing-safe check as dev-login itself).
  router.get('/dev-mode', (req: Request, res: Response) => {
    const peer = req.socket?.remoteAddress || '';
    if (peer !== '127.0.0.1' && peer !== '::1' && peer !== '::ffff:127.0.0.1') {
      res.json({ devMode: false });
      return;
    }
    res.json({ devMode: true });
  });
}

export default router;
