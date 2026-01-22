import { Elysia } from 'elysia';
import { query } from '../db';
import type { Role, UserPayload } from '../types';
import { authGuard } from './helpers';

export const registerNotificationRoutes = (app: Elysia) => {
  app.group('/notifications', (notifications) =>
    notifications
      .guard(authGuard(['admin', 'teacher', 'student']))
      .get('/me', async ({ user, query: queryParams }) => {
        const payload = user as UserPayload;
        const filters = queryParams as Record<string, string>;
        const page = Math.max(1, Number(filters.page ?? 1));
        const pageSize = Math.min(100, Math.max(5, Number(filters.page_size ?? 10)));
        const offset = (page - 1) * pageSize;
        const baseSql =
          'FROM notifications WHERE (user_id = ? OR target_role IN (?, ?))';
        const params = [payload.id, payload.role, 'all'];
        const [countRows, items] = await Promise.all([
          query<any>(`SELECT COUNT(*) as total ${baseSql}`, params),
          query<any>(
            `SELECT * ${baseSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, pageSize, offset]
          )
        ]);
        return {
          total: Number(countRows[0]?.total ?? 0),
          page,
          page_size: pageSize,
          data: items
        };
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
        const id = crypto.randomUUID();
        await query(
          'INSERT INTO notifications (id, user_id, target_role, title, body, channel, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            id,
            payload.user_id ?? null,
            payload.target_role ?? 'all',
            payload.title,
            payload.body,
            payload.channel ?? 'in_app',
            'pending'
          ]
        );
        return { id };
      })
      .put('/:id/read', async ({ params }) => {
        await query('UPDATE notifications SET status = ? WHERE id = ?', ['read', params.id]);
        return { success: true };
      })
  );

  return app;
};
