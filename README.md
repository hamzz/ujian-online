# Ujian Online (MVP)

Monorepo sederhana untuk platform ujian online berbasis Bun + Elysia (backend) dan React + Tailwind (frontend).

## Struktur
- `backend`: API Elysia + MySQL
- `frontend`: UI React

## Backend Setup
1. Siapkan database MySQL dan jalankan skema:
   ```sql
   SOURCE backend/schema.sql;
   ```
2. Buat file `.env` di `backend` (lihat `.env.example`).
3. Install dependencies:
   ```bash
   bun install
   ```
4. Jalankan API:
   ```bash
   bun run dev
   ```
5. Buat akun uji otomatis:
   ```bash
   bun run seed
   ```
6. Buat soal dan ujian contoh:
   ```bash
   bun run seed:questions
   ```
7. Jalankan unit test backend:
   ```bash
   bun test
   ```

## Frontend Setup
1. Buat file `.env` di `frontend` (lihat `.env.example`).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Jalankan UI:
   ```bash
   npm run dev
   ```
4. Jalankan unit test frontend:
   ```bash
   npm run test
   ```

## Deployment (Docker)
1. Siapkan `.env` di root project (opsional):
   ```env
   DB_PASSWORD=root
   DB_NAME=ujian_online
   JWT_SECRET=replace-with-secure-secret
   VITE_API_URL=http://localhost:3001
   ```
2. Jalankan:
   ```bash
   docker compose up --build
   ```
3. Akses UI di `http://localhost:8080`.

## Akun Uji Coba
- Admin: `admin@ujian.local` / `Admin123!`
- Guru: `guru@ujian.local` / `Guru123!`
- Siswa: `siswa@ujian.local` / `Siswa123!`

## Import/Export
- Import siswa: gunakan tab `Import/Export` di panel guru.
  - Kolom Excel/CSV: `NIS`, `nama`, `kelas`, `email`
  - `kelas` bisa format `level/major/rombel` atau `level-major-rombel`
  - Password default: `Siswa123!`
- Import soal: kolom Excel/CSV
  - `mapel`, `type`, `content`, `options`, `answer_key`, `mode`, `keywords`, `explanation`
  - `options` dan `answer_key` bisa dipisah dengan `|` atau `,`
- Export nilai: tab `Import/Export` -> pilih ujian -> download CSV/Excel.

## Reporting & Analytics
- Panel guru -> tab Ujian -> pilih ujian -> "Muat analytics".
- Menampilkan distribusi nilai dan statistik per soal (attempts, correct, difficulty).
- Export analytics: tombol download CSV atau PDF setelah analytics dimuat.
- Export rapor siswa: di daftar sesi ujian klik "Download Rapor PDF".
- Export rapor siswa CSV/Excel: di daftar sesi ujian klik tombol CSV atau Excel.

## Bank Soal + Gambar
- Guru dapat upload maksimal 3 gambar per soal pada form Bank Soal.
- Gambar tampil proporsional di halaman ujian siswa.

## Konfigurasi Identitas Sekolah
- Admin -> menu Kelola User -> bagian "Identitas Sekolah".
- Isi nama, tagline, logo URL, banner URL, dan warna tema.

## Catatan
- Bootstrap user: gunakan form register pada halaman login untuk membuat admin pertama.
- MVP fokus pada Phase 1 sesuai `agent.md`.
