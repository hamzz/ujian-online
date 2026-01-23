import type { DatabaseContext } from '../db';
import type { Role } from '../types';

export const createNotificationService = ({ db }: { db: DatabaseContext }) => {
  const listForUser = async (userId: string, role: Role | 'admin', page: number, pageSize: number) => {
    const offset = (page - 1) * pageSize;
    const baseSql = 'FROM notifications WHERE (user_id = ? OR target_role IN (?, ?))';
    const params = [userId, role, 'all'];
    const [countRows, items] = await Promise.all([
      db.query<any>(`SELECT COUNT(*) as total ${baseSql}`, params),
      db.query<any>(
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
  };

  const create = async (payload: {
    user_id?: string;
    target_role?: Role | 'all';
    title: string;
    body: string;
    channel?: 'in_app' | 'email' | 'whatsapp';
  }) => {
    const id = crypto.randomUUID();
    await db.query(
      'INSERT INTO notifications (id, user_id, target_role, title, body, channel) VALUES (?, ?, ?, ?, ?, ?)',
      [
        id,
        payload.user_id ?? null,
        payload.target_role ?? 'all',
        payload.title,
        payload.body,
        payload.channel ?? 'in_app'
      ]
    );
    return { id };
  };

  const markRead = (id: string) => db.query('UPDATE notifications SET status = ? WHERE id = ?', ['read', id]);

  return { listForUser, create, markRead };
};
