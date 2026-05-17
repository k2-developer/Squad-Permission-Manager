import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import path from 'path';
import fs from 'fs';
import { config } from './config.js';
import { connectDatabase } from './db.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { sanitizeInput } from './middleware/sanitize.js';
import { AppError } from './utils/errors.js';

// Routes
import authRoutes from './routes/auth.js';
import orgRoutes from './routes/organizations.js';
import serverRoutes from './routes/servers.js';
import groupRoutes from './routes/groups.js';
import whitelistRoutes from './routes/whitelist.js';
import userRoutes from './routes/users.js';
import outputRoutes from './routes/output.js';
import discordRoutes from './routes/discord.js';
import configRoutes, { APP_VERSION } from './routes/config.js';
import clanRoutes from './routes/clans.js';
import apiKeyRoutes from './routes/apiKeys.js';
import publicApiRoutes from './routes/publicApi.js';

// Services
import { initDiscordBot } from './services/discord.js';
import { startScheduler } from './services/scheduler.js';

const app = express();

app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https://avatars.steamstatic.com', 'https://avatars.akamai.steamstatic.com'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: config.clientUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(sanitizeInput);
app.use(passport.initialize());
app.use(globalLimiter);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/orgs', orgRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/whitelist', whitelistRoutes);
app.use('/api/users', userRoutes);
app.use('/api/discord', discordRoutes);
app.use('/api/config', configRoutes);
app.use('/api/clans', clanRoutes);
app.use('/api/api-keys', apiKeyRoutes);

// Public REST API for external integrations (Discord bots, donation webhooks,
// monitoring). Authenticated via `Authorization: Bearer spm_...`. Mounted on
// /v1 so future contract changes can ship as /v2 without breaking clients.
app.use('/v1', publicApiRoutes);

// Squad server whitelist output
app.use('/output', outputRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: APP_VERSION });
});

// Serve the built SPA when present (Dockerfile copies client/dist → ./public).
// In dev, Vite serves the SPA on its own port, so this block is a no-op when
// the public/ directory doesn't exist.
const publicDir = path.resolve(process.cwd(), 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, { index: false, maxAge: '1h' }));
  // SPA history fallback — anything not matched by /api, /v1, /output, a
  // static asset, or a well-known path falls through to index.html so
  // client-side routing works on direct URL hits / refreshes.
  // The `.well-known` exclusion keeps certbot HTTP-01 challenges and other
  // well-known endpoints from being intercepted if they ever land here.
  app.get(/^\/(?!api(?:\/|$)|v1(?:\/|$)|output(?:\/|$)|\.well-known\/).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

// Error handler
app.use(
  (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof AppError) {
      const body: { error: string; code?: string } = { error: err.message };
      if (err.code) body.code = err.code;
      res.status(err.statusCode).json(body);
      return;
    }
    if (process.env.NODE_ENV !== 'production') {
      console.error('[Server] Error:', err);
    } else {
      console.error('[Server] Error:', err.message);
    }
    res.status(500).json({ error: 'Internal server error' });
  }
);

async function bootstrap() {
  await connectDatabase();

  if (config.discord.token) {
    await initDiscordBot();
  }

  startScheduler();

  const host = config.bindHost;
  app.listen(config.port, host, () => {
    console.log(`[Server] SquadPermissionManager running on ${host}:${config.port}`);
  });
}

bootstrap().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});
