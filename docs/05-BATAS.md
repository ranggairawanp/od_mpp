# Batas yang diketahui dan rencana lanjutan

Bagian ini sengaja ditulis tanpa penghalusan. Tim penerima berhak tahu di mana benda ini
patah sebelum memutuskan mau diapakan.

## 1. Batas keras

**Ukuran data.** Uji beban dengan 15 entitas, 120 departemen, dan 31.920 karyawan
menghasilkan basis data 7,8 MB, sedangkan kuota penyimpanan peramban sekitar 5 MB. Kegagalan
penyimpanan sekarang ditampilkan sebagai peringatan, tetapi artinya tetap sama: skala segitu
menuntut basis data di server. Prototipe ini nyaman sampai kira-kira seribu karyawan.

**Keamanan.** Seluruh data ada di sisi klien dan bisa dibaca lewat developer tools.
Penyaringan lingkup adalah simulasi kontrol. Tidak boleh diisi data karyawan sungguhan.

**Autentikasi.** Tidak ada. Pemilih persona tanpa kata sandi.

## 2. Angka uji beban

| Yang diukur | Waktu |
|---|---|
| Merilis snapshot 32.000 baris | 431 ms |
| Membandingkan snapshot dengan master | 19 ms |
| Konsolidasi 120 departemen | 38 ms |
| Menggambar layar Data Organisasi | 596 ms |
| Memuat ulang basis data besar | 66 ms |

Dua optimasi lahir dari uji ini: perbandingan snapshot memakai peta pencarian sehingga tidak
lagi kuadratik, dan tabel organisasi dibatasi dua ratus baris.

## 3. Yang belum ada

| Kebutuhan | Keadaan sekarang |
|---|---|
| Mutasi lintas entitas | Ditolak sebagai mutasi (V05f). Jalur pindah entitas ada sebagai pasangan pengurangan dan rekrutmen, tanpa memodelkan pesangon, kontrak, dan pajak |
| Snapshot beku dengan NIK sementara | Snapshot yang dirilis saat NIK masih sementara tetap memuat NIK lama, karena snapshot tidak pernah diubah |
| Kurs realisasi | Anggaran dan realisasi sama-sama memakai kurs anggaran 1 Januari. Selisih kurs terhadap aktual pembukuan bukan urusan MPP |
| Mesin PPh 21 | Baru kolom isian C&B |
| Integrasi HRIS dan payroll | Baru unggahan CSV manual |
| Notifikasi surel | Baru panel di dashboard |
| Editor kisi penuh | Bulan dan kuantitas bisa disunting di tabel; sasaran, grade tujuan, dan alasan masih lewat formulir |
| Unggahan snapshot langsung dari HRIS | Snapshot disalin dari master di dalam aplikasi |
| Penegakan BR-J kode posisi unik | Field ada, aturannya belum ditegakkan |

Lubang yang ditemukan dan ditutup di fase 7: posisi baru yang terealisasi sebelumnya membuat
karyawan dengan position_id kosong karena posisinya belum pernah ada di master.

## 4. Urutan pekerjaan yang saya sarankan

1. **Konfirmasi tiga keputusan paling mahal** dari `docs/04-KEPUTUSAN.md`, yaitu definisi
   Actual, perlakuan bonus dan THR, dan arti angka bulanan.
2. **Ganti seluruh angka comben** dengan struktur sebenarnya. Struktur job grade 1A sampai 7
   sudah benar, isinya masih karangan.
3. **Jalankan satu siklus penuh bersama OD dan satu HOD sungguhan**, catat di mana mereka
   tersendat. Ini lebih berguna daripada menambah fitur.
4. **Baru putuskan** apakah dilanjutkan sebagai produk internal. Kalau ya, mulai dari skema
   basis data dan lapisan API, bukan dari antarmuka.
5. Kalau dilanjutkan, tambahkan direktorat dan lingkup entitas lebih dulu, karena keduanya
   menyentuh seluruh laporan dan konsolidasi.

## 5. Hutang teknis kecil

- Dialog `prompt` bawaan peramban sudah diganti, tetapi beberapa pesan galat masih memakai
  kunci kamus yang sama untuk konteks berbeda.
- Perbandingan snapshot baru memeriksa empat field.
- Belum ada uji regresi visual berbasis perbandingan gambar, baru pemeriksaan luapan dan
  ukuran ikon.
- Data contoh dan berkas CSV memakai nama fiktif yang mirip nama asli, sebaiknya diganti
  sebelum dipakai pelatihan.
