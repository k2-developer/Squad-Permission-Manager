import { Schema, model, type Document, type Types } from 'mongoose';
import crypto from 'crypto';

export type ApiPermission =
  | 'whitelist:read'
  | 'whitelist:write'
  | 'whitelist:approve'
  | 'players:read'
  | 'groups:read'
  | 'servers:read';

export const API_PERMISSIONS: ApiPermission[] = [
  'whitelist:read',
  'whitelist:write',
  'whitelist:approve',
  'players:read',
  'groups:read',
  'servers:read',
];

export interface IApiKey extends Document {
  _id: Types.ObjectId;
  /** Human-readable label for this key. */
  name: string;
  /** sha256(rawKey) — the raw key is shown to the user exactly once at creation. */
  keyHash: string;
  /** First 10 chars of the raw key, for UI display ("spm_abc123…"). Never sensitive. */
  prefix: string;
  /** Scopes the key. ALL panel API actions performed with this key are scoped to this org. */
  orgId: Types.ObjectId;
  /** What the key is allowed to do. Empty = nothing. */
  permissions: ApiPermission[];
  /** User who created the key (for audit). */
  createdBy: Types.ObjectId;
  /** Updated on each successful request — for the UI "Last used" column. */
  lastUsedAt: Date | null;
  /** If set, the key is rejected after this date. */
  expiresAt: Date | null;
  /** If true, the key is hard-disabled regardless of expiresAt. */
  revokedAt: Date | null;
  createdAt: Date;
}

const apiKeySchema = new Schema<IApiKey>({
  name: { type: String, required: true, maxlength: 100 },
  keyHash: { type: String, required: true, unique: true, index: true },
  prefix: { type: String, required: true },
  orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  permissions: [{
    type: String,
    enum: API_PERMISSIONS,
  }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  lastUsedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

/**
 * Generate a new API key. Returns the raw key (shown to the user exactly once)
 * along with the values to persist. We use 32 random bytes (256 bits) of entropy,
 * which makes brute-forcing the hash infeasible. The prefix is a non-sensitive
 * identifier so the UI can show "spm_a1b2c3d4…" without storing the raw key.
 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const random = crypto.randomBytes(32).toString('base64url');
  const key = `spm_${random}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const prefix = key.slice(0, 10);
  return { key, hash, prefix };
}

export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

export const ApiKey = model<IApiKey>('ApiKey', apiKeySchema);
