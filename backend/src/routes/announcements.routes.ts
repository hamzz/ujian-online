import { Elysia } from 'elysia';
import { DatabaseContext, getDefaultContext } from '../db';
import type { Role, UserPayload } from '../types';
import { authGuard } from '../utils/helpers';
import { createAnnouncementService } from '../services/announcement.service';

type Deps = { db?: DatabaseContext };

export const registerAnnouncementRoutes = (app: Elysia, deps: Deps = {}) => {
  const db = deps.db ?? getDefaultContext();
  const service = createAnnouncementService({ db });

  app.group('/announcements', (announcements) =>
    announcements
      .guard(authGuard(['admin', 'teacher', 'student']))
      .get('/', async ({ user }) => {
        const role = (user as UserPayload).role;
        return service.listByRole(role);
      })
      .post('/', async ({ body, set, user }) => {
        const payload = body as { title: string; message: string; target_role?: Role | 'all' };
        if (!payload.title || !payload.message) {
          set.status = 400;
          return { error: 'title and message required' };
        }
        return service.create(payload, user as UserPayload);
      })
  );

  return app;
};
