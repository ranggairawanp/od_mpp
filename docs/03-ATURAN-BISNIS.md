# Aturan bisnis dan keterlacakannya

Setiap aturan, tempatnya di kode, dan berkas uji yang menjaganya. Kalau sebuah aturan diubah,
berkas uji di kolom terakhir yang harus ikut diperbarui.

## Aturan dari dokumen bisnis

| Kode | Isi | Ditegakkan di | Diuji di |
|---|---|---|---|
| FR-01 | Pengelolaan siklus, buka sampai tutup | `store.buatSiklus`, `ubahStatusSiklus` | qa-modul-1 |
| FR-02 | Snapshot struktur organisasi berversi | `store.rilisSnapshot`, `bandingkanSnapshot` | qa-modul-1, qa-integritas |
| FR-03 | Perencanaan departemen | `store.tambahBaris`, `js/domain/validate.js` | qa-modul-2 |
| FR-04 | Pengiriman dan review | `store.kirimSubmission`, `reviewSubmission` | qa-modul-3 |
| FR-05 | Konsolidasi | `store.konsolidasi`, `kunciKonsolidasi` | qa-modul-4 |
| FR-06 | Perhitungan biaya | `js/domain/costing.js`, `store.biayaSiklus` | qa-modul-5 |
| FR-07 | Keputusan manajemen dan versioning | `store.putuskanBaris`, `setujuiMpp` | qa-modul-6 |
| FR-08 | Monitoring realisasi | `store.catatActual`, `ringkasMonitoring` | qa-modul-8 |
| BR-01 | Bulan efektif wajib | `validate.js` aturan V01 | qa-modul-2 C1 |
| BR-A | Klasifikasi pengganti atau tambahan wajib | `validate.js` aturan V03 | qa-modul-2 C2 |
| BR-D | Mutasi butuh konfirmasi departemen penerima | `store.konfirmasiMutasi`, `actions.mutasiBerlaku` | qa-modul-3 bagian C |
| BR-E | Biaya diprorata bulan berlaku, bukan dikali dua belas | `costing.baris`, `format.bulanBerlaku` | qa-modul-5 bagian C |
| BR-06 | Realisasi melebihi alokasi memicu exception | `store.catatActual` | qa-modul-8 bagian D |
| BR-08 | Setiap perubahan material tercatat | `store.ubah` dan seluruh fungsi tulis | qa-modul-1, qa-keamanan A17 |
| BR-09 | Siklus tertutup hanya bisa dibaca | `store.bolehUbahSiklus` | qa-modul-1 E1, qa-integritas J3 |
| BR-11 | Asumsi biaya bertanggal, tidak pernah ditimpa | `store.asumsiBiaya`, `terapkanImpor` ASUMSI | qa-modul-5 A1, qa-impor G2 |
| BR-F | Grade tujuan dibatasi | `validate.js` aturan V04 | qa-modul-2 C4 |
| BR-H | Penanda keterlambatan terhadap batas pengumpulan | `store.kirimSubmission` | qa-modul-3 A5 |
| BR-I | Headcount departemen tidak boleh negatif | `validate.js` aturan V08 | qa-modul-2 C7 |
| BR-J | Kode posisi unik bila ditandai is_unique | `data/master-people.js`, belum ditegakkan | belum ada |
| BR-K | Perencanaan berbasis karyawan atau posisi | Hibrid, lihat keputusan D2 | qa-modul-2 |

## Aturan validasi baris usulan

| Kode | Isi | Jenis |
|---|---|---|
| V01 | Bulan efektif wajib untuk action yang perlu implementasi | Galat |
| V02 | Kuantitas minimal satu | Galat |
| W02 | Kuantitas di atas lima puluh tidak wajar | Peringatan |
| V03 | Wajib ditandai pengganti atau tambahan | Galat |
| V04 | Grade tujuan wajib dan harus berbeda | Galat |
| V04c | Promosi tidak boleh turun grade | Galat |
| W04 | Lompatan lebih dari satu tingkat grade | Peringatan |
| V05 | Departemen tujuan mutasi wajib dan berbeda | Galat |
| W05 | Mutasi menunggu konfirmasi penerima | Peringatan |
| V06 | Alasan bisnis minimal sepuluh karakter | Galat |
| V07 | Sasaran baris wajib sesuai jenis action | Galat |
| V08 | Headcount tidak boleh menjadi negatif | Galat |
| V09 | Baris turunan wajib menunjuk induk yang sah | Galat |
| V09c | Induk yang sudah diisi langsung tidak boleh punya turunan | Galat |
| W10 | Karyawan yang sama muncul di baris lain | Peringatan |
| V11 | Vacancy harus masih terbuka | Galat |
| V05c, V05d, V05e | Mutasi antar tim: atasan baru wajib, di departemen sama, berbeda dari sekarang | Galat |
| V05f | Mutasi lintas legal entity dilarang | Galat |
| W05b | Mutasi antar tim menunggu konfirmasi HOD | Peringatan |
| W05c | Mutasi antar departemen menunggu OD menetapkan atasan baru; penguncian konsolidasi menolak bila masih kosong | Peringatan |
| V07f | Karyawan ber-NIK sementara belum boleh diusulkan | Galat |
| V05g, V05h | Pindah entitas wajib menyebut departemen tujuan di legal entity lain | Galat |
| W05d | Pindah entitas menunggu HOD tujuan menerima dan memilih posisi | Peringatan |

Peringatan tidak menghalangi pengiriman. Galat menghalangi.

## Aturan yang saya tambahkan sendiri

Ketiganya tidak ada di dokumen bisnis, dan sengaja saya beri tanda supaya tim penerima tahu
mana yang berasal dari dokumen dan mana yang keputusan implementasi.

| Aturan | Alasan | Di mana |
|---|---|---|
| Lingkup kolom biaya | Tanpa ini peran pemantau melihat gaji seluruh perusahaan | `rbac.canSeeCost` |
| ApprovedAllocation sebagai entitas | Monitoring butuh objek yang bisa dikurangi | `store.distribusikanAlokasi` |
| Action type Planned Reduction | Tanpa ini Proposed hanya bisa naik dan tidak akan cocok dengan Actual | `actions.js` |

## Koreksi yang pernah terjadi

Aturan anti double counting semula menolkan seluruh dampak baris turunan Position Creation.
Itu keliru, karena posisi baru yang tidak langsung diisi memang berdampak nol, sehingga
menolkan baris rekrutmen turunannya membuat penambahan headcount hilang. Pembagian yang benar
sekarang: Position Creation hanya menambah bila ditandai diisi langsung, dan rekrutmen
turunannya tetap dihitung. Double counting dicegah aturan V09c. Ditemukan saat QA Modul 4.
