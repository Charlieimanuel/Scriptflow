# Panduan Integrasi Database & Auth Supabase

Sistem login dan register ScriptFlow AI kini telah disesuaikan dan siap dihubungkan langsung dengan database **Supabase (PostgreSQL + Supabase Auth)**.

---

## 1. Menjalankan Skema SQL di Supabase

1. Buka dashboard proyek Supabase Anda: [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Masuk ke menu **SQL Editor** di sidebar kiri.
3. Buka berkas [`supabase/migrations/001_auth_and_schema.sql`](file:///c:/Hackaton/supabase/migrations/001_auth_and_schema.sql), salin seluruh kodenya, dan tempelkan ke SQL Editor Supabase.
4. Klik tombol **Run**.

### Apa yang dilakukan skrip SQL ini?
- **Tabel `public.profiles`**: Menyimpan profil lengkap (nama, email, role, avatar, provider login).
- **Trigger `on_auth_user_created`**: Secara otomatis mendeteksi setiap kali ada pengguna baru mendaftar (baik via Google OAuth maupun Email/Password) dan menyalin profilnya ke tabel `public.profiles`.
- **Row Level Security (RLS)**: Mengamankan data agar setiap user hanya dapat mengakses dan mengelola proyek serta adegannya sendiri.
- **Tabel Proyek & Adegan**: Menyiapkan relasi tabel `projects`, `scenes`, `scene_elements`, `shooting_days`, dan `price_master`.

---

## 2. Mengaktifkan Login Google di Supabase Auth

1. Di dashboard Supabase, buka menu **Authentication** > **Providers**.
2. Cari dan aktifkan penyedia **Google**.
3. Masukkan Client ID dan Client Secret dari [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
4. Tambahkan URL redirect Supabase yang tertera ke daftar *Authorized redirect URIs* di Google Cloud Console.

---

## 3. Menghubungkan ke Aplikasi Next.js

Buka berkas [`.env.local`](file:///c:/Hackaton/.env.local) pada proyek ini, lalu masukkan kredensial dari **Project Settings** > **API**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
```

Setelah kredensial diisi:
- Indikator database di halaman login otomatis berubah menjadi **`Database: Supabase PostgreSQL (Aktif) 🟢`**.
- Pendaftaran email & password langsung tersimpan ke `auth.users` dan tabel `public.profiles`.
- Login Google akan langsung membuka consent screen Google resmi.
- Jika kredensial belum diisi, sistem tetap berjalan mulus dalam mode interaktif (offline/demo fallback).
