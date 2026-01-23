import 'dotenv/config';
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { jwt } from '@elysiajs/jwt';
import { createDatabaseClient, createDatabaseContext, setDefaultClient } from './db';
import { registerAdminRoutes } from './routes/admin.routes';
import { registerAnnouncementRoutes } from './routes/announcements.routes';
import { registerAuthRoutes } from './routes/auth.routes';
import { registerNotificationRoutes } from './routes/notifications.routes';
import { registerReportRoutes } from './routes/reports.routes';
import { registerSchoolRoutes } from './routes/school.routes';
import { registerStudentRoutes } from './routes/student.routes';
import { registerTeacherRoutes } from './routes/teacher.routes';

const app = new Elysia();
const dbClient = createDatabaseClient();
const db = createDatabaseContext(dbClient);
setDefaultClient(dbClient);

app.use(cors());
app.use(
  jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET || 'dev-secret'
  })
);

registerSchoolRoutes(app, { db });
registerAuthRoutes(app, { db });
registerAdminRoutes(app, { db });
registerTeacherRoutes(app, { db });
registerStudentRoutes(app, { db });
registerAnnouncementRoutes(app, { db });
registerNotificationRoutes(app, { db });
registerReportRoutes(app, { db });

const port = Number(process.env.PORT || 4000);
app.listen(port);
console.log(`API running on http://localhost:${port}`);
