import { Elysia } from 'elysia';
import { DatabaseContext, getDefaultContext } from '../db';
import { createSchoolService } from '../services/school.service';

type Deps = { db?: DatabaseContext };

export const registerSchoolRoutes = (app: Elysia, deps: Deps = {}) => {
  const db = deps.db ?? getDefaultContext();
  const service = createSchoolService({ db });

  app.get('/health', () => ({ status: 'ok' }));
  app.get('/school-profile', async () => {
    return service.getProfile();
  });
  return app;
};
