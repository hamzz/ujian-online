import { Elysia } from 'elysia';
import { databaseType, query } from '../db';
import type { Role } from '../types';
import { hashPassword } from '../utils/auth';
import { authGuard, parseCsv, parseJson } from './helpers';
import { queueSettings, updateQueueSettings } from './queue';

export const registerAdminRoutes = (app: Elysia) => {
  app.group('/admin', (admin) =>
    admin
      .guard(authGuard(['admin']))
      .get('/school-profile', async () => {
        const profiles = await query<any>('SELECT * FROM school_profile WHERE id = 1');
        return (
          profiles[0] ?? {
            name: '',
            tagline: null,
            logo_url: null,
            banner_url: null,
            theme_color: 'sekolah'
          }
        );
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
        const existing = await query<any>('SELECT id FROM school_profile WHERE id = 1');
        if (existing.length === 0) {
          await query(
            'INSERT INTO school_profile (id, name, tagline, logo_url, banner_url, theme_color) VALUES (1, ?, ?, ?, ?, ?)',
            [
              payload.name,
              payload.tagline ?? null,
              payload.logo_url ?? null,
              payload.banner_url ?? null,
              payload.theme_color ?? null
            ]
          );
        } else {
          await query(
            'UPDATE school_profile SET name = ?, tagline = ?, logo_url = ?, banner_url = ?, theme_color = ? WHERE id = 1',
            [
              payload.name,
              payload.tagline ?? null,
              payload.logo_url ?? null,
              payload.banner_url ?? null,
              payload.theme_color ?? null
            ]
          );
        }
        return { success: true };
      })
      .get('/queue-settings', async () => {
        return queueSettings;
      })
      .get('/registration-settings', async () => {
        const rows = await query<any>('SELECT registration_settings FROM app_settings WHERE id = 1');
        const stored = rows[0]?.registration_settings;
        const parsed = parseJson<{ enabled?: boolean; allowed_roles?: Role[] }>(stored, {});
        return {
          enabled: parsed.enabled ?? true,
          allowed_roles: parsed.allowed_roles ?? ['admin']
        };
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
        const existing = await query<any>('SELECT id FROM app_settings WHERE id = 1');
        if (existing.length === 0) {
          await query(
            'INSERT INTO app_settings (id, registration_settings) VALUES (1, ?)',
            [JSON.stringify(settings)]
          );
        } else {
          await query(
            'UPDATE app_settings SET registration_settings = ? WHERE id = 1',
            [JSON.stringify(settings)]
          );
        }
        return settings;
      })
      .get('/insights', async () => {
        const activeStudentsSql =
          databaseType === 'sqlite'
            ? "SELECT COUNT(DISTINCT actor_id) as total FROM audit_logs WHERE action = 'login' AND actor_role = 'student' AND created_at >= datetime('now', '-30 minutes')"
            : "SELECT COUNT(DISTINCT actor_id) as total FROM audit_logs WHERE action = 'login' AND actor_role = 'student' AND created_at >= (NOW() - INTERVAL 30 MINUTE)";
        const activeTeachersSql =
          databaseType === 'sqlite'
            ? "SELECT COUNT(DISTINCT actor_id) as total FROM audit_logs WHERE action = 'login' AND actor_role = 'teacher' AND created_at >= datetime('now', '-30 minutes')"
            : "SELECT COUNT(DISTINCT actor_id) as total FROM audit_logs WHERE action = 'login' AND actor_role = 'teacher' AND created_at >= (NOW() - INTERVAL 30 MINUTE)";

        const [userCounts, sessionCount, avgScore, unfinished, activeStudents, activeTeachers, inExam] = await Promise.all([
          query<any>('SELECT role, COUNT(*) as total FROM users GROUP BY role'),
          query<any>('SELECT COUNT(*) as total FROM exam_sessions'),
          query<any>('SELECT AVG(total_score) as avg_score FROM grades'),
          query<any>('SELECT COUNT(*) as total FROM exam_sessions WHERE status = ?', ['in_progress']),
          query<any>(activeStudentsSql),
          query<any>(activeTeachersSql),
          query<any>(
            "SELECT COUNT(DISTINCT user_id) as students, COUNT(*) as sessions FROM exam_sessions WHERE status = 'in_progress'"
          )
        ]);

        const roleMap = userCounts.reduce<Record<string, number>>((acc, row) => {
          acc[row.role] = Number(row.total ?? 0);
          return acc;
        }, {});

        const topStudents = await query<any>(
          `SELECT u.username, AVG(g.total_score) as avg_score, COUNT(*) as attempts
           FROM grades g
           JOIN exam_sessions s ON s.id = g.session_id
           JOIN users u ON u.id = s.user_id
           WHERE u.role = 'student'
           GROUP BY u.id
           ORDER BY avg_score DESC
           LIMIT 5`
        );
        const lowStudents = await query<any>(
          `SELECT u.username, AVG(g.total_score) as avg_score, COUNT(*) as attempts
           FROM grades g
           JOIN exam_sessions s ON s.id = g.session_id
           JOIN users u ON u.id = s.user_id
           WHERE u.role = 'student'
           GROUP BY u.id
           ORDER BY avg_score ASC
           LIMIT 5`
        );

        const sessions = await query<any>(
          `SELECT s.id, s.start_time, s.end_time, s.logs, u.username, e.title as exam_title
           FROM exam_sessions s
           JOIN users u ON u.id = s.user_id
           JOIN exams e ON e.id = s.exam_id
           ORDER BY s.start_time DESC
           LIMIT 200`
        );

        let totalBlur = 0;
        let totalOffline = 0;
        let sessionsWithBlur = 0;
        const topRisk: Array<any> = [];

        for (const session of sessions) {
          const logs = parseJson<any[]>(session.logs, []);
          const blurCount = logs.filter((log) => log.event === 'tab-blur').length;
          const offlineCount =
            logs.filter((log) => log.event === 'network-offline').length +
            logs.filter((log) => log.event === 'heartbeat' && log.status === 'offline').length;
          if (blurCount > 0) sessionsWithBlur += 1;
          totalBlur += blurCount;
          totalOffline += offlineCount;
          if (blurCount >= 3 || offlineCount >= 2) {
            topRisk.push({
              session_id: session.id,
              username: session.username,
              exam_title: session.exam_title,
              blur_count: blurCount,
              offline_count: offlineCount
            });
          }
        }

        const durations = sessions
          .filter((session) => session.end_time)
          .map((session) => new Date(session.end_time).getTime() - new Date(session.start_time).getTime());
        const avgDuration =
          durations.length > 0
            ? Math.round(durations.reduce((acc, value) => acc + value, 0) / durations.length / 60000)
            : 0;

        return {
          overview: {
            users: (roleMap.admin ?? 0) + (roleMap.teacher ?? 0) + (roleMap.student ?? 0),
            admins: roleMap.admin ?? 0,
            teachers: roleMap.teacher ?? 0,
            students: roleMap.student ?? 0,
            sessions: Number(sessionCount[0]?.total ?? 0),
            avg_score: Number(avgScore[0]?.avg_score ?? 0),
            unfinished_sessions: Number(unfinished[0]?.total ?? 0),
            avg_duration_minutes: avgDuration,
            active_teachers: Number(activeTeachers[0]?.total ?? 0),
            active_students: Number(activeStudents[0]?.total ?? 0),
            in_exam_students: Number(inExam[0]?.students ?? 0),
            in_exam_sessions: Number(inExam[0]?.sessions ?? 0)
          },
          performance: {
            top_students: topStudents.map((row) => ({
              username: row.username,
              avg_score: Number(row.avg_score ?? 0),
              attempts: Number(row.attempts ?? 0)
            })),
            low_students: lowStudents.map((row) => ({
              username: row.username,
              avg_score: Number(row.avg_score ?? 0),
              attempts: Number(row.attempts ?? 0)
            }))
          },
          cheating: {
            sessions_with_blur: sessionsWithBlur,
            total_blur_events: totalBlur,
            total_offline_events: totalOffline,
            flagged_sessions: topRisk.slice(0, 10)
          }
        };
      })
      .get('/users', async ({ query: queryParams }) => {
        const filters = queryParams as Record<string, string>;
        const page = Math.max(1, Number(filters.page ?? 1));
        const pageSize = Math.min(100, Math.max(5, Number(filters.page_size ?? 10)));
        const offset = (page - 1) * pageSize;

        const [countRows, users] = await Promise.all([
          query<any>('SELECT COUNT(*) as total FROM users'),
          query<any>(
            'SELECT id, username, email, role, profile_data, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
            [pageSize, offset]
          )
        ]);
        return {
          total: Number(countRows[0]?.total ?? 0),
          page,
          page_size: pageSize,
          data: users.map((user) => ({
            ...user,
            profile_data: parseJson(user.profile_data, {})
          }))
        };
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
        const id = crypto.randomUUID();
        const passwordHash = await hashPassword(password);
        await query(
          'INSERT INTO users (id, username, email, password_hash, role, profile_data) VALUES (?, ?, ?, ?, ?, ?)',
          [id, username, email ?? null, passwordHash, role, JSON.stringify(profile_data ?? {})]
        );
        return { id, username, role };
      })
      .put('/users/:id', async ({ params, body }) => {
        const { username, email, role, profile_data } = body as {
          username?: string;
          email?: string;
          role?: Role;
          profile_data?: Record<string, unknown>;
        };
        await query(
          'UPDATE users SET username = COALESCE(?, username), email = COALESCE(?, email), role = COALESCE(?, role), profile_data = COALESCE(?, profile_data) WHERE id = ?',
          [
            username ?? null,
            email ?? null,
            role ?? null,
            profile_data ? JSON.stringify(profile_data) : null,
            params.id
          ]
        );
        return { success: true };
      })
      .delete('/users/:id', async ({ params }) => {
        await query('DELETE FROM users WHERE id = ?', [params.id]);
        return { success: true };
      })
      .post('/import/users', async ({ body, set }) => {
        const payload = body as { csv: string };
        if (!payload.csv) {
          set.status = 400;
          return { error: 'CSV required' };
        }

        const rows = parseCsv(payload.csv);
        if (!rows.length) {
          set.status = 400;
          return { error: 'CSV empty' };
        }

        const [header, ...data] = rows;
        const headerMap = header.reduce<Record<string, number>>((acc, key, index) => {
          acc[key.trim().toLowerCase()] = index;
          return acc;
        }, {});

        let inserted = 0;
        let skipped = 0;

        for (const row of data) {
          const username = row[headerMap.username] || '';
          const email = row[headerMap.email] || '';
          const password = row[headerMap.password] || '';
          const role = (row[headerMap.role] || 'student') as Role;
          if (!username || !password) {
            skipped += 1;
            continue;
          }

          const existing = await query<any>('SELECT id FROM users WHERE username = ?', [username]);
          if (existing.length > 0) {
            skipped += 1;
            continue;
          }

          const profile_data: Record<string, unknown> = {};
          const name = row[headerMap.name];
          const nis = row[headerMap.nis];
          const className = row[headerMap.class];
          if (name) profile_data.name = name;
          if (nis) profile_data.nis = nis;
          if (className) profile_data.class = className;

          const id = crypto.randomUUID();
          const passwordHash = await hashPassword(password);
          await query(
            'INSERT INTO users (id, username, email, password_hash, role, profile_data) VALUES (?, ?, ?, ?, ?, ?)',
            [id, username, email || null, passwordHash, role, JSON.stringify(profile_data)]
          );
          inserted += 1;
        }

        return { inserted, skipped };
      })
  );

  return app;
};
