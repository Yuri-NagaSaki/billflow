import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import type { HonoEnv } from '../types';
import { ensureAdminUser, getAdminUser, updateAdminPassword, recordSuccessfulLogin } from '../services/adminUserService';
import { buildSessionCookie, clearSessionCookie, createSession, readSessionId, destroySession } from '../middleware/session';
import { requireLogin } from '../middleware/requireLogin';
import { error } from '../utils/response';

export const authRoutes = new Hono<HonoEnv>();

authRoutes.post('/login', async (c) => {
  try {
    const payload = await c.req.json();
    const { username, password } = payload || {};
    if (!username || !password) {
      return error(c, 'Username and password are required', 400);
    }

    await ensureAdminUser(c.env);
    const adminUser = await getAdminUser(c.env);
    if (!adminUser || adminUser.username !== username) {
      return error(c, 'Invalid credentials', 401);
    }

    const ok = await bcrypt.compare(password, adminUser.password_hash);
    if (!ok) {
      return error(c, 'Invalid credentials', 401);
    }

    await recordSuccessfulLogin(c.env);

    const session = await createSession(
      c.env,
      { id: adminUser.id, username: adminUser.username, role: adminUser.role },
      c.req.raw
    );

    const cookie = buildSessionCookie(c.env, c.req.url, session.sessionId);
    c.header('Set-Cookie', cookie);
    return c.json({ message: 'Logged in' });
  } catch (err) {
    return error(c, 'Login failed', 500);
  }
});

authRoutes.post('/logout', async (c) => {
  const sessionId = readSessionId(c.req.raw);
  if (sessionId) {
    await destroySession(c.env, sessionId);
  }
  c.header('Set-Cookie', clearSessionCookie(c.env, c.req.url));
  return c.json({ message: 'Logged out' });
});

authRoutes.post('/change-password', requireLogin, async (c) => {
  try {
    const payload = await c.req.json();
    const { currentPassword, newPassword, confirmPassword } = payload || {};

    if (!currentPassword || !newPassword) {
      return error(c, 'Current password and new password are required', 400);
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return error(c, 'Passwords do not match', 400);
    }

    const complexityRule = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!complexityRule.test(newPassword)) {
      return error(c, 'Password does not meet security requirements', 400);
    }

    const adminUser = await getAdminUser(c.env);
    if (!adminUser) {
      return error(c, 'Forbidden', 403);
    }

    const currentPasswordValid = await bcrypt.compare(currentPassword, adminUser.password_hash);
    if (!currentPasswordValid) {
      return error(c, 'Current password is incorrect', 400);
    }

    const sameAsOld = await bcrypt.compare(newPassword, adminUser.password_hash);
    if (sameAsOld) {
      return error(c, 'New password must be different from the current password', 400);
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await updateAdminPassword(c.env, newHash);

    return c.json({ message: 'Password updated successfully' });
  } catch {
    return error(c, 'Failed to update password', 500);
  }
});

authRoutes.get('/me', requireLogin, async (c) => {
  const user = c.get('user');
  if (!user) {
    return error(c, 'Not authenticated', 401);
  }
  return c.json({ user });
});
