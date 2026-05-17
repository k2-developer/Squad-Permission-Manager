import { Schema, model, type Document, type Types } from 'mongoose';
import crypto from 'crypto';

export interface IServer extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  address: string;
  /**
   * Cosmetic URL slug shown in the public output URL
   * (`/output/<slug>/<token>`). Auth is still 100% the secret token —
   * the slug is purely for readability in admin configs and logs.
   */
  slug: string;
  /** 40-hex-char token for secure whitelist URL */
  secretToken: string;
  cacheTtl: number;
  preferEosId: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const serverSchema = new Schema<IServer>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, maxlength: 100 },
    address: { type: String, default: '', maxlength: 100 },
    slug: { type: String, default: '', maxlength: 32 },
    secretToken: {
      type: String,
      unique: true,
      index: true,
      default: () => crypto.randomBytes(20).toString('hex'),
    },
    cacheTtl: { type: Number, default: 60 },
    preferEosId: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Server = model<IServer>('Server', serverSchema);
