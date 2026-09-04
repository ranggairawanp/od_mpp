# MPP Micro-App

Prototipe kendali Manpower Planning untuk PT Kaldu Sari Nabati Indonesia.
HTML, CSS, dan JavaScript tanpa framework dan tanpa build step. Buka `dist/index.html`
langsung dari disk, atau letakkan `index.html` di web server statis mana pun.

## Untuk tim yang menerima pekerjaan ini

Baca `docs/00-SERAH-TERIMA.md` lebih dulu. Lima dokumen di folder `docs/` menjelaskan
arsitektur, model data, keterlacakan aturan bisnis, keputusan yang sedang berlaku, dan batas
yang diketahui.

Menjalankan seluruh pengujian:

```
npm install
pip install playwright && python3 -m playwright install chromium
bash tools/jalankan-qa.sh
```

## Fase 3: masukan Dzuhri

Lima masukan dari review OD Lead, semuanya sudah masuk:

1. **Berkas biaya** memakai lima angka utama yang diisi langsung: fixed income, variable income,
   company coverage, accrual THR, accrual bonus. Lima belas rincian ada di sebelahnya sebagai
   keterangan dan tidak pernah dijumlahkan sistem.
2. **Berkas karyawan** membawa atasan langsung dan penempatan lengkap: legal entity, negara,
   direktorat, divisi, departemen. Tingkat direktorat ditambahkan ke hierarki.
3. **Bagan organisasi** digambar otomatis dari atasan langsung, satu kotak satu orang, dilipat
   di tingkat manajer, dengan vacancy dan alokasi belum terisi bergaris putus.
4. **Tidak ada data bawaan.** Aplikasi dikirim kosong dengan satu akun Administrator. Seluruh
   isi berasal dari sepuluh berkas contoh di `contoh/`, dan seluruh pengujian memuat data
   lewat jalur impor yang sama.
5. **Pengguna diturunkan dari pohon.** HOD dan manajer 5A ke atas tidak didaftarkan; sistem
   menurunkannya dari `direct_report_id`. Manajer menyusun untuk timnya, HOD mengirim, dan
   HOD menang bila keduanya mengusulkan orang yang sama.

Keputusan lengkapnya ada di `docs/04-KEPUTUSAN.md` bagian K4.

## Modul 0 sampai 9

Prototipe kendali Manpower Planning. HTML, CSS, dan JavaScript tanpa framework dan tanpa build step.
Buka `index.html` langsung dari disk, tidak perlu server.

## Struktur job grade

Delapan belas grade sesuai struktur Nabati, dari 1A sampai 7. Level dipakai mesin validasi
untuk menentukan promosi naik atau turun, dan menjadi kunci seluruh perhitungan biaya.

| Grade | Sebutan | Grade | Sebutan |
|---|---|---|---|
| 7 | Group CEO | 4A | Specialist |
| 6B | C-Level | 3C | Foreman/Officer |
| 6A | EVP/VP | 3B | Foreman/Officer |
| 5C | VP | 3A | Foreman/Staff |
| 5B | Senior Manager | 2C, 2B, 2A | Operator |
| 5A | Manager | 1C, 1B, 1A | General Worker |
| 4C | Assistant Manager | | |
| 4B | Supervisor/Specialist | | |

Tunjangan jabatan mulai berlaku di 4B, COP/HOP mulai di 5A, tunjangan kehadiran hanya sampai
3C, dan pengali bonus naik bertingkat dari satu kali di kelompok bawah sampai tiga kali di
kelompok 6A ke atas. Angka rupiahnya fiktif dan wajib diganti C&B sebelum dipakai serius.

## Berkas contoh

Folder `contoh/` berisi lima berkas CSV siap pakai untuk PT Kaldu Sari Nabati Indonesia,
beserta `PANDUAN.md` berisi urutan mencoba mesin dari nol sampai matriks bulanan terisi.
Seluruh berkas sudah diuji lewat `qa/qa-berkas-contoh.js`, yang menjalankan impor sungguhan
dan mencetak hasil pemeriksaannya baris per baris.

## Matriks bulanan Januari sampai Desember

Layar Matriks Jan-Des menyajikan lembar MPP dalam bentuk yang biasa dipakai rapat:
tiga pita baris per unit, yaitu Budget, Actual, dan Selisih, dikali dua belas kolom bulan
ditambah kolom posisi Desember.

- Angka bulanan adalah posisi akhir bulan, bukan penambahan pada bulan itu. Rekrutmen
  efektif Maret menaikkan kolom Maret sampai Desember, bukan hanya Maret.
- Budget berasal dari alokasi yang disetujui, actual dari tanggal masuk kerja, dan selisih
  selalu actual dikurangi budget sehingga kekurangan terbaca negatif.
- Dua mode, headcount dan rupiah. Mode rupiah dimulai dari beban gaji berjalan menurut
  snapshot, lalu bertambah mengikuti bulan efektif.
- Dua tingkat, per departemen dan per jabatan.
- Kolom pertama menempel di kiri saat tabel digeser mendatar.
- Laporan R10 mengekspor matriks yang sama lengkap dengan legal entity, negara, divisi,
  departemen, jabatan, dan cost center.

## Impor dan ekspor data

Layar Impor & Ekspor menutup siklus kerja micro-app: unduh templat, isi di Excel,
unggah kembali, lihat pratinjau, baru terapkan.

Empat berkas yang bisa diunggah, masing-masing terikat peran:

| Berkas | Pemilik | Perilaku |
|---|---|---|
| Struktur organisasi | OD | Entitas, negara, divisi, departemen, cost center. Menambah dan memperbarui |
| Master karyawan | OD | Menambah yang baru, memperbarui yang sudah ada |
| Asumsi biaya per grade | C&B | Selalu menjadi paket versi baru, paket lama tidak dihapus |
| Baris usulan MPP | HOD dan OD | Lewat validasi yang sama dengan pengisian di layar |
| Realisasi | HC dan OD | Lewat aturan blokir dan exception yang sama |

- Parser mengenali pemisah titik koma maupun koma, menghormati tanda kutip, dan membuang BOM.
- Baris bergalat tidak menggagalkan seluruh berkas. Yang lolos masuk, yang gagal bisa
  diunduh kembali sebagai CSV lengkap dengan kolom alasan_gagal.
- Setiap berkas juga bisa diekspor isinya, memakai kolom yang sama dengan templatnya,
  sehingga hasil ekspor bisa disunting lalu diunggah lagi.
- Cadangan seluruh keadaan prototipe dalam satu berkas JSON, beserta pemulihannya.
  Hanya OD yang boleh memulihkan.

## Modul 9: Laporan, notifikasi, administrasi, penutupan

- Sembilan laporan bab 30, semuanya membaca fungsi yang sama dengan layarnya sehingga
  angka di ekspor tidak mungkin berbeda dari angka di layar.
- Ekspor CSV memakai titik koma dan BOM UTF-8, supaya Excel dengan locale Indonesia
  membacanya tanpa perlu impor manual. Angka diekspor mentah agar tetap bisa dijumlahkan.
- Laporan biaya hanya muncul untuk peran yang berhak melihat nominal, dan seluruh laporan
  tetap tunduk pada lingkup baris.
- Panel notifikasi di dashboard menggantikan surel yang belum ada, dihitung dari keadaan
  data saat ini sehingga tidak pernah basi.
- Layar administrasi: pengguna dan hak akses, parameter biaya yang hanya bisa dibaca,
  penutupan siklus, dan pengelolaan data prototipe.
- Penutupan siklus diperiksa lebih dulu. Exception menggantung, usulan yang belum direview,
  dan mutasi yang belum dikonfirmasi menghalangi penutupan. Sisa kuota hanya menjadi catatan.
  Penutupan membekukan ringkasan akhir tahun.

## Modul 8: Monitoring realisasi

Dua keputusan default yang dipakai: Actual dihitung sejak tanggal masuk kerja, dan realisasi
melebihi alokasi diblokir untuk penambahan headcount sedangkan jenis lain tetap dicatat
tetapi memunculkan exception yang harus diputuskan OD (BR-06).

- Pencatatan realisasi mengurangi sisa kuota alokasi, bukan menimpa angka Approved.
- Bulan realisasi diambil dari tanggal masuk kerja, dan itulah dasar biaya sebenarnya,
  sehingga biaya realisasi bisa berbeda dari biaya alokasi walau jumlah orangnya sama.
- Pembatalan tidak menghapus catatan, hanya menandainya batal, dan kuota kembali.
- Menolak exception ikut membatalkan realisasi pemicunya supaya angkanya rekonsiliasi.
- Utilisasi per departemen dan perusahaan, plus grafik rencana versus realisasi per bulan.

Satu koreksi dari QA visual: satuan kuota dan satuan headcount sempat tercampur, sehingga
Actual terbaca +5 HC padahal Approved +4 HC. Promosi memakai satu kuota tetapi dampak
headcountnya nol. Keduanya sekarang dipisah dan ditampilkan berdampingan.

## Modul 7: Approved Allocation dan distribusi

Entitas Approved Allocation tidak ada di dokumen aslinya. Saya menambahkannya pada fase
perencanaan sebagai gap nomor 1, karena keputusan manajemen tersimpan terikat sesi review
sedangkan monitoring sepanjang tahun butuh objek yang bisa dikurangi.

- Distribusi mengubah setiap baris yang disetujui menjadi kuota dengan sisa yang bisa
  berkurang. Baris yang ditolak tidak menjadi alokasi sama sekali.
- Kuota mengikuti angka yang disetujui, bukan angka usulan, begitu juga biayanya.
- Tabel Requested, Approved, Variance per departemen sesuai bab 20.
- Distribusi kedua atas paket persetujuan yang sama ditolak.
- Lingkup baris berlaku: HOD hanya melihat alokasi departemennya. Kolom biaya mengikuti
  hak akses kolom, sehingga MPP Monitor tidak melihat nominal apa pun.

## Modul 6: Management review dan versioning

Aturan yang dikunci Kang Rangga, pilihan A: manajemen boleh menurunkan angka, kenaikan
wajib lewat pengembalian ke departemen. Larangan menaikkan dijaga di store, bukan di layar.

- Keputusan per baris: setujui penuh, kurangi dengan alasan wajib, atau tolak dengan alasan wajib.
- Setiap keputusan menaikkan versi baris dan menulis satu entri Revision History berisi
  nilai lama, nilai baru, alasan, aktor, dan versi.
- Biaya disetujui dihitung ulang dari kuantitas yang disetujui, bukan dari kuantitas usulan.
- Persetujuan tingkat siklus ditolak selama masih ada baris yang belum diputuskan.
- Pengembalian ke departemen mengembalikan seluruh usulan yang dikonsolidasikan menjadi
  bisa disunting dan menaikkan versinya. Ini satu-satunya jalur menaikkan angka.
- Kolom Approved di dashboard ikut hidup setelah paket disetujui.

## Modul 5: Mesin biaya

Komponen people cost yang dikunci: gaji pokok, tunjangan grade, tunjangan jabatan,
tunjangan komunikasi, tunjangan kehadiran, tunjangan makan, tunjangan PPh 21 (gaji net),
tunjangan COP/HOP, BPJS Kesehatan bagian perusahaan, BPJS Ketenagakerjaan bagian
perusahaan (JP, JKK, JKM, JHT, JKP), asuransi pihak ketiga, accrual THR, accrual bonus.

- Asumsi biaya bertanggal berlaku. Paket 2026 dan 2027 hidup berdampingan, siklus memakai
  paket yang berlaku pada 1 Januari tahun perencanaannya.
- Dasar iuran adalah upah tetap, yaitu gaji pokok ditambah tunjangan grade dan jabatan.
  BPJS Kesehatan dan JP dibatasi batas upahnya masing-masing.
- Prorata BR-E: biaya tahunan adalah biaya bulanan dikali jumlah bulan berlaku, bukan
  dikali dua belas. Layar menampilkan keduanya berdampingan supaya selisihnya terlihat.
- Promosi dan penyesuaian grade hanya menghitung selisih biaya, bukan biaya penuh.
- Posisi baru berbiaya hanya bila ditandai diisi langsung. Vacancy berbiaya hanya bila diisi.
- Tidak ada satu pun nominal yang ditulis di berkas layar.

Dua catatan yang perlu diputuskan lebih lanjut. Pertama, dalam daftar komponen tertulis JKN
di bawah BPJS Ketenagakerjaan, sedangkan JKN adalah program BPJS Kesehatan dan komponen
kematian di BPJS Ketenagakerjaan bernama JKM. Di sini dicatat sebagai JKM. Kedua, tunjangan
PPh 21 adalah angka yang diisi C&B, bukan hasil hitungan pajak.

## Modul 4: Konsolidasi

- Agregasi perusahaan dari usulan yang sudah diterima OD, dengan tiga tampilan:
  per departemen, per jenis action, dan sebaran dua belas bulan efektif.
- Mutasi hanya berlaku setelah departemen penerima mengonfirmasi, dan selalu netral
  di tingkat perusahaan.
- Daftar pengecualian: usulan yang belum diterima, departemen yang belum mengirim,
  dan mutasi yang masih menunggu.
- Penguncian konsolidasi menghasilkan catatan beku berversi yang menjadi masukan Modul 5.

Koreksi penting dari QA modul ini: aturan baris turunan Position Creation semula menolkan
seluruh dampak, sehingga penambahan headcount hilang ketika posisi baru tidak ditandai
diisi langsung. Sekarang posisi baru hanya menambah bila diisi langsung, dan baris
rekrutmen turunannya tetap dihitung. Double counting dicegah aturan validasi V09c.

## Modul 3: Pengiriman dan review

- Kirim usulan ke OD. Ditolak selama masih ada baris bergalat.
- Penanda keterlambatan terhadap batas pengumpulan siklus (BR-H).
- Review OD: terima atau kembalikan. Pengembalian wajib beralasan dan menaikkan versi usulan.
- Usulan yang sudah dikirim terkunci bagi HOD sampai dikembalikan.
- Konfirmasi mutasi oleh departemen penerima (BR-D). Departemen pengirim tidak bisa
  mengonfirmasi mutasinya sendiri.
- Dialog konfirmasi bergaya design system menggantikan confirm dan prompt bawaan browser
  di seluruh aplikasi.

## Modul 2A: Mesin action dan perencanaan

- Delapan action type di `js/domain/actions.js`. Tujuh dari dokumen, plus Planned Reduction
  yang saya tambahkan karena tanpa itu Proposed hanya bisa naik.
- Dampak headcount dihitung dari definisi action, tidak pernah dari angka yang diketik.
- Pencegah double counting: hiring yang menjadi turunan Position Creation berdampak nol.
- Sebelas aturan validasi di `js/domain/validate.js`, terpisah dari layar sehingga bisa diuji sendiri.
- Layar MPP Planning: tabel usulan, tambah, ubah, hapus, dan penanda validasi per baris.
- Bidang formulir mengikuti definisi action, jadi menambah action type tidak perlu menyentuh layar.
- Kolom Proposed di dashboard sekarang berisi angka nyata.

## Modul 1: Siklus dan Snapshot

- Layar Siklus dan Snapshot. Buat siklus, buka, tutup pengumpulan, tutup, dan buka ulang dengan alasan wajib.
- Transisi status siklus dikunci di store. Jalur mundur hanya lewat buka ulang, dan buka ulang menaikkan versi siklus.
- Siklus tertutup menolak seluruh penulisan (BR-09).
- Rilis snapshot struktur organisasi berversi. Isi snapshot dibekukan saat rilis.
- Layar perbandingan snapshot terhadap master hari ini, sebagai bukti pembekuan.
- Koreksi data master karyawan oleh OD, dengan alasan wajib dan jejak nilai lama ke nilai baru.
- Data historis: siklus MPP 2026 tertutup dengan snapshot 58 baris, dan 6 vacancy terbuka.

## QA Modul 1

Tiga berkas QA otomatis di DOM sungguhan (jsdom):

- `qa/qa-modul-1.js`, 36 pemeriksaan fungsional
- `qa/qa-deploy.js`, 12 pemeriksaan alur login dan berkas gabungan
- `qa/qa-bahasa.js`, pemeriksaan setiap layar bebas kata Indonesia saat mode EN
- `qa/qa-integritas.js`, 45 pemeriksaan konsistensi angka lintas satu siklus penuh
- `qa/qa-keamanan.js`, 47 pemeriksaan keamanan defensif
- `qa/qa-ikon.py`, 70 pemeriksaan ukuran ikon: lima persona dikali empat belas layar,
  menolak SVG yang melebihi 48 piksel
- `qa/qa-tataletak.py`, 98 pemeriksaan luapan horizontal: tiga belas layar dikali tujuh
  lebar layar, dari 390 sampai 1440. Butuh playwright dan chromium.

Pemeriksaan modul 1 mencakup:
salinan data, validasi siklus, alur rilis snapshot, pembekuan, BR-09, reset, pemisahan peran,
kebocoran angka lintas lingkup, escaping, dan pergantian bahasa.

```
npm install jsdom
node qa/qa-modul-1.js
```

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

## Hasil uji beban: 15 entitas, 32.000 karyawan

`qa/qa-beban.js` membangkitkan 15 legal entity, 120 departemen, dan 31.920 karyawan,
lalu mengukur fungsi inti. Angka sesudah dua optimasi yang dipicu uji ini:

| Yang diukur | Sebelum | Sesudah |
|---|---|---|
| Merilis snapshot 32.000 baris | 487 ms | 431 ms |
| Membandingkan snapshot dengan master | 5.144 ms | 19 ms |
| Konsolidasi 120 departemen | 37 ms | 38 ms |
| Menggambar layar Data Organisasi | 44.781 ms | 596 ms |
| Ukuran cadangan JSON | 7,8 MB | 7,8 MB |

Dua perbaikan yang lahir dari uji ini: pencarian karyawan di dalam perulangan diganti peta
pencarian sehingga perbandingan snapshot tidak lagi kuadratik, dan tabel organisasi dibatasi
200 baris dengan penunjuk jumlah sisanya.

Penghalang yang tidak bisa diperbaiki di dalam prototipe: data 7,8 MB melampaui kuota
penyimpanan peramban yang sekitar 5 MB. Kegagalannya kini ditampilkan sebagai peringatan,
bukan ditelan diam-diam, tetapi artinya tetap sama. Skala segitu menuntut basis data di
server, bukan penyimpanan di sisi klien.

## Hasil uji integritas dan keamanan

Uji integritas menjalankan satu siklus penuh dari nol, lalu memeriksa apakah setiap angka
masih bisa diturunkan dari angka lain: total departemen versus total perusahaan, kuota
alokasi versus keputusan manajemen, biaya versus kuantitas dan bulan berlaku, realisasi
versus kuota, laporan versus sumbernya, dan ringkasan penutupan versus monitoring saat
ditutup. Empat puluh lima pemeriksaan, semuanya lolos.

Uji keamanan menyerang aplikasi lewat jalur yang tersedia bagi pengguna. Dua temuan nyata,
keduanya sudah ditutup:

1. Injeksi rumus lewat ekspor CSV. Sel yang diawali sama dengan, tambah, kurang, atau at
   dieksekusi sebagai rumus oleh Excel dan Google Sheets. Nama karyawan atau alasan bisnis
   yang diketik seseorang bisa berubah menjadi perintah di mesin orang lain. Sekarang sel
   seperti itu diawali tanda kutip tunggal, sementara angka dibiarkan apa adanya supaya
   biaya negatif tetap bisa dijumlahkan.
2. Audit bisa diubah lewat hasil pembacaan. `semua()` mengembalikan salinan dangkal, jadi
   entrinya masih objek yang sama dan isinya bisa ditimpa. Sekarang yang keluar salinan dalam.

Yang tetap harus disebut: prototipe ini berjalan sepenuhnya di browser. Seluruh data ada di
sisi klien dan bisa dibaca siapa pun yang membuka developer tools. Uji ini membuktikan aturan
aplikasi berjalan, bukan bahwa sistemnya aman. Kontrol yang sesungguhnya harus dipasang di
server: autentikasi SSO, penyaringan lingkup sebelum data dikirim ke browser, dan penegakan
kapabilitas di setiap endpoint.

## Batas prototipe

Data berada di sisi klien dan bisa dilihat lewat developer tools. Penyaringan lingkup di sini
adalah simulasi kontrol, bukan kontrol keamanan. Produksi wajib menyaring di server dan memakai SSO.
