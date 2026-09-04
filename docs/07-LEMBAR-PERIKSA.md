# Lembar periksa review

Untuk: M. Dzuhri. Isi kolom terakhir dengan Ya, Tidak, atau catatan pendek.
Bagian A sampai E bisa dikerjakan sambil mengikuti `PANDUAN.md`. Bagian F dikerjakan terakhir.

---

## A. Alur proses, apakah cocok dengan kenyataan

| # | Yang diperiksa | Cara memeriksa | Cocok? |
|---|---|---|---|
| A1 | Urutan sebelas tahap | Layar Siklus sampai Monitoring, ikuti panduan | |
| A2 | Pemilik setiap tahap | Ganti persona di tiap tahap, lihat siapa yang punya tombol | |
| A3 | Snapshot sebagai titik mulai | Layar Siklus, klik Rilis V1 sebelum departemen menyusun | |
| A4 | Ada tahap yang tidak ada di dunia nyata | | |
| A5 | Ada tahap nyata yang belum ada di sini | | |

---

## B. Aturan yang mengikat, apakah terlalu longgar atau terlalu ketat

| # | Aturan yang berlaku sekarang | Cara mencobanya | Setuju? |
|---|---|---|---|
| B1 | Usulan tidak bisa dikirim selama ada baris bergalat | Unggah `04-usulan-bergalat.csv`, semua ditolak | |
| B2 | Setelah dikirim, HOD tidak bisa mengubah lagi | Kirim usulan Marketing, lalu coba tambah baris | |
| B3 | Pengembalian oleh OD wajib beralasan minimal sepuluh karakter | Layar Review Usulan, klik Kembalikan, isi satu kata | |
| B4 | Manajemen boleh menurunkan, tidak boleh menaikkan | Management Review, klik Kurangi, isi angka lebih besar dari usulan | |
| B5 | Persetujuan ditolak selama ada baris belum diputuskan | Klik Setujui MPP sebelum semua baris diputuskan | |
| B6 | Mutasi baru berlaku setelah departemen penerima konfirmasi | Buat mutasi, lihat Konsolidasi sebelum dan sesudah konfirmasi | |
| B7 | Realisasi melebihi kuota diblokir untuk rekrutmen | Monitoring, catat realisasi melebihi sisa kuota | |
| B8 | Siklus tidak bisa ditutup selama ada exception menggantung | Administrasi, tab Penutupan siklus | |
| B9 | Alasan bisnis wajib minimal sepuluh karakter | MPP Planning, tambah baris dengan alasan satu kata | |
| B10 | Bulan efektif wajib diisi | Tambah baris rekrutmen tanpa bulan | |

---

## C. Angka dan definisi, ini yang paling menentukan

| # | Yang harus Anda putuskan | Yang berlaku sekarang | Jawaban Anda |
|---|---|---|---|
| C1 | Actual dihitung sejak kapan | Tanggal masuk kerja | |
| C2 | Angka bulanan di Matriks Jan-Des | Posisi akhir bulan, jadi rekrutmen Maret menaikkan Maret sampai Desember | |
| C3 | Bulan efektif artinya apa | Bulan pergerakan, bukan bulan payroll | |
| C4 | Bonus dan THR | Diprorata bulanan, bukan dibebankan penuh saat dibayar | |
| C5 | Alokasi yang disetujui mengikat apa | Kuantitas headcount per jenis action per departemen | |
| C6 | Permintaan di luar siklus | Belum ada jalurnya sama sekali | |
| C7 | Selisih di matriks | Actual dikurangi budget, kekurangan terbaca negatif | |

---

## D. Hak akses, apakah pembagiannya benar

| # | Yang diperiksa | Cara memeriksa | Benar? |
|---|---|---|---|
| D1 | HOD hanya melihat departemennya | Masuk sebagai Ratna Puspita, buka Data Organisasi | |
| D2 | MPP Monitor tidak pernah melihat nominal | Masuk sebagai Cahyangga, buka Monitoring dan Approved MPP | |
| D3 | HOD melihat biaya departemennya sendiri | Masuk sebagai Ratna, buka Biaya | |
| D4 | C&B tidak bisa menyetujui MPP | Masuk sebagai Windha, buka Management Review | |
| D5 | Hanya OD yang mengelola siklus dan snapshot | Masuk sebagai HOD, buka Siklus | |
| D6 | Apakah ada peran yang kelebihan atau kekurangan wewenang | | |

---

## E. Kelengkapan isi

| # | Yang diperiksa | Ada? | Catatan |
|---|---|---|---|
| E1 | Delapan jenis action sudah cukup | | Tanpa Perubahan, Promosi, Penyesuaian Grade, Mutasi, Rekrutmen, Tindakan Vacancy, Posisi Baru, Pengurangan Terencana |
| E2 | Komponen people cost lengkap | | Layar Biaya, tab Asumsi biaya |
| E3 | Kolom di Matriks Jan-Des sudah sesuai lembar MPP yang biasa dipakai | | Entitas, negara, divisi, departemen, jabatan, cost center |
| E4 | Sembilan laporan sudah menutup kebutuhan | | Layar Laporan |
| E5 | Tingkat direktorat belum ada, apakah perlu | | Hierarki sekarang entitas, divisi, departemen |
| E6 | Struktur job grade 1A sampai 7 sudah benar | | Layar Biaya, tab Asumsi biaya |

---

## F. Penilaian akhir

| # | Pertanyaan | Jawaban |
|---|---|---|
| F1 | Bagian mana dari proses MPP hari ini yang paling makan waktu | |
| F2 | Apakah prototipe ini memangkasnya, atau justru menambah langkah | |
| F3 | Tahap mana yang paling membingungkan saat Anda coba | |
| F4 | Kalau hanya boleh memperbaiki tiga hal, mana yang Anda pilih | |
| F5 | Layak dilanjutkan menjadi sistem sungguhan, atau cukup sebagai alat bantu | |

---

## Yang bukan bahan review

Seluruh angka rupiah masih karangan, menunggu Windha mengganti dengan struktur sebenarnya.
Nama karyawan, dan departemen di luar tujuh yang ada, juga fiktif. Kecepatan, keamanan, dan
kesiapan teknis bukan wilayah review ini, itu bagian tim IT.

Yang paling berguna buat saya bukan daftar keinginan fitur, melainkan kalimat seperti "di
tahap ini saya bingung", "angka ini tidak saya percaya", atau "di kenyataannya bukan begini".
Sebutkan nama layarnya supaya saya bisa langsung menemukan tempatnya.
