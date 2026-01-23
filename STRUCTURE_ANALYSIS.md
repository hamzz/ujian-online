# Analisis Struktur Proyek — Ujian Online

## Struktur Saat Ini

```
backend/                          # Bun + Elysia API (MySQL/SQLite)
├── src/
│   ├── routes/                   # Rute tipis, delegasi ke service + DI DatabaseContext
│   │   ├── admin.routes.ts
│   │   ├── announcements.routes.ts
│   │   ├── auth.routes.ts
│   │   ├── notifications.routes.ts
│   │   ├── reports.routes.ts
│   │   ├── school.routes.ts
│   │   ├── student.routes.ts
│   │   └── teacher.routes.ts
│   ├── services/                 # SQL + logika bisnis
│   │   ├── admin.service.ts
│   │   ├── announcement.service.ts
│   │   ├── auth.service.ts
│   │   ├── notification.service.ts
│   │   ├── report.service.ts
│   │   ├── school.service.ts
│   │   ├── student.service.ts
│   │   └── teacher.service.ts
│   ├── utils/                    # Helper (auth, cache, grading, helpers, queue)
│   │   ├── auth.ts
│   │   ├── cache.ts
│   │   ├── grading.ts
│   │   ├── helpers.ts            # authGuard, parse helpers
│   │   └── queue.ts              # antrian jawaban/submit + konfigurasi
│   ├── db.ts                     # Client factory + DatabaseContext, setDefaultClient
│   ├── index.ts                  # Bootstrap Elysia, injeksi db ke semua rute
│   └── types.ts
├── scripts/                      # Migrasi & seeding
├── tests/
│   ├── grading.test.ts
│   ├── exam.integration.test.ts  # Login, start, answer, submit, results (SQLite in-memory)
│   └── queue.test.ts             # Batas antrean, concurrency, throttle (stub redis)
├── data/                         # ujian.sqlite (di-ignore)
└── Dockerfile / bun.lock / package*.json / tsconfig.json

frontend/                         # Vite + React + Tailwind + Zustand
├── src/
│   ├── components/
│   │   ├── FormField.tsx
│   │   ├── InfoTable.tsx
│   │   ├── Loading.tsx
│   │   ├── PageHeader.tsx
│   │   ├── ProtectedRoute.tsx
│   │   └── Shell.tsx
│   ├── hooks/
│   │   └── useAsyncAction.ts
│   ├── services/
│   │   └── publicExams.ts
│   ├── pages/
│   │   ├── Home.tsx (pakai InfoTable)
│   │   ├── JoinExam.tsx (pakai FormField + hook submit)
│   │   ├── AdminConfig.tsx … TeacherResults.tsx
│   ├── api.ts / App.tsx / index.css / main.tsx / store.ts
└── root: index.html, Dockerfile, tailwind.config.cjs, postcss.config.cjs, vite.config.ts, bun.lock, package*.json
```

## Isu yang Ditemukan

### 🔴 Kritikal
1. **Helper & Queue Dipindah — Perlu Uji Lanjutan**  
   - helpers.ts dan queue.ts sudah di utils/. Tes dasar throttle/queue ada, tapi belum mencakup jalur error/redis nyata.

### 🟠 Prioritas Menengah
2. **Halaman Guru/Student Besar**  
   - TeacherQuestions/TeacherExams/TakeExam >10 KB. Perlu ekstraksi hooks/komponen per fitur.

## Perbaikan yang Sudah Dilakukan
3. SQL dipindah ke lapisan service; semua rute pakai DatabaseContext.  
4. Tes integrasi backend (exam lifecycle) memakai SQLite in-memory.  
5. Tes queue/throttle (memory + stub redis) untuk antrean jawaban/submit.  
6. Frontend reuse: useAsyncAction, publicExams service, FormField/InfoTable.

## Rekomendasi

### Segera (High Impact)
1. Tambah tes throttle untuk skenario error/timeout + jalankan melawan Redis nyata jika dipakai di produksi.
2. Mulai ekstraksi hooks/komponen per fitur guru agar halaman besar terpecah.

### Jangka Dekat (Medium)
3. Dokumentasikan kontrak service (input/output) singkat di README/USER_GUIDE.  
4. Jadikan migrasi sebagai sumber kebenaran tunggal MySQL/SQLite.

### Jangka Lanjut (Low)
5. Buat hidrasi auth aman untuk SSR/testing (hindari akses localStorage saat import).
