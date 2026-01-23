import { Elysia } from 'elysia';
import { DatabaseContext, getDefaultContext } from '../db';
import type { Role, UserPayload } from '../types';
import { createAuthService } from '../services/auth.service';

type Deps = { db?: DatabaseContext };

export const registerAuthRoutes = (app: Elysia, deps: Deps = {}) => {
  const db = deps.db ?? getDefaultContext();
  const service = createAuthService({ db });

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

    const user = await service.validateCredentials(loginId, password);
    if (!user) {
      set.status = 401;
      return { error: 'Invalid credentials' };
    }

    const payload: UserPayload = { id: user.id, username: user.username, email: user.email, role: user.role };
    const token = await jwt.sign(payload);
    await service.logLogin(payload);
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

    const settings = service.getRegistrationSettings
      ? await service.getRegistrationSettings()
      : { enabled: true, allowed_roles: ['admin'] as Role[] };
    const registrationEnabled = settings.enabled ?? true;
    const allowedRoles = settings.allowed_roles ?? ['admin'];
    if (!registrationEnabled) {
      set.status = 403;
      return { error: 'Registration is disabled' };
    }

    const safeRole = role || 'student';
    if (!allowedRoles.includes(safeRole)) {
      set.status = 403;
      return { error: 'Registration for this role is disabled' };
    }

    const created = await service.registerUser({ username, email, password, role: safeRole });
    const payload: UserPayload = {
      id: created.id,
      username: created.username,
      email: created.email,
      role: created.role as Role
    };
    const token = await jwt.sign(payload);
    return { token, user: payload };
  });

  return app;
};
