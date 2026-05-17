import { Schema, model, type Document, type Types } from 'mongoose';

export type GroupType = 'clan' | 'vip' | 'admin' | 'custom';

export interface IGroup extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  tag: string;
  type: GroupType;
  /** Squad permissions this group grants (reserve, cameraman, debug, etc.). */
  permissions: string[];
  /** Which servers this group applies to. */
  serverScope: 'all' | 'selected';
  serverIds: Types.ObjectId[];
  /**
   * Per-group managers, stored as Steam ID64 strings (e.g. "76561198..."),
   * not User._ids. This lets an admin name a clan leader BEFORE that person
   * has ever logged into the panel — and the Steam-auth gate uses the same
   * list to decide whether a brand-new SteamID is even allowed to register.
   *
   * For clan-type groups these are clan leaders / deputies — non-admin
   * users who can add/remove players in this clan (and only this clan) up
   * to `playerLimit`.
   */
  managers: string[];
  playerLimit: number;
  requireApproval: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const groupSchema = new Schema<IGroup>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, maxlength: 64 },
    tag: { type: String, default: '', maxlength: 10 },
    type: {
      type: String,
      enum: ['clan', 'vip', 'admin', 'custom'],
      default: 'custom',
    },
    permissions: [{ type: String }],
    serverScope: { type: String, enum: ['all', 'selected'], default: 'all' },
    serverIds: [{ type: Schema.Types.ObjectId, ref: 'Server' }],
    // SteamID64 strings — not User._ids. See note on the interface above.
    managers: [{ type: String }],
    playerLimit: { type: Number, default: 50 },
    requireApproval: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Group = model<IGroup>('Group', groupSchema);
