import { Elysia } from 'elysia';
import { query } from '../db';
import { authGuard } from './helpers';

export const registerReportRoutes = (app: Elysia) => {
  app.group('/reports', (reports) =>
    reports
      .guard(authGuard(['teacher', 'admin']))
      .get('/overview', async () => {
        const [userCount] = await query<any>('SELECT COUNT(*) as total FROM users');
        const [examCount] = await query<any>('SELECT COUNT(*) as total FROM exams');
        const [sessionCount] = await query<any>('SELECT COUNT(*) as total FROM exam_sessions');
        const [avgScore] = await query<any>('SELECT AVG(total_score) as avg_score FROM grades');
        return {
          users: Number(userCount.total ?? 0),
          exams: Number(examCount.total ?? 0),
          sessions: Number(sessionCount.total ?? 0),
          avg_score: Number(avgScore.avg_score ?? 0)
        };
      })
      .get('/exams/:id/summary', async ({ params, set }) => {
        const grades = await query<any>(
          'SELECT total_score FROM grades WHERE session_id IN (SELECT id FROM exam_sessions WHERE exam_id = ?)',
          [params.id]
        );
        if (!grades.length) {
          set.status = 404;
          return { error: 'No grades found' };
        }
        const scores = grades.map((g) => Number(g.total_score ?? 0)).sort((a, b) => a - b);
        const count = scores.length;
        const avg = scores.reduce((acc, score) => acc + score, 0) / count;
        const median =
          count % 2 === 0
            ? (scores[count / 2 - 1] + scores[count / 2]) / 2
            : scores[Math.floor(count / 2)];
        return {
          count,
          avg,
          median,
          min: scores[0],
          max: scores[count - 1]
        };
      })
      .get('/exams', async ({ query: queryParams }) => {
        const filters = queryParams as Record<string, string>;
        const page = Math.max(1, Number(filters.page ?? 1));
        const pageSize = Math.min(100, Math.max(5, Number(filters.page_size ?? 10)));
        const offset = (page - 1) * pageSize;

        const [countRows, rows] = await Promise.all([
          query<any>('SELECT COUNT(*) as total FROM exams'),
          query<any>(
            `SELECT e.id, e.title, e.code,
                    COUNT(g.session_id) as attempts,
                    AVG(g.total_score) as avg_score
             FROM exams e
             LEFT JOIN exam_sessions s ON s.exam_id = e.id
             LEFT JOIN grades g ON g.session_id = s.id
             GROUP BY e.id
             ORDER BY e.created_at DESC
             LIMIT ? OFFSET ?`,
            [pageSize, offset]
          )
        ]);
        return {
          total: Number(countRows[0]?.total ?? 0),
          page,
          page_size: pageSize,
          data: rows.map((row) => ({
            ...row,
            attempts: Number(row.attempts ?? 0),
            avg_score: Number(row.avg_score ?? 0)
          }))
        };
      })
  );

  return app;
};
