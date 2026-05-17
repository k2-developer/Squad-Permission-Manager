import { Schema, model, type Document, type Types } from 'mongoose';

export interface IWhitelistEntry extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  playerId: Types.ObjectId;
  /** The group this entry belongs to (clan, VIP, admin, etc.) */
  groupId: Types.ObjectId;
  approved: boolean;
  insertedBy: Types.ObjectId;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const whitelistEntrySchema = new Schema<IWhitelistEntry>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    playerId: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    approved: { type: Boolean, default: false },
    insertedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

whitelistEntrySchema.index({ orgId: 1, groupId: 1 });
whitelistEntrySchema.index({ playerId: 1, groupId: 1 }, { unique: true });
whitelistEntrySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const WhitelistEntry = model<IWhitelistEntry>('WhitelistEntry', whitelistEntrySchema);
