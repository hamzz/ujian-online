import { Elysia } from 'elysia';
import { DatabaseContext, getDefaultContext } from '../db';
import type { Role, UserPayload } from '../types';
import { authGuard } from '../utils/helpers';
import { createNotificationService } from '../services/notification.service';

type Deps = { db?: DatabaseContext };

export const registerNotificationRoutes = (app: Elysia, deps: Deps = {}) => {
  const db = deps.db ?? getDefaultContext();
  const service = createNotificationService({ db });

  app.group('/notifications', (notifications) =>
    notifications
      .guard(authGuard(['admin', 'teacher', 'student']))
      .get('/me', async ({ user, query: queryParams }) => {
        const payload = user as UserPayload;
        const filters = queryParams as Record<string, string>;
        const page = Math.max(1, Number(filters.page ?? 1));
        const pageSize = Math.min(100, Math.max(5, Number(filters.page_size ?? 10)));
        return service.listForUser(payload.id, payload.role, page, pageSize);
      })
      .post('/', async ({ body, set }) => {
        const payload = body as {
          user_id?: string;
          target_role?: Role | 'all';
          title: string;
          body: string;
          channel?: 'in_app' | 'email' | 'whatsapp';
        };
        if (!payload.title || !payload.body) {
          set.status = 400;
          return { error: 'title and body required' };
        }
        return service.create(payload);
      })
      .put('/:id/read', async ({ params }) => {
        await service.markRead(params.id);
        return { success: true };
      })
  );

  return app;
};
