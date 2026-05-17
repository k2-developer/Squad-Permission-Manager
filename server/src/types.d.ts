import type { UserRole } from './models/User.js';

declare global {
  namespace Express {
    interface User {
      userId: string;
      steamId: string;
      role: UserRole;
    }
  }
}

export {};
