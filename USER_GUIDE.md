# Panduan Pengguna - Ujian Online Sekolah

Dokumen ini berisi panduan penggunaan aplikasi untuk Admin, Guru, dan Siswa.

## 1) Login
1. Buka aplikasi frontend.
2. Masuk dengan username dan password yang sudah diberikan.
3. Jika pertama kali, Admin bisa membuat akun awal pada halaman Login (mode register).

## 2) Peran Pengguna
- Admin: kelola pengguna, konfigurasi sekolah, statistik admin, pengumuman, notifikasi.
- Guru: kelola bank soal, ujian, hasil ujian, penilaian esai, laporan.
- Siswa: melihat ujian, mengikuti ujian, melihat hasil.

## 3) Admin

### 3.1 Manajemen User
Menu: Admin -> Users
- Tambah user manual: isi email, password, role.
- Import bulk: unggah CSV/XLSX sesuai template.
- Download template: tombol Download CSV/XLSX.

Format kolom bulk import:
```
username,password,role,name,nis,class,email
siswa1,Siswa123!,student,Siswa Satu,12345,X IPA 1,
```

### 3.2 Konfigurasi Sekolah
Menu: Admin -> Konfigurasi
- Nama sekolah, tagline
- Logo URL, banner URL
- Tema soft (pilih 1 dari daftar)
- Simpan untuk menerapkan theme di seluruh UI

### 3.3 Statistik Admin
Menu: Admin -> Statistik
- Ringkasan performa user dan ujian
- Indikasi kecurangan (blur/offline)
- Durasi rata-rata sesi
- Top/Bottom performa siswa

### 3.4 Pengumuman & Notifikasi
Menu: Admin -> Pengumuman / Notifikasi
- Buat pengumuman untuk semua/role tertentu
- Buat notifikasi (in-app/email/whatsapp) untuk semua/role tertentu

## 4) Guru

### 4.1 Bank Soal
Menu: Guru -> Bank Soal
- Pilih mapel, tipe soal
- Isi soal, opsi jawaban, kunci jawaban
- Upload/URL gambar soal (maks 3) + preview
- Edit soal: klik tombol Edit pada daftar soal
- Bulk delete: centang soal -> Hapus Terpilih

Import/Export CSV:
- Import: paste CSV pada bagian Import/Export
- Export: klik Export CSV (hasil disalin ke clipboard)

Format CSV:
```
subject,type,content,options,answer,explanation
Matematika,multiple_choice,Nilai 7x8?,54|56|58,56,Perkalian 7x8
```

### 4.2 Ujian
Menu: Guru -> Ujian
- Buat atau edit ujian
- Set judul, mapel, durasi, jadwal mulai, deadline
- Atur acak soal & opsi
- Batas percobaan (attempts)
- Pilih soal: centang, atau Pilih Semua
- Edit ujian: tombol Edit pada daftar ujian
- Bulk delete: centang ujian -> Hapus Terpilih

### 4.3 Penilaian Esai
Menu: Guru -> Penilaian
- Pilih jawaban esai
- Beri skor + komentar
- Simpan nilai

### 4.4 Hasil Ujian
Menu: Guru -> Hasil
- Pilih ujian
- Lihat daftar nilai per siswa
- Download CSV

### 4.5 Laporan & Analitik
Menu: Guru -> Laporan
- Ringkasan nilai per ujian
- Statistik semua ujian

### 4.6 Pengumuman & Notifikasi
Menu: Guru -> Pengumuman / Notifikasi
- Buat pengumuman atau notifikasi untuk siswa

## 5) Siswa

### 5.1 Lihat Ujian
Menu: Siswa -> Ujian Saya
- Lihat ujian yang aktif
- Klik Mulai

### 5.2 Checklist Ujian
- Setujui integritas
- Konfirmasi perangkat siap
- Konfirmasi identitas

### 5.3 Mengerjakan Ujian
- Timer terlihat jelas
- Navigasi soal dan status jawaban
- Jawaban tersimpan otomatis
- Gambar soal bisa di-zoom

### 5.4 Submit dan Hasil
- Submit ujian
- Lihat hasil dan grade

## 6) Catatan Teknis
- Backend: `http://localhost:4000`
- Frontend: `http://localhost:5173`
- Pastikan database sudah di-migrate

## 7) Troubleshooting
- Tidak bisa login: cek email/password dan status user
- Ujian tidak muncul: cek jadwal (mulai/deadline)
- Error upload/URL gambar: gunakan URL publik atau file kecil
- Jika skor kosong: pastikan submit selesai

---
Dokumen ini bisa diperluas sesuai kebutuhan sekolah.
