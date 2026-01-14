import { queryOne, query } from "./db";
import { hashPassword } from "./auth";

async function ensureUser(email: string, password: string, role: "admin" | "teacher" | "student") {
  const existing = await queryOne<{ id: string }>("SELECT id FROM users WHERE email = ?", [email]);
  if (existing) {
    return existing.id;
  }
  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  await query(
    "INSERT INTO users (id, email, password_hash, role, profile_data) VALUES (?, ?, ?, ?, ?)",
    [id, email, passwordHash, role, JSON.stringify({})]
  );
  return id;
}

async function main() {
  const adminId = await ensureUser("admin@ujian.local", "Admin123!", "admin");
  const teacherId = await ensureUser("guru@ujian.local", "Guru123!", "teacher");
  const studentId = await ensureUser("siswa@ujian.local", "Siswa123!", "student");

  console.log("Seed complete:");
  console.log({ adminId, teacherId, studentId });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
