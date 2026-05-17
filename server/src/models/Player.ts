import { Schema, model, type Document, type Types } from 'mongoose';

export interface IPlayer extends Document {
  _id: Types.ObjectId;
  steamId64: string;
  eosId: string;
  username: string;
  discordUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

const playerSchema = new Schema<IPlayer>(
  {
    steamId64: { type: String, default: '' },
    eosId: { type: String, default: '' },
    username: { type: String, required: true },
    discordUserId: { type: String, default: '' },
  },
  { timestamps: true }
);

playerSchema.index(
  { steamId64: 1 },
  { unique: true, partialFilterExpression: { steamId64: { $ne: '' } } }
);
playerSchema.index(
  { eosId: 1 },
  { unique: true, partialFilterExpression: { eosId: { $ne: '' } } }
);

export const Player = model<IPlayer>('Player', playerSchema);
