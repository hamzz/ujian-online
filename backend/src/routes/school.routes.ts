import { Elysia } from 'elysia';
import { query } from '../db';

export const registerSchoolRoutes = (app: Elysia) => {
  app.get('/health', () => ({ status: 'ok' }));
  app.get('/school-profile', async () => {
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
  });
  return app;
};
