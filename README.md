# Tabungin — PWA Tabungan & Pengeluaran (Versi Lokal, Tanpa Login & Tanpa SQL)

Stack: **HTML5 + CSS3 + Vanilla JS (ES6+) + IndexedDB + Chart.js + Html5-QRCode**.
Tidak ada login, tidak ada Supabase/SQL, tidak ada backend sama sekali — semua data tersimpan 100% di **IndexedDB** browser/perangkat Anda.

## Cara Menjalankan
Wajib lewat server lokal (karena pakai Service Worker), jangan double-click file HTML.

```bash
cd tabungin
python3 -m http.server 8080
```

Lalu buka `http://localhost:8080` di browser. Buka langsung ke Dashboard — tidak ada layar login.

Untuk install sebagai aplikasi (PWA): di Chrome/Edge klik ikon install di address bar, atau di HP pilih menu "Tambahkan ke Layar Utama".

## Catatan Penting
- **Tidak ada akun/login.** Satu profil lokal otomatis dibuat di perangkat (bisa diubah namanya di halaman Profil).
- **Tidak ada server.** Semua data (tabungan, pengeluaran, target, wishlist, challenge, produk hasil scan) disimpan di IndexedDB browser. Kalau Anda hapus data browser/ganti perangkat, data akan hilang — gunakan tombol **Reset Semua Data** di Profil bila ingin mulai ulang.
- **Scan Barcode** tetap berfungsi: kamera/upload foto → cek cache lokal → kalau tidak ketemu, coba cari ke Open Food Facts API (butuh internet) → hasil disimpan otomatis ke database produk lokal.
- File `js/supabase.js` sengaja saya sisakan sebagai **stub kosong** (tanpa request jaringan apa pun) supaya tidak ada error — kalau nanti mau pakai backend lagi, file itu tinggal diisi ulang.

## Fitur yang Berjalan
- Dashboard (animasi angka, grafik 7 hari, aktivitas terbaru)
- Tabungan (tambah/tarik, kategori, riwayat)
- Target Tabungan (progress ring, estimasi hari tersisa)
- Pengeluaran (tambah/hapus, filter kategori, search)
- Scan Barcode (kamera, upload foto, flashlight, Open Food Facts fallback)
- Scan Struk (upload foto, input manual — OCR otomatis belum tersedia, perlu API AI Vision pihak ketiga)
- Wishlist Impian + integrasi progress ke Target
- Challenge Menabung
- Statistik (line/bar/doughnut, filter harian/mingguan/bulanan/tahunan)
- AI Insight (analisis rule-based, jalan 100% di perangkat)
- Dark/Light mode
- Offline mode penuh (IndexedDB)
- PWA installable (manifest + service worker)

## Belum Ada (di luar scope versi ini)
- Login/multi-user, admin panel, OCR struk otomatis, sinkronisasi antar perangkat — semuanya butuh backend yang sengaja kami hilangkan di versi ini.
