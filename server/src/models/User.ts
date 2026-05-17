import { Schema, model, type Document, type Types } from 'mongoose';

/**
 * System-wide roles. There are intentionally only three values:
 *
 *   - `owner`   — the head administrator. There is one per instance,
 *                 created on the first Steam login (or first dev-login).
 *                 Can do everything, including promoting other users to
 *                 admin or owner.
 *   - `admin`   — assistant administrator. Can manage servers, clans,
 *                 groups, whitelist, API keys, and Discord integration
 *                 in any org they belong to. Cannot promote users.
 *   - `manager` — no system access on its own. Used as the default role
 *                 for newly-registered users so they can't see anything
 *                 until added to a clan's `managers` list. A user with
 *                 role `manager` who appears in `Group.managers` for
 *                 some clan-type group becomes a "clan leader" for that
 *                 clan — they can add/remove/approve players in that
 *                 clan up to its playerLimit, and nothing else.
 */
export type UserRole = 'owner' | 'admin' | 'manager';

export interface IUser extends Document {
  _id: Types.ObjectId;
  steamId: string;
  displayName: string;
  avatar: string;
  role: UserRole;
  clanId?: Types.ObjectId;
  refreshToken?: string | null;
  lastLogin: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    steamId: { type: String, required: true, unique: true, index: true },
    displayName: { type: String, required: true },
    avatar: { type: String, default: '' },
    role: {
      type: String,
      enum: ['owner', 'admin', 'manager'],
      default: 'manager',
    },
    clanId: { type: Schema.Types.ObjectId, ref: 'Group', default: null },
    refreshToken: { type: String, default: null },
    lastLogin: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const User = model<IUser>('User', userSchema);
