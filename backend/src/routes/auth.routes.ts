import { Elysia } from 'elysia';
import { query } from '../db';
import type { Role, UserPayload } from '../types';
import { hashPassword, verifyPassword } from '../utils/auth';
import { parseJson } from './helpers';

export const registerAuthRoutes = (app: Elysia) => {
  app.post('/auth/login', async ({ body, set, jwt }) => {
    const { username, password } = body as {
      username?: string;
      password: string;
    };
    const loginId = (username ?? '').trim();
    if (!loginId || !password) {
      set.status = 400;
      return { error: 'Username and password required' };
    }

    const users = await query<any>('SELECT * FROM users WHERE username = ?', [loginId]);
    const user = users[0];
    if (!user) {
      set.status = 401;
      return { error: 'Invalid credentials' };
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      set.status = 401;
      return { error: 'Invalid credentials' };
    }

    const payload: UserPayload = { id: user.id, username: user.username, email: user.email, role: user.role };
    const token = await jwt.sign(payload);
    await query(
      'INSERT INTO audit_logs (id, actor_id, actor_role, action, entity_type, entity_id, detail) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        crypto.randomUUID(),
        user.id,
        user.role,
        'login',
        'session',
        null,
        JSON.stringify({ username: user.username })
      ]
    );
    return { token, user: payload };
  });

  app.post('/auth/register', async ({ body, set, jwt }) => {
    const { username, email, password, role } = body as {
      username: string;
      email?: string;
      password: string;
      role: Role;
    };

    if (!username || !password) {
      set.status = 400;
      return { error: 'Username and password required' };
    }

    const settingsRows = await query<any>('SELECT registration_settings FROM app_settings WHERE id = 1');
    const settings = parseJson<{ enabled?: boolean; allowed_roles?: Role[] }>(
      settingsRows[0]?.registration_settings,
      {}
    );
    const registrationEnabled = settings.enabled ?? true;
    const allowedRoles = settings.allowed_roles ?? ['admin'];
    if (!registrationEnabled) {
      set.status = 403;
      return { error: 'Registration is disabled' };
    }

    const existing = await query<any>('SELECT id FROM users LIMIT 1');
    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const safeRole = role || (existing.length === 0 ? 'admin' : 'student');
    if (!allowedRoles.includes(safeRole)) {
      set.status = 403;
      return { error: 'Registration for this role is disabled' };
    }

    await query(
      'INSERT INTO users (id, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [id, username, email ?? null, passwordHash, safeRole]
    );

    const payload: UserPayload = { id, username, email: email ?? null, role: safeRole };
    const token = await jwt.sign(payload);
    return { token, user: payload };
  });

  return app;
};
