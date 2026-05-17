import mongoose from 'mongoose';
import { config } from './config.js';

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('[DB] Connected to MongoDB');
  } catch (err) {
    console.error('[DB] Connection failed:', err);
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    console.error('[DB] Runtime error:', err);
  });
}
