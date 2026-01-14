import { Elysia } from "elysia";
import { query, queryOne } from "../db";
import { hashPassword, verifyPassword } from "../auth";

export const authRoutes = new Elysia({ prefix: "/auth" })
  .post("/register", async ({ body, jwt, set, request }) => {
    const { email, password, role } = body as { email?: string; password?: string; role?: string };
    if (!email || !password || !role) {
      set.status = 400;
      return { error: "email, password, role are required" };
    }

    const existing = await queryOne<{ id: string }>("SELECT id FROM users WHERE email = ?", [email]);
    if (existing) {
      set.status = 409;
      return { error: "Email already registered" };
    }

    const [{ total }] = await query<{ total: number }>("SELECT COUNT(*) as total FROM users");
    const isBootstrap = total === 0;

    if (!isBootstrap) {
      const authHeader = request.headers.get("authorization") || "";
      const token = authHeader.replace("Bearer ", "");
      const payload = await jwt.verify(token);
      if (!payload || payload.role !== "admin") {
        set.status = 403;
        return { error: "Admin token required to create users" };
      }
    }

    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);

    await query(
      "INSERT INTO users (id, email, password_hash, role, profile_data) VALUES (?, ?, ?, ?, ?)",
      [userId, email, passwordHash, role, JSON.stringify({})]
    );

    return { id: userId, email, role };
  })
  .post("/login", async ({ body, jwt, set }) => {
    const { email, password } = body as { email?: string; password?: string };
    if (!email || !password) {
      set.status = 400;
      return { error: "email and password required" };
    }

    const user = await queryOne<{ id: string; email: string; password_hash: string; role: string }>(
      "SELECT id, email, password_hash, role FROM users WHERE email = ?",
      [email]
    );

    if (!user) {
      set.status = 401;
      return { error: "Invalid credentials" };
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      set.status = 401;
      return { error: "Invalid credentials" };
    }

    const token = await jwt.sign({ sub: user.id, role: user.role, email: user.email });
    return { token, user: { id: user.id, email: user.email, role: user.role } };
  });
