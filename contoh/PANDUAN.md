# Berkas contoh: PT Kaldu Sari Nabati Indonesia

Aplikasi dikirim kosong. Seluruh isinya berasal dari berkas di folder ini, diunggah lewat
layar Impor & Ekspor. Semua berkas sudah diuji benar-benar bisa diimpor ke aplikasi kosong,
bukan sekadar contoh format.

| Berkas | Diunggah sebagai | Isi |
|---|---|---|
| `00-organisasi.csv` | Administrator, jenis Struktur organisasi | 1 entitas, 3 direktorat, 3 divisi, 7 departemen, 7 cost center |
| `01-posisi.csv` | Administrator, jenis Posisi | 32 posisi |
| `02-karyawan.csv` | Administrator, jenis Karyawan | 62 karyawan lengkap dengan atasan langsung |
| `03-vacancy.csv` | Administrator, jenis Vacancy | 6 vacancy terbuka |
| `04-pengguna.csv` | Administrator, jenis Pengguna | 7 pengguna non-lini dan HOD yang ditautkan ke karyawan |
| `05-asumsi-biaya.csv` | C&B, jenis Asumsi biaya | 18 grade dengan lima angka utama dan lima belas rincian |
| `06-usulan-mpp.csv` | OD, jenis Usulan | 5 usulan Marketing dan Produksi |
| `07-organisasi-tambahan.csv` | Administrator, jenis Struktur | 7 departemen tambahan, menjadikan totalnya 14 |
| `08-usulan-bergalat.csv` | OD, jenis Usulan | 7 baris yang sengaja salah, semuanya harus ditolak |
| `09-usulan-lintas-departemen.csv` | OD, jenis Usulan | 16 usulan di enam departemen, seluruh delapan action type |

## Entitas kedua, untuk mencoba multi legal entity

| Berkas | Diunggah sebagai | Isi |
|---|---|---|
| `10-entitas-malaysia.csv` | Administrator, Struktur | Nabati Malaysia Sdn Bhd, mata uang MYR, dua departemen |
| `11-posisi-malaysia.csv` | Administrator, Posisi | 5 posisi |
| `12-karyawan-malaysia.csv` | Administrator, Karyawan | 7 karyawan, dua pohon |
| `13-pengguna-malaysia.csv` | Administrator, Pengguna | Satu HC Business Partner berlingkup entitas Malaysia |
| `14-asumsi-biaya-malaysia.csv` | C&B, Asumsi biaya | Angka dalam Ringgit, hanya berlaku untuk entitas itu |
| `15-kurs.csv` | C&B, Kurs | Kurs Ringgit ke Rupiah, dua tanggal berlaku |

Setelah `15-kurs.csv` diunggah, mode Rupiah di Matriks Jan-Des mengonversi baris Malaysia ke
Rupiah dengan kurs yang berlaku pada 1 Januari tahun siklus, dan total perusahaan di layar
Biaya menjadi bermakna lintas entitas.

Setelah kelimanya diunggah: masuk sebagai Nurul Aini, dia hanya melihat Malaysia dan seluruh
nominalnya berlambang RM. Konsolidasi mendapat tab Per legal entity. Mutasi dari Produksi Wafer
ke Produksi Johor ditolak, karena mutasi lintas entitas bukan mutasi biasa.

## Yang tidak perlu diunggah

HOD dan manajer. Keduanya diturunkan otomatis dari kolom `direct_report_id` di berkas karyawan:
orang yang atasannya berada di luar departemennya menjadi HOD, dan setiap orang grade 5A ke
atas yang punya bawahan menjadi manajer. Dari 62 karyawan contoh terbentuk 7 HOD dan 3 manajer
tanpa satu pun didaftarkan.

## Urutan mencoba, sekitar dua puluh menit

1. Buka aplikasi. Hanya ada satu persona, **Administrator**. Masuk, buka Impor & Ekspor.
2. Unggah berkas `00` sampai `04` berurutan, masing-masing dengan jenis yang tertulis di tabel.
   Setelah `02-karyawan`, keluar dan lihat halaman depan: lima belas persona sudah terbentuk.
3. Masuk sebagai **Windha Falosa (C&B)**, unggah `05-asumsi-biaya.csv`.
4. Masuk sebagai **M. Dzuhri (OD)**. Buka Siklus, buat siklus 2027, klik **Buka siklus**, lalu
   **Rilis V1**. Snapshot ini menjadi posisi awal setiap bulan di matriks.
5. Masih sebagai OD, unggah `06-usulan-mpp.csv` sebagai Usulan.
6. Masuk sebagai salah satu manajer turunan, misalnya **Anisa Hartono**. Buka MPP Planning:
   dia hanya melihat timnya dan tidak punya tombol kirim. Tambah satu baris untuk bawahannya.
7. Masuk sebagai **Ratna Puspita (HOD Marketing)**. Usulkan orang yang sama: baris manajer
   ditandai ditimpa HOD. Kirim usulan Marketing dan Produksi.
8. Sebagai OD: Review Usulan, terima semuanya, Konsolidasi, kunci. Sebagai **Frans BS**:
   Management Review, putuskan, Setujui MPP. Sebagai OD: Approved MPP, distribusikan alokasi.
9. Buka **Bagan Organisasi**. Klik kotak berlingkaran angka untuk membuka bawahan. Kotak garis
   putus biru adalah alokasi yang disetujui tetapi belum terisi. Coba unduh SVG.
10. Buka **Matriks Jan-Des**. Coba tingkat Per jabatan dan mode Rupiah.
11. Unggah `08-usulan-bergalat.csv`: tidak ada satu pun yang masuk, tujuh alasan berbeda.
12. Unggah `07-organisasi-tambahan.csv`: departemen menjadi empat belas, halaman depan ikut.

## Realisasi menulis ke master

Sejak fase 5, realisasi yang disetujui HC mengubah data karyawan. Alurnya: MPP Monitor mencatat,
lalu OD membuka tab Persetujuan HC di layar Monitoring dan menyetujui atau menolak. Menolak
membatalkan realisasinya sekalian. Setelah disetujui: promosi mengubah grade, mutasi
memindahkan departemen, mutasi antar tim mengganti atasan, pengurangan menandai Keluar, dan
rekrutmen membuat karyawan baru. Kalau NIK belum terbit, isi kosong dan sistem memberi NIK
sementara berawalan BARU yang ditandai di layar Organisasi. Orang itu belum boleh diusulkan di
siklus berikutnya sampai NIK aslinya masuk lewat berkas karyawan dengan kolom `nik_sementara`
berisi NIK lamanya. Untuk mutasi antar departemen, OD wajib menetapkan atasan baru di layar
Review Usulan sebelum konsolidasi bisa dikunci.
Membatalkan realisasi mengembalikan semuanya, dan jejaknya ada di riwayat revisi serta di
perbandingan snapshot dengan sumber "Realisasi".

## Untuk Frans BS

Layar **Ringkasan Eksekutif** adalah satu halaman yang cukup dibuka manajemen: rantai Current,
Proposed, Approved, Actual, tiga angka biaya, utilisasi, lima pergerakan terbesar, dan daftar
apa yang sedang menunggu siapa, masing-masing bisa diklik ke layarnya.

## Setelah alokasi dibagikan

Di MPP Planning, bulan efektif dan kuantitas bisa diubah langsung di tabel tanpa membuka
formulir. Kalau di tengah tahun ada kebutuhan baru, HOD menekan **Ajukan permintaan di luar
siklus** di panel status. Paket tambahan itu melewati review OD dan keputusan Frans BS yang
sama, lalu menjadi alokasi tambahan tanpa mengganggu alokasi yang sudah berjalan.

## Kalau berkasnya dari Excel

Tidak perlu merapikan apa pun. Tanggal boleh ditulis 15/03/2027, angka boleh 12.840.000,
kode boleh huruf kecil atau ada spasinya, dan kepala kolom boleh ditulis "Employee ID" atau
"NIK". Sistem menormalkannya saat membaca. Yang ditolak hanya kode yang muncul dua kali dalam
satu berkas, dan keduanya disebutkan nomor barisnya.

## Catatan

Angka rupiah di `05-asumsi-biaya.csv` masih karangan. Lima kolom utama, yaitu fixed_income,
variable_income, company_coverage, accrual_thr, accrual_bonus, adalah yang dipakai sistem.
Lima belas kolom rincian hanya keterangan dan tidak pernah dijumlahkan.

Data tersimpan di tab peramban. Untuk memindahkan keadaan yang sudah disiapkan ke mesin lain,
pakai Unduh cadangan lalu Pulihkan cadangan di layar Impor & Ekspor.
