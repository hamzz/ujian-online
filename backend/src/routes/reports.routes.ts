import { Elysia } from 'elysia';
import { DatabaseContext, getDefaultContext } from '../db';
import { authGuard } from '../utils/helpers';
import { createReportService } from '../services/report.service';

type Deps = { db?: DatabaseContext };

export const registerReportRoutes = (app: Elysia, deps: Deps = {}) => {
  const db = deps.db ?? getDefaultContext();
  const service = createReportService({ db });

  app.group('/reports', (reports) =>
    reports
      .guard(authGuard(['teacher', 'admin']))
      .get('/overview', async () => service.overview())
      .get('/exams/:id/summary', async ({ params, set }) => {
        const summary = await service.examSummary(params.id);
        if (!summary) {
          set.status = 404;
          return { error: 'No grades found' };
        }
        return summary;
      })
      .get('/exams', async ({ query: queryParams }) => {
        const filters = queryParams as Record<string, string>;
        const page = Math.max(1, Number(filters.page ?? 1));
        const pageSize = Math.min(100, Math.max(5, Number(filters.page_size ?? 10)));
        return service.listExamStats(page, pageSize);
      })
  );

  return app;
};
