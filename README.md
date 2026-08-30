# MPP Micro-App: Modul 0 dan 1

Prototipe kendali Manpower Planning. HTML, CSS, dan JavaScript tanpa framework dan tanpa build step.
Buka `index.html` langsung dari disk, tidak perlu server.

## Modul 1: Siklus dan Snapshot

- Layar Siklus dan Snapshot. Buat siklus, buka, tutup pengumpulan, tutup, dan buka ulang dengan alasan wajib.
- Transisi status siklus dikunci di store. Jalur mundur hanya lewat buka ulang, dan buka ulang menaikkan versi siklus.
- Siklus tertutup menolak seluruh penulisan (BR-09).
- Rilis snapshot struktur organisasi berversi. Isi snapshot dibekukan saat rilis.
- Layar perbandingan snapshot terhadap master hari ini, sebagai bukti pembekuan.
- Koreksi data master karyawan oleh OD, dengan alasan wajib dan jejak nilai lama ke nilai baru.
- Data historis: siklus MPP 2026 tertutup dengan snapshot 58 baris, dan 6 vacancy terbuka.

## Modul 0: Fondasi

- Shell aplikasi, navigasi sebelas layar, router hash, sakelar ID dan EN.
- Login persona simulasi untuk tujuh pengguna dengan lima peran.
- Kendali akses tiga sumbu: kapabilitas peran, lingkup baris per departemen, dan kolom biaya.
- Audit log append only. Setiap login, logout, perubahan data, dan penolakan akses tercatat.
- Format lokal Indonesia terpusat: Rupiah tanpa desimal, tanggal dan bulan bahasa Indonesia.
- Data master fiktif: 1 entitas, 3 divisi, 7 departemen, 7 cost center, 10 grade, 32 posisi, 62 karyawan.

## Struktur

```
index.html            pemilih persona
app.html              shell
assets/               Nabati FLK Design System
data/*.js             data mock, bentuk objeknya sama dengan kontrak JSON di rencana build
js/core/              simpanan, format, i18n, ui, rbac, audit, store
js/pages/             layar
js/app.js             router dan navigasi
```

## Aturan yang sudah dikunci di kode

- Layar tidak pernah membaca `window.NB_DATA` langsung. Semua lewat `NBStore`.
- Tidak ada jalur tulis selain `NBStore.ubah`, sehingga audit tidak bisa dilewati (BR-08).
- Penyaringan baris hanya terjadi di `NBRbac`, bukan di masing-masing layar.
- Tidak ada satu pun nominal biaya yang dihitung di modul ini. Kolom biaya menampilkan
  "Belum dihitung" sampai Cost Assumption masuk di Modul 5 (BR-11).

## Batas prototipe

Data berada di sisi klien dan bisa dilihat lewat developer tools. Penyaringan lingkup di sini
adalah simulasi kontrol, bukan kontrol keamanan. Produksi wajib menyaring di server dan memakai SSO.
