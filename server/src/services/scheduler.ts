import cron from 'node-cron';
import { WhitelistEntry } from '../models/WhitelistEntry.js';
import { invalidateOutputCache } from './whitelist.js';

export function startScheduler(): void {
  // Clean expired whitelist entries every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      // `expiresAt: { $lt: date }` alone matches docs where the field is
       // missing/null/undefined too (Mongo treats missing as null in $lt).
       // We need the explicit type check to avoid wiping never-expiring
       // entries: `$type: 'date'` keeps only actual Date values.
      const result = await WhitelistEntry.deleteMany({
        expiresAt: { $type: 'date', $lt: new Date() },
      });
      if (result.deletedCount > 0) {
        console.log(`[Scheduler] Removed ${result.deletedCount} expired entries`);
        invalidateOutputCache();
      }
    } catch (err) {
      console.error('[Scheduler] Cleanup error:', err);
    }
  });

  console.log('[Scheduler] Background jobs started');
}
