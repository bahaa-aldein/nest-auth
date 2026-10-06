import 'express';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
