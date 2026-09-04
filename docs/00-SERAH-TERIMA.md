# Serah terima ke divisi IT

Dokumen ini ditujukan kepada tim yang akan menerima, menilai, dan melanjutkan pekerjaan ini.
Isinya sengaja menyebut batas dan cacat yang diketahui, bukan hanya yang berhasil.

## 1. Apa yang diserahkan

Sebuah prototipe kerja Manpower Planning yang berjalan sepenuhnya di peramban, tanpa server,
tanpa basis data, dan tanpa build step. Delapan belas layar, persona yang diturunkan dari data,
sebelas tahap siklus dari pembukaan sampai penutupan, ditambah permintaan di luar siklus.
Nomor build tercetak di catatan kaki halaman login; sebutkan nomor itu saat melaporkan masalah.

**Ini prototipe proses, bukan calon sistem produksi.** Tujuannya membuktikan bahwa alur MPP
bisa dijalankan sebagai rantai kendali, dan menjadi spesifikasi hidup yang bisa dijalankan.
Yang layak dipertahankan adalah aturan bisnisnya. Yang harus dibuang dan ditulis ulang adalah
lapisan penyimpanan dan autentikasinya.

## 2. Isi arsip

| Folder | Isi | Nasib saat naik produksi |
|---|---|---|
| `js/domain/` | Aturan bisnis murni: action, validasi, biaya, impor, laporan | Dipertahankan, dipindah ke backend hampir apa adanya |
| `js/core/store.js` | Lapisan data, akses, dan audit | Diganti pemanggilan API, tetapi kontraknya dipakai |
| `js/core/` lainnya | RBAC, audit, format, bilingual, penyimpanan, UI helper | Sebagian dipertahankan, RBAC pindah ke server |
| `js/pages/` | Empat belas layar | Dipertahankan sebagai acuan UX, ditulis ulang bila ganti framework |
| `assets/` | Design system Nabati, font tertanam | Dipertahankan |
| `data/` | Data contoh, fiktif seluruhnya | Dibuang, diganti sumber HRIS |
| `contoh/` | Enam berkas CSV dan panduan mencoba | Dipertahankan sebagai bahan uji terima |
| `qa/` | Delapan belas berkas uji fungsional, tiga uji visual | Dipertahankan, diterjemahkan ke kerangka uji pilihan tim |
| `docs/` | Dokumen serah terima ini dan lampirannya | Dipertahankan |
| `dist/index.html` | Seluruh aplikasi dalam satu berkas | Hasil bangunan, bukan sumber |

## 3. Cara menjalankan

Membuka aplikasi tidak butuh apa pun. Klik ganda `dist/index.html`, atau letakkan `index.html`
di akar sebuah web server statis. Sudah diuji berjalan lewat protokol `file://`.

Menjalankan pengujian butuh dua hal:

```
npm install                                          # jsdom
pip install playwright && python3 -m playwright install chromium
bash tools/jalankan-qa.sh
```

Skrip itu membangun ulang berkas gabungan, menjalankan seluruh uji, dan mengembalikan kode
keluar bukan nol bila ada satu saja yang gagal, sehingga bisa langsung dipasang di CI.

## 4. Yang sudah diuji

| Rangkaian | Jumlah | Yang dijaga |
|---|---|---|
| Fungsional per modul | 9 berkas | Alur setiap tahap siklus |
| Integritas | 45 pemeriksaan | Konsistensi angka lintas satu siklus penuh |
| Keamanan | 47 pemeriksaan | Penembusan hak, kebocoran lintas departemen, XSS, injeksi rumus |
| Impor dan struktur | 2 berkas | Validasi unggahan dan penambahan departemen |
| Bahasa | 20 layar | Tidak ada sisa kata Indonesia saat mode Inggris |
| Tata letak | 105 pemeriksaan | Tidak ada luapan horizontal di tujuh lebar layar |
| Ikon | 75 pemeriksaan | Tidak ada SVG yang membesar tak terkendali |
| Beban | 1 berkas | 15 entitas, 120 departemen, 31.920 karyawan |
| Lokal | 26 pemeriksaan | Berjalan penuh dari disk lewat `file://` |

## 5. Yang harus dibaca sebelum menilai

- `docs/01-ARSITEKTUR.md`, kenapa dibangun begini dan apa yang berubah saat naik produksi
- `docs/02-MODEL-DATA.md`, entitas, field kunci, dan relasinya
- `docs/03-ATURAN-BISNIS.md`, setiap aturan dan tempatnya di kode serta ujinya
- `docs/04-KEPUTUSAN.md`, dua puluh keputusan beserta jawaban yang sedang berlaku
- `docs/05-BATAS.md`, batas yang diketahui, angka uji beban, dan urutan pekerjaan berikutnya

## 6. Yang tidak diserahkan dan harus disiapkan sendiri

- Data sungguhan. Seluruh nama, gaji, dan struktur di sini fiktif.
- Angka comben yang benar. Struktur job grade 1A sampai 7 sudah benar, isinya belum.
- Integrasi HRIS dan payroll. Yang ada baru unggahan CSV manual.
- Autentikasi. Yang ada baru pemilih persona tanpa kata sandi.
- Perhitungan PPh 21 sungguhan. Yang ada baru kolom isian dari C&B.

## 7. Pernyataan tanggung jawab

Prototipe ini menyimpan seluruh data di sisi klien dan tidak boleh diisi data karyawan
sungguhan dalam bentuk sekarang. Penyaringan lingkup di dalamnya adalah simulasi kontrol,
bukan kontrol keamanan. Uji keamanan yang ada membuktikan aturan aplikasi berjalan, bukan
bahwa sistemnya aman.
