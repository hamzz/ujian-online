import type { DatabaseContext } from '../db';
import type { Role, UserPayload } from '../types';
import { hashPassword, verifyPassword } from '../utils/auth';
import { parseJson } from '../utils/helpers';

export const createAuthService = ({ db }: { db: DatabaseContext }) => {
  const validateCredentials = async (loginId: string, password: string) => {
    const users = await db.query<any>('SELECT * FROM users WHERE username = ?', [loginId]);
    const user = users[0];
    if (!user) return null;
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return null;
    return user as UserPayload & { password_hash: string };
  };

  const logLogin = (user: UserPayload) =>
    db.query(
      'INSERT INTO audit_logs (id, actor_id, actor_role, action, entity_type, entity_id, detail) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        crypto.randomUUID(),
        user.id,
        user.role,
        'login',
        'user',
        user.id,
        JSON.stringify({ username: user.username })
      ]
    );

  const getRegistrationSettings = async () => {
    const settingsRows = await db.query<any>('SELECT registration_settings FROM app_settings WHERE id = 1');
    return parseJson<{ enabled?: boolean; allowed_roles?: Role[] }>(settingsRows[0]?.registration_settings, {});
  };

  const registerUser = async (payload: { username: string; email?: string; password: string; role?: Role }) => {
    const existing = await db.query<any>('SELECT id FROM users LIMIT 1');
    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(payload.password);
    const safeRole = payload.role || (existing.length === 0 ? 'admin' : 'student');
    await db.query('INSERT INTO users (id, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)', [
      id,
      payload.username,
      payload.email ?? null,
      passwordHash,
      safeRole
    ]);
    return { id, username: payload.username, email: payload.email ?? null, role: safeRole };
  };

  return { validateCredentials, logLogin, getRegistrationSettings, registerUser };
};
