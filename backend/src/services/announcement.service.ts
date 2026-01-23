import type { DatabaseContext } from '../db';
import type { Role, UserPayload } from '../types';

export const createAnnouncementService = ({ db }: { db: DatabaseContext }) => {
  const listByRole = async (role: Role) =>
    db.query<any>(
      'SELECT a.*, u.username as author_username FROM announcements a JOIN users u ON u.id = a.created_by WHERE a.target_role IN (?, ?) ORDER BY a.created_at DESC',
      [role, 'all']
    );

  const create = async (payload: { title: string; message: string; target_role?: Role | 'all' }, user: UserPayload) => {
    const id = crypto.randomUUID();
    await db.query(
      'INSERT INTO announcements (id, title, message, target_role, created_by) VALUES (?, ?, ?, ?, ?)',
      [id, payload.title, payload.message, payload.target_role ?? 'all', user.id]
    );
    return { id };
  };

  return { listByRole, create };
};
