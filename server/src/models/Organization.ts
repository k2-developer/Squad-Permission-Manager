import { Schema, model, type Document, type Types } from 'mongoose';
import crypto from 'crypto';

export interface IOrganization extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  ownerId: Types.ObjectId;
  members: { userId: Types.ObjectId; role: 'owner' | 'admin' | 'moderator' | 'viewer' }[];
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, maxlength: 100 },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      default: () => crypto.randomBytes(4).toString('hex'),
    },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        role: {
          type: String,
          enum: ['owner', 'admin', 'moderator', 'viewer'],
          default: 'viewer',
        },
      },
    ],
  },
  { timestamps: true }
);

organizationSchema.index({ ownerId: 1 });
organizationSchema.index({ 'members.userId': 1 });

export const Organization = model<IOrganization>('Organization', organizationSchema);
