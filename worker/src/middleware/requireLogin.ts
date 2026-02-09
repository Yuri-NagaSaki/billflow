import type { MiddlewareHandler } from 'hono';
import type { HonoEnv } from '../types';
import { getSessionUser, readSessionId } from './session';
import { unauthorized } from '../utils/response';

export const requireLogin: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const sessionId = readSessionId(c.req.raw);
  if (!sessionId) {
    return unauthorized(c, 'Not authenticated');
  }

  const user = await getSessionUser(c.env, sessionId);
  if (!user) {
    return unauthorized(c, 'Not authenticated');
  }

  c.set('user', user);
  await next();
};
