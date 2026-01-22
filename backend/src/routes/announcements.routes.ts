import { Elysia } from 'elysia';
import { query } from '../db';
import type { Role, UserPayload } from '../types';
import { authGuard } from './helpers';

export const registerAnnouncementRoutes = (app: Elysia) => {
  app.group('/announcements', (announcements) =>
    announcements
      .guard(authGuard(['admin', 'teacher', 'student']))
      .get('/', async ({ user }) => {
        const role = (user as UserPayload).role;
        const data = await query<any>(
          'SELECT a.*, u.username as author_username FROM announcements a JOIN users u ON u.id = a.created_by WHERE a.target_role IN (?, ?) ORDER BY a.created_at DESC',
          [role, 'all']
        );
        return data;
      })
      .post('/', async ({ body, set, user }) => {
        const payload = body as { title: string; message: string; target_role?: Role | 'all' };
        if (!payload.title || !payload.message) {
          set.status = 400;
          return { error: 'title and message required' };
        }
        const id = crypto.randomUUID();
        await query(
          'INSERT INTO announcements (id, title, message, target_role, created_by) VALUES (?, ?, ?, ?, ?)',
          [id, payload.title, payload.message, payload.target_role ?? 'all', (user as UserPayload).id]
        );
        return { id };
      })
  );

  return app;
};
