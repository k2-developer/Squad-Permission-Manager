import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

const IS_PROD = process.env.NODE_ENV === 'production';

function env(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) throw new Error(`Missing required env variable: ${key}`);
  return val;
}

// Reject obviously-insecure placeholder values that have shipped as defaults
// in docker-compose snippets, sample .env files, tutorials, etc.
const BANNED_SECRET_FRAGMENTS = ['change-this', 'changeme', 'secret', 'password', 'default'];

function secretEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    if (IS_PROD) throw new Error(`CRITICAL: ${key} must be set in production`);
    return crypto.randomBytes(32).toString('hex');
  }
  if (val.length < 32) {
    throw new Error(`CRITICAL: ${key} must be at least 32 characters`);
  }
  const lower = val.toLowerCase();
  for (const bad of BANNED_SECRET_FRAGMENTS) {
    if (lower.includes(bad)) {
      throw new Error(
        `CRITICAL: ${key} contains banned placeholder "${bad}". Generate a real secret: openssl rand -hex 32`
      );
    }
  }
  return val;
}

// Opt-in escape hatch: lets small/internal deployments (LAN, raw-IP test
// installs, internal tooling) bypass the https-and-domain requirement.
// We still ban wildcards and refuse to run on localhost in production —
// those are programming errors, not deployment choices.
const ALLOW_INSECURE = process.env.ALLOW_INSECURE_HTTP === 'true';

function clientUrlEnv(): string {
  const val = process.env.CLIENT_URL ?? 'http://localhost:4000';
  if (IS_PROD) {
    if (val === '*' || val.includes('*')) {
      throw new Error('CRITICAL: CLIENT_URL must not be a wildcard in production');
    }
    if (ALLOW_INSECURE) {
      // Loud warning so admins don't accidentally leave this on for a real
      // deployment behind a public DNS name.
      console.warn('');
      console.warn('  ⚠️  ALLOW_INSECURE_HTTP=true — https and localhost guards are OFF.');
      console.warn('  ⚠️  Use ONLY for IP-based test installs or trusted LANs.');
      console.warn('  ⚠️  For public-facing deployments, point a domain at this host,');
      console.warn('  ⚠️  set up TLS, and remove ALLOW_INSECURE_HTTP from .env.');
      console.warn('');
      return val;
    }
    if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(val)) {
      throw new Error('CRITICAL: CLIENT_URL must not point to localhost in production');
    }
    if (!val.startsWith('https://')) {
      throw new Error('CRITICAL: CLIENT_URL must use https:// in production (or set ALLOW_INSECURE_HTTP=true for IP/LAN installs)');
    }
  }
  return val;
}

export const config = {
  port: parseInt(env('PORT', '4005'), 10),
  bindHost: env('BIND_HOST', '127.0.0.1'),
  mongoUri: env('MONGODB_URI', 'mongodb://localhost:27017/squad-pm'),
  jwt: {
    secret: secretEnv('JWT_SECRET'),
    refreshSecret: secretEnv('JWT_REFRESH_SECRET'),
    accessTtl: '15m',
    refreshTtl: '7d',
  },
  steam: {
    apiKey: env('STEAM_API_KEY', ''),
    realm: env('STEAM_REALM', 'http://localhost:4005'),
    returnUrl: env('STEAM_RETURN_URL', 'http://localhost:4005/api/auth/steam/callback'),
  },
  clientUrl: clientUrlEnv(),
  discord: {
    token: process.env.DISCORD_BOT_TOKEN || '',
    guildId: process.env.DISCORD_GUILD_ID || '',
    notificationChannelId: process.env.DISCORD_NOTIFICATION_CHANNEL_ID || '',
    // Discord role ID whose members are allowed to click approve/reject buttons.
    // If unset, Discord buttons are disabled — only the panel UI can review.
    approverRoleId: process.env.DISCORD_APPROVER_ROLE_ID || '',
  },
  devLoginEnabled: !IS_PROD && process.env.DEV_LOGIN_ENABLED === 'true',
} as const;
