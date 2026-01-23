import { Elysia } from 'elysia';
import { DatabaseContext, getDefaultContext } from '../db';
import type { UserPayload } from '../types';
import { createStudentService } from '../services/student.service';
import { authGuard } from '../utils/helpers';

type Deps = { db?: DatabaseContext };

const applyStatus = (set: { status: number }, result: { status?: number }) => {
  if (result.status) {
    set.status = result.status;
  }
};

const isError = (result: any): result is { error: string; status?: number } =>
  result && typeof result.error === 'string';

export const registerStudentRoutes = (app: Elysia, deps: Deps = {}) => {
  const db = deps.db ?? getDefaultContext();
  const service = createStudentService({ db });

  app.group('/student', (student) =>
    student
      .guard(authGuard(['student', 'admin']))
      .get('/exams', async ({ query: queryParams }) => {
        return service.listExams(queryParams as Record<string, string>);
      })
      .post('/exams/:id/start', async ({ params, user, set }) => {
        const result = await service.startExam(params.id, user as UserPayload);
        if (isError(result)) applyStatus(set, result);
        return result;
      })
      .get('/sessions/:id', async ({ params, set }) => {
        const result = await service.getSession(params.id);
        if (isError(result)) applyStatus(set, result);
        return result;
      })
      .post('/sessions/:id/answer', async (ctx) => {
        const { params, set } = ctx;
        const rawBody = ctx.body ?? (await ctx.request.json().catch(() => null));
        const sessionCheck = await service.getSession(params.id);
        if (isError(sessionCheck)) {
          applyStatus(set, sessionCheck);
          return { error: sessionCheck.error };
        }
        const result = await service.submitAnswer(params.id, (rawBody ?? {}) as any);
        if (isError(result)) applyStatus(set, result);
        return result;
      })
      .post('/sessions/:id/logs', async (ctx) => {
        const { params, set } = ctx;
        const rawBody = ctx.body ?? (await ctx.request.json().catch(() => null));
        const sessionCheck = await service.getSession(params.id);
        if (isError(sessionCheck)) {
          applyStatus(set, sessionCheck);
          return { error: sessionCheck.error };
        }
        return service.appendLog(params.id, (rawBody ?? {}) as any);
      })
      .post('/sessions/:id/heartbeat', async (ctx) => {
        const { params, set } = ctx;
        const rawBody = ctx.body ?? (await ctx.request.json().catch(() => null));
        const sessionCheck = await service.getSession(params.id);
        if (isError(sessionCheck)) {
          applyStatus(set, sessionCheck);
          return { error: sessionCheck.error };
        }
        return service.appendHeartbeat(params.id, (rawBody ?? {}) as any);
      })
      .post('/sessions/:id/submit', async ({ params, set }) => {
        const sessionCheck = await service.getSession(params.id);
        if (isError(sessionCheck)) {
          applyStatus(set, sessionCheck);
          return { error: sessionCheck.error };
        }
        const result = await service.submitSession(params.id);
        if (isError(result)) applyStatus(set, result);
        return result;
      })
      .get('/sessions/:id/results', async ({ params, set }) => {
        const sessionCheck = await service.getSession(params.id);
        if (isError(sessionCheck)) {
          applyStatus(set, sessionCheck);
          return { error: sessionCheck.error };
        }
        const result = await service.getResults(params.id);
        if (isError(result)) applyStatus(set, result);
        return result;
      })
  );

  app.group('/public', (publicApi) =>
    publicApi
      .post('/exams/start', async ({ body, set }) => {
        const result = await service.startSimpleExam(body as any);
        if (isError(result)) applyStatus(set, result);
        return result;
      })
      .get('/sessions/:id', async ({ params, set }) => {
        const result = await service.getSimpleSession(params.id);
        if (isError(result)) applyStatus(set, result);
        return result;
      })
      .post('/sessions/:id/answer', async (ctx) => {
        const { params, set } = ctx;
        const rawBody = ctx.body ?? (await ctx.request.json().catch(() => null));
        const sessionCheck = await service.loadSimpleSession(params.id);
        if (isError(sessionCheck)) {
          applyStatus(set, sessionCheck);
          return { error: sessionCheck.error };
        }
        const result = await service.submitAnswer(params.id, (rawBody ?? {}) as any);
        if (isError(result)) applyStatus(set, result);
        return result;
      })
      .post('/sessions/:id/logs', async (ctx) => {
        const { params, set } = ctx;
        const rawBody = ctx.body ?? (await ctx.request.json().catch(() => null));
        const sessionCheck = await service.loadSimpleSession(params.id);
        if (isError(sessionCheck)) {
          applyStatus(set, sessionCheck);
          return { error: sessionCheck.error };
        }
        return service.appendLog(params.id, (rawBody ?? {}) as any);
      })
      .post('/sessions/:id/heartbeat', async (ctx) => {
        const { params, set } = ctx;
        const rawBody = ctx.body ?? (await ctx.request.json().catch(() => null));
        const sessionCheck = await service.loadSimpleSession(params.id);
        if (isError(sessionCheck)) {
          applyStatus(set, sessionCheck);
          return { error: sessionCheck.error };
        }
        return service.appendHeartbeat(params.id, (rawBody ?? {}) as any);
      })
      .post('/sessions/:id/submit', async ({ params, set }) => {
        const sessionCheck = await service.loadSimpleSession(params.id);
        if (isError(sessionCheck)) {
          applyStatus(set, sessionCheck);
          return { error: sessionCheck.error };
        }
        const result = await service.submitSession(params.id);
        if (isError(result)) applyStatus(set, result);
        return result;
      })
      .get('/sessions/:id/results', async ({ params, set }) => {
        const sessionCheck = await service.loadSimpleSession(params.id);
        if (isError(sessionCheck)) {
          applyStatus(set, sessionCheck);
          return { error: sessionCheck.error };
        }
        const result = await service.getResults(params.id);
        if (isError(result)) applyStatus(set, result);
        return result;
      })
  );

  return app;
};
