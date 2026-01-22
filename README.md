# Ujian Online Sekolah (MVP)

Monorepo sederhana untuk backend (Bun + Elysia) dan frontend (React + daisyUI). Fokus pada Phase 1: auth, bank soal, ujian, auto-grading, dan hasil.

## Struktur
- `backend/` API server Bun + Elysia
- `frontend/` React + TypeScript + daisyUI
- `schema.sql` (MySQL) and `schema.sqlite.sql` (SQLite) schemas

## Backend

### Setup
```bash
cd backend
bun install
cp .env.example .env
bun dev
```

Set `DATABASE_TYPE` to `mysql` (default) or `sqlite`. When using SQLite, point `DATABASE_URL` to a file path (e.g., `./data/ujian.sqlite`) or `:memory:`; migrations will pick `schema.sqlite.sql` automatically.

Contoh konfigurasi SQLite:
```bash
DATABASE_TYPE=sqlite
DATABASE_URL=./data/ujian.sqlite
```

Optional cache (multi-instance):
```bash
CACHE_DRIVER=redis
REDIS_URL=redis://localhost:6379
```

Optional global throttling (multi-instance):
```bash
QUEUE_DRIVER=redis
REDIS_URL=redis://localhost:6379
QUEUE_GLOBAL_MAX_QUEUE=1000
QUEUE_GLOBAL_ANSWER_CONCURRENCY=10
QUEUE_GLOBAL_SUBMIT_CONCURRENCY=3
```
Set `QUEUE_DRIVER=memory` to keep per-instance throttling only.

### Migrasi dan Seed
```bash
cd backend
bun run migrate
bun run seed
```

### Endpoint utama
- `POST /auth/login`
- `POST /auth/register` (hanya untuk setup awal)
- `GET /admin/users`
- `POST /admin/import/users` (CSV/XLSX via frontend)
- `GET /admin/school-profile`
- `PUT /admin/school-profile`
- `GET /admin/insights`
- `GET /admin/queue-settings`
- `PUT /admin/queue-settings`
- `POST /teacher/subjects`
- `POST /teacher/questions`
- `POST /teacher/import/questions` (CSV)
- `GET /teacher/export/questions` (CSV)
- `GET /teacher/essay-submissions`
- `POST /teacher/questions/bulk-delete`
- `POST /teacher/exams/bulk-delete`
- `POST /teacher/exams`
- `GET /teacher/exams/:id/results`
- `GET /teacher/exams/:id/results.csv`
- `POST /student/exams/:id/start`
- `POST /student/sessions/:id/submit`
- `GET /reports/overview`
- `GET /reports/exams/:id/summary`
- `GET /reports/exams`
- `GET /announcements`
- `POST /announcements`
- `GET /notifications/me`
- `POST /notifications`
- `PUT /notifications/:id/read`

## Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Docker (terpisah)

```bash
# Backend
cd backend
docker build -t ujian-backend .

# Frontend
cd frontend
docker build -t ujian-frontend .
```

## Catatan
- Migrate untuk MySQL (`schema.sql`) atau SQLite (`schema.sqlite.sql`) otomatis disesuaikan berdasarkan `DATABASE_TYPE`.
- Set `DATABASE_URL` ke koneksi MySQL (`mysql://...`) atau ke path SQLite/`:memory:` saat `DATABASE_TYPE=sqlite`.
- JWT secret harus diganti untuk production.
