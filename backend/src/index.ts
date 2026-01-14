import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { jwt } from "@elysiajs/jwt";
import { authRoutes } from "./routes/auth";
import { adminRoutes } from "./routes/admin";
import { teacherRoutes } from "./routes/teacher";
import { studentRoutes } from "./routes/student";
import { reportsRoutes } from "./routes/reports";
import { publicRoutes } from "./routes/public";

const app = new Elysia()
  .use(cors())
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET || "dev-secret"
    })
  )
  .derive(async ({ request, jwt }) => {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return { auth: null };
    try {
      const auth = await jwt.verify(token);
      return { auth };
    } catch {
      return { auth: null };
    }
  })
  .get("/health", () => ({ status: "ok" }))
  .use(publicRoutes)
  .use(authRoutes)
  .use(adminRoutes)
  .use(teacherRoutes)
  .use(studentRoutes)
  .use(reportsRoutes);

const port = Number(process.env.PORT || 3001);
app.listen(port);

console.log(`API listening on http://localhost:${port}`);
