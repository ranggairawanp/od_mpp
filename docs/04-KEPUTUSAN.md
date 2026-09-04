# Keputusan yang sedang berlaku

Prototipe ini dibangun di atas dua puluh keputusan. Sebagian sudah dikunci pemilik proses,
sebagian masih memakai jawaban default yang saya ajukan. Kolom terakhir menandai mana yang
harus dikonfirmasi ulang sebelum dibawa ke produksi.

| # | Pertanyaan | Jawaban yang berlaku | Sumber | Perlu konfirmasi |
|---|---|---|---|---|
| D1 | Definisi alokasi yang disetujui | Kuantitas headcount per action type per departemen | Default | Ya |
| D2 | Perencanaan berbasis karyawan atau posisi | Hibrid: karyawan untuk promosi, grade, mutasi. Posisi untuk rekrutmen, vacancy, posisi baru | Default | Ya |
| D3 | Satu posisi berapa incumbent | Banyak, kecuali ditandai is_unique | Default | Tidak |
| D4 | Definisi Actual | Tanggal masuk kerja | Default | Ya |
| D5 | Wewenang manajemen saat review | Boleh menurunkan, kenaikan wajib lewat pengembalian | **Dikunci Kang Rangga** | Tidak |
| D6 | Arti bulan efektif | Bulan pergerakan | Default | Ya |
| D7 | Komponen people cost | Tiga belas komponen, lihat daftar di bawah | **Dikunci Kang Rangga** | Tidak |
| D8 | Bonus dan THR | Diprorata bulanan | Default | Ya |
| D9 | Urutan approval | Berurutan HOD, OD, C&B, Management | Default | Ya |
| D10 | Mutasi butuh persetujuan ganda | Ya, dengan status menunggu konfirmasi | Default | Tidak |
| D11 | Realisasi melebihi alokasi | Diblokir untuk penambahan headcount, jenis lain menjadi exception | Default | Ya |
| D12 | Klasifikasi pengganti atau tambahan | Wajib, tanpa itu tidak bisa dikirim | Default | Tidak |
| D13 | Vacancy itu posisi atau kuantitas | Posisi, sebagai objek tersendiri | Default | Tidak |
| D14 | Siapa boleh membuka kunci submission | OD saja | Default | Tidak |
| D15 | Siklus tahunan atau rolling | Tahunan, struktur data sudah menampung rolling | Default | Tidak |
| D16 | Permintaan setelah siklus ditutup | Paket di luar siklus per departemen, lihat F6-1 | Default | Ya |
| D17 | Rentang grade per posisi | Dibatasi, bisa dilampaui dengan alasan | Default | Tidak |
| D18 | Sumber kebenaran data karyawan | Unggahan CSV berversi | Default | Ya |
| D19 | Identitas dan hosting | Pemilih persona tanpa kata sandi | Default | **Ya, wajib** |
| D20 | Pemisahan tugas | Pengusul tidak boleh menjadi penyetuju | Default | Tidak |
| D21 | Angka bulanan di matriks | Posisi akhir bulan, bukan penambahan bulan itu | Default | Ya |
| D22 | Job grade | Delapan belas tingkat, 1A sampai 7 | **Dikunci Kang Rangga** | Tidak |
| D23 | Chart of account | Tidak dipakai, cukup cost center | **Dikunci Kang Rangga** | Tidak |

## Komponen people cost yang dikunci

Gaji pokok, tunjangan grade, tunjangan jabatan, tunjangan komunikasi, tunjangan kehadiran,
tunjangan makan, tunjangan PPh 21 karena gaji net, tunjangan COP/HOP, BPJS Kesehatan bagian
perusahaan, BPJS Ketenagakerjaan bagian perusahaan yaitu JP, JKK, JKM, JHT, dan JKP, asuransi
pihak ketiga, accrual THR, dan accrual bonus.

Dua catatan yang belum tuntas. Pertama, dalam daftar semula tertulis JKN di bawah BPJS
Ketenagakerjaan, sedangkan JKN adalah program BPJS Kesehatan dan komponen kematian di BPJS
Ketenagakerjaan bernama JKM. Dicatat sebagai JKM supaya tidak berbenturan. Kedua, tunjangan
PPh 21 adalah angka isian C&B, bukan hasil hitungan pajak. Perhitungan sungguhan memerlukan
TER bulanan, PTKP, dan penyetahunan Desember, dan itu keputusan tersendiri.

## Yang paling mendesak dikonfirmasi

Tiga yang paling mahal bila salah dan baru ketahuan belakangan: D4 definisi Actual, D8
perlakuan bonus dan THR, dan D21 arti angka bulanan. Ketiganya menggeser angka yang dilihat
manajemen, bukan sekadar tampilan.

## K4: lingkup manajer, dikunci Kang Rangga pada fase 3

| # | Pertanyaan | Jawaban |
|---|---|---|
| 1 | Dasar lingkup manajer | Pohon atasan langsung, dibatasi di dalam departemennya |
| 2 | Kedalaman | Sampai operator. Tampilan awal dilipat di tingkat manajer 5A, dibuka per klik. Grade 6A ke atas melihat semua |
| 3 | Siapa yang mengirim ke OD | Minimal HOD. Manajer menyusun, HOD mengirim satu paket per departemen |
| 4 | Manajer dan HOD mengusulkan orang yang sama | HOD menang, baris manajer ditandai ditimpa dan tetap terlihat |
| 5 | Manajer melihat biaya timnya | Tidak, hanya headcount |
| 6 | Siapa yang dianggap manajer | Otomatis: grade 5A ke atas yang punya bawahan |
| 7 | Mutasi antar tim di dalam departemen | Perlu konfirmasi HOD |
| 8 | Manajer berpindah atasan di tengah siklus | Usulannya tetap di departemen asal |

Tiga keputusan lain di fase yang sama: lima angka utama biaya diisi langsung dan rincian tidak
dijumlahkan (K1 sampai K3), satu akun administrator bawaan untuk aplikasi kosong (K7), dan
pelaporan melingkar ditolak per baris (K8).

## Fase 4: mutasi antar tim dan multi entitas

| # | Keputusan | Jawaban yang berlaku |
|---|---|---|
| F4-1 | Mutasi antar tim di dalam departemen | Action type baru INTERNAL_TRANSFER, netral headcount dan biaya, butuh konfirmasi HOD |
| F4-2 | Lingkup tingkat entitas | scope_type ENTITY dengan scope_ids di berkas pengguna, peran baru HCBP |
| F4-3 | Asumsi biaya per entitas | Kolom entity_id opsional di berkas asumsi; kosong berarti paket umum |
| F4-4 | Mutasi lintas entitas | Ditolak, aturan V05f |
| F4-5 | Siklus | Satu siklus grup, konsolidasi mendapat tingkat per entitas |
| F4-6 | Mata uang | Mengikuti entitas dalam lingkup; lebih dari satu entitas kembali ke Rupiah |

## Rincian F5-2, F5-3, dan F5-5, dikunci Kang Rangga

| # | Pertanyaan | Jawaban |
|---|---|---|
| 1 | Rekrutmen terealisasi tanpa NIK | Karyawan baru dengan NIK sementara berawalan BARU, ditandai sampai diganti |
| 2 | Siapa yang mengganti NIK sementara | Administrator lewat berkas karyawan, kolom `nik_sementara` dipetakan ke NIK asli. Seluruh rujukan ikut berganti |
| 3 | Karyawan ber-NIK sementara diusulkan lagi | Tidak boleh sampai NIK asli masuk, aturan V07f. Formulir tidak menawarkannya |
| 4 | Atasan setelah mutasi antar departemen | Wajib ditetapkan sebelum konsolidasi dikunci. Penguncian ditolak bila ada mutasi terkonfirmasi tanpa atasan baru |
| 5 | Siapa yang menetapkan | OD, di layar Review Usulan. HOD tujuan tetap mengonfirmasi mutasinya |
| 6 | Sumber perbedaan snapshot | Tiga sumber: realisasi MPP, impor berkas karyawan, perubahan master manual |
| 7 | Perbedaan hasil realisasi saat snapshot berikutnya | Diterima apa adanya, tanpa perlakuan khusus |

Seluruh keputusan fase 5 sudah dikunci pemilik proses.

## Fase 5: realisasi ke master dan kurs

| # | Keputusan | Jawaban yang berlaku |
|---|---|---|
| F5-1 | Realisasi menulis ke master | **Dikunci Kang Rangga:** hanya setelah HC menyetujui. MPP Monitor mencatat, OD atau HC Business Partner entitasnya menyetujui, penolakan membatalkan realisasi sekalian. Nilai lama di riwayat revisi, pembatalan mengembalikan |
| F5-2 | Rekrutmen terealisasi | Karyawan baru dengan NIK sementara berawalan BARU bila NIK kosong, atasan awal HOD |
| F5-3 | Pengurangan terealisasi | Status Keluar dengan tanggal, data tidak dihapus |
| F5-4 | Kurs | **Dikunci Kang Rangga:** satu kurs anggaran untuk setahun, yaitu kurs yang berlaku pada 1 Januari tahun siklus. Tabel bertanggal per mata uang ke Rupiah, diunggah C&B, tidak pernah ditimpa. Kurs baru di tengah tahun tidak menggeser angka siklus berjalan |
| F5-5 | Snapshot versus master | Perbedaan menyebut sumbernya: realisasi mana, atau perubahan master |

## Rincian F5-2, F5-3, dan F5-5, dikunci Kang Rangga

| # | Pertanyaan | Jawaban |
|---|---|---|
| 1 | Rekrutmen terealisasi tanpa NIK | Karyawan baru dengan NIK sementara berawalan BARU, ditandai sampai diganti |
| 2 | Siapa yang mengganti NIK sementara | Administrator lewat berkas karyawan, kolom `nik_sementara` dipetakan ke NIK asli. Seluruh rujukan ikut berganti |
| 3 | Karyawan ber-NIK sementara diusulkan lagi | Tidak boleh sampai NIK asli masuk, aturan V07f. Formulir tidak menawarkannya |
| 4 | Atasan setelah mutasi antar departemen | Wajib ditetapkan sebelum konsolidasi dikunci. Penguncian ditolak bila ada mutasi terkonfirmasi tanpa atasan baru |
| 5 | Siapa yang menetapkan | OD, di layar Review Usulan. HOD tujuan tetap mengonfirmasi mutasinya |
| 6 | Sumber perbedaan snapshot | Tiga sumber: realisasi MPP, impor berkas karyawan, perubahan master manual |
| 7 | Perbedaan hasil realisasi saat snapshot berikutnya | Diterima apa adanya, tanpa perlakuan khusus |

Seluruh keputusan fase 5 sudah dikunci pemilik proses.

## Fase 6: permintaan di luar siklus dan kisi perencanaan

| # | Keputusan | Jawaban yang berlaku |
|---|---|---|
| F6-1 | Permintaan di luar siklus (D16) | Paket tambahan per departemen setelah alokasi reguler dibagikan, ditandai "Di luar siklus", melewati review OD dan keputusan manajemen yang sama, menjadi versi persetujuan baru dan alokasi tambahan. Distribusi bertahap: baris yang sudah menjadi alokasi tidak dibuat lagi |
| F6-2 | Yang boleh mengajukan | HOD saja, dengan alasan wajib mengapa tidak masuk siklus reguler |
| F6-3 | Editor kisi (Modul 2B) | Bulan efektif dan kuantitas disunting langsung di tabel, tersimpan begitu sel ditinggalkan lewat jalur ubahBaris yang sama. Baris baru tetap lewat formulir |

Keputusan default ini belum dikonfirmasi pemilik proses.

## Fase 7: master mengikuti realisasi secara utuh

| # | Keputusan | Jawaban yang berlaku |
|---|---|---|
| F7-1 | Posisi baru terealisasi | Posisi dibuat di master saat HC menyetujui realisasi, memakai judul dan grade usulan; baris usulan ikut menunjuknya. Pembatalan menghapusnya |
| F7-2 | Pengurangan terealisasi | Resign, Pensiun, atau Berakhir kontrak membuka vacancy di posisi yang ditinggalkan; Restrukturisasi tidak, posisinya dianggap dihapus |
| F7-3 | Reorganisasi | Pemindahan departemen ke divisi lain di entitas yang sama, oleh OD di layar Administrasi, dengan alasan, tercatat di riwayat revisi dan audit. Snapshot lama tidak berubah. Lintas entitas ditolak |

Keputusan default ini belum dikonfirmasi pemilik proses.

## Fase 8: penanda versi, ringkasan eksekutif, kinerja

| # | Keputusan | Jawaban yang berlaku |
|---|---|---|
| F8-1 | Penanda versi | Nomor build naik setiap kali berkas gabungan dibangun, disimpan di tools/BUILD, tampil di catatan kaki login dan layar Administrasi |
| F8-2 | Ringkasan eksekutif | Layar untuk manajemen, OD, C&B, HCBP: rantai empat state, tiga angka biaya, utilisasi, lima pergerakan terbesar, dan tujuh macam hal yang sedang menunggu, masing-masing menaut ke layarnya |
| F8-3 | Kinerja | Penurunan HOD per departemen di-cache bersama pengguna turunan |

Keputusan default ini belum dikonfirmasi pemilik proses.

## Fase 9: pindah entitas dan mata uang per baris

| # | Keputusan | Jawaban yang berlaku |
|---|---|---|
| F9-1 | Pindah entitas | Bukan mutasi. Pasangan dua baris: Pengurangan Terencana bersebab "Pindah entitas" dengan departemen tujuan di legal entity lain, dan Rekrutmen Eksternal yang dibuat sistem di paket departemen tujuan saat HOD tujuan menerima dan memilih posisi. Keduanya saling tertaut, dibiayai di mata uang masing-masing, headcount grup netral, headcount entitas bergeser. Realisasinya tidak membuka vacancy di asal |
| F9-2 | Mata uang per baris | Layar Biaya menampilkan tiap baris dalam mata uang departemennya dengan lambangnya, disertai padanan Rupiah untuk yang bukan Rupiah. Total tetap Rupiah |

Keputusan default ini belum dikonfirmasi pemilik proses. F9-1 khususnya menyederhanakan proses
berhenti dan diangkat kembali yang di kenyataan menyangkut kontrak, pesangon, dan pajak; yang
dimodelkan di sini hanya dampaknya ke headcount dan biaya MPP.

## Fase 10: ketahanan berkas dari Excel

| # | Keputusan | Jawaban yang berlaku |
|---|---|---|
| F10-1 | Tanggal | Menerima TTTT-BB-HH, HH/BB/TTTT, HH-BB-TTTT, HH.BB.TTTT, dan nomor seri Excel; disimpan selalu TTTT-BB-HH |
| F10-2 | Kode | Spasi tepi dibuang, dibaca tanpa membedakan huruf besar kecil |
| F10-3 | Kepala kolom | Dibaca lentur, dengan alias Indonesia: NIK, Nama, Grade, Departemen, Posisi, Atasan, Tanggal masuk, Status |
| F10-4 | Kode ganda | Kode yang muncul dua kali dalam satu berkas ditolak keduanya dengan nomor barisnya |
| F10-5 | Panduan | Dua belas langkah panduan dijalankan otomatis sebagai satu berkas uji |

Keputusan default ini belum dikonfirmasi pemilik proses.
