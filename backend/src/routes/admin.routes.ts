import { Elysia } from 'elysia';
import { DatabaseContext, getDefaultContext } from '../db';
import type { Role } from '../types';
import { authGuard } from '../utils/helpers';
import { queueSettings, updateQueueSettings } from '../utils/queue';
import { createAdminService } from '../services/admin.service';

type Deps = { db?: DatabaseContext };

export const registerAdminRoutes = (app: Elysia, deps: Deps = {}) => {
  const db = deps.db ?? getDefaultContext();
  const service = createAdminService({ db });

  app.group('/admin', (admin) =>
    admin
      .guard(authGuard(['admin']))
      .get('/school-profile', async () => {
        return service.getSchoolProfile();
      })
      .put('/school-profile', async ({ body, set }) => {
        const payload = body as {
          name?: string;
          tagline?: string;
          logo_url?: string;
          banner_url?: string;
          theme_color?: string;
        };
        if (!payload.name) {
          set.status = 400;
          return { error: 'name required' };
        }
        return service.upsertSchoolProfile({
          name: payload.name,
          tagline: payload.tagline,
          logo_url: payload.logo_url,
          banner_url: payload.banner_url,
          theme_color: payload.theme_color
        });
      })
      .get('/queue-settings', async () => {
        return queueSettings;
      })
      .get('/registration-settings', async () => {
        return service.getRegistrationSettings();
      })
      .put('/queue-settings', async ({ body }) => {
        const payload = body as Partial<typeof queueSettings>;
        updateQueueSettings(payload);
        return queueSettings;
      })
      .put('/registration-settings', async ({ body, set }) => {
        const payload = body as { enabled?: boolean; allowed_roles?: Role[] };
        const allowedRoles = Array.isArray(payload.allowed_roles)
          ? payload.allowed_roles.filter((role) => ['admin', 'teacher', 'student'].includes(role))
          : [];
        const settings = {
          enabled: payload.enabled ?? true,
          allowed_roles: allowedRoles
        };
        if (allowedRoles.length === 0 && settings.enabled) {
          set.status = 400;
          return { error: 'allowed_roles must include at least one role' };
        }
        return service.updateRegistrationSettings(settings);
      })
      .get('/insights', async () => {
        return service.getInsights();
      })
      .get('/users', async ({ query: queryParams }) => {
        const filters = queryParams as Record<string, string>;
        const page = Math.max(1, Number(filters.page ?? 1));
        const pageSize = Math.min(100, Math.max(5, Number(filters.page_size ?? 10)));
        return service.listUsers(page, pageSize);
      })
      .post('/users', async ({ body, set }) => {
        const { username, email, password, role, profile_data } = body as {
          username: string;
          email?: string;
          password: string;
          role: Role;
          profile_data?: Record<string, unknown>;
        };
        if (!username || !password || !role) {
          set.status = 400;
          return { error: 'Missing required fields' };
        }
        return service.createUser({ username, email, password, role, profile_data });
      })
      .put('/users/:id', async ({ params, body }) => {
        const { username, email, role, profile_data } = body as {
          username?: string;
          email?: string;
          role?: Role;
          profile_data?: Record<string, unknown>;
        };
        await service.updateUser(params.id, { username, email, role, profile_data });
        return { success: true };
      })
      .delete('/users/:id', async ({ params }) => {
        await service.deleteUser(params.id);
        return { success: true };
      })
      .post('/import/users', async ({ body, set }) => {
        const payload = body as { csv: string };
        if (!payload.csv) {
          set.status = 400;
          return { error: 'CSV required' };
        }
        const result = await service.importUsers(payload.csv);
        if (result.inserted === 0 && result.skipped === 0) {
          set.status = 400;
          return { error: 'CSV empty' };
        }
        return result;
      })
  );

  return app;
};
