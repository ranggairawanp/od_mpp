# Arsitektur

## 1. Bentuk sekarang

```
index.html                shell tunggal, router hash, satu titik masuk
  assets/                 design system dan font tertanam
  data/*.js               data contoh, menempel ke window.NB_DATA
  js/core/
    simpanan.js           pembungkus sessionStorage yang aman gagal
    format.js             Rupiah, tanggal, bulan, prorata bulan berlaku
    i18n.js               kamus dua bahasa, satu-satunya sumber teks
    ui.js                 helper tampilan, escape, dialog konfirmasi
    rbac.js               kapabilitas, lingkup baris, lingkup kolom biaya
    audit.js              log append only
    store.js              satu-satunya jalur baca dan tulis
  js/domain/
    actions.js            delapan action type dan dampak headcountnya
    validate.js           sebelas aturan validasi baris usulan
    costing.js            komponen people cost dan prorata bulan efektif
    impor.js              parser CSV, templat, definisi berkas unggahan
    report.js             pembuat CSV dan pengunduh
  js/pages/               empat belas layar
  js/app.js               router dan navigasi
```

## 2. Tiga keputusan arsitektur yang menentukan

**Aturan bisnis dipisah dari layar dan dari penyimpanan.** Seluruh isi `js/domain` tidak
menyentuh DOM maupun penyimpanan. Akibatnya aturan bisa diuji tanpa membuka peramban, dan
saat pindah ke backend bisa dibawa hampir apa adanya. Ini yang membuat uji beban 32.000
karyawan tetap berjalan di bawah setengah detik untuk fungsi intinya.

**Satu jalur tulis.** Tidak ada layar yang mengubah data secara langsung. Semua lewat
`NBStore`, dan setiap perubahan menulis entri audit di tempat yang sama. Tanpa aturan ini,
selalu ada satu jalur yang lupa dicatat. Getter mengembalikan salinan, bukan rujukan, supaya
layar tidak bisa menulis diam-diam lewat objek hasil pembacaan.

**Data dikirim sebagai berkas `.js`, bukan `.json`.** Alasannya `fetch` diblokir di protokol
`file://`, sedangkan tag script tidak. Ini yang membuat aplikasi bisa dibuka dengan klik ganda
tanpa server. Bentuk objeknya sama persis dengan kontrak JSON, jadi penggantian ke API hanya
menyentuh lapisan pemuatan.

## 3. Kendali akses tiga sumbu

| Sumbu | Contoh | Ditegakkan di |
|---|---|---|
| Kapabilitas peran | Hanya OD boleh merilis snapshot | `rbac.js` dan penjagaan di setiap fungsi tulis `store.js` |
| Lingkup baris | HOD Marketing hanya melihat departemennya | `NBRbac.filterRows`, dipanggil di setiap getter |
| Lingkup kolom biaya | MPP Monitor tidak pernah melihat nominal | `NBRbac.canSeeCost`, dipanggil per baris di layar |

Sumbu ketiga tidak ada di dokumen bisnis aslinya. Ditambahkan karena tanpa itu peran pemantau
akan melihat gaji seluruh perusahaan.

## 4. Jalur ke produksi

Yang berpindah adalah lapisan penyimpanan dan akses, bukan aturannya.

| Lapisan sekarang | Menjadi |
|---|---|
| `data/*.js` di peramban | PostgreSQL, skema mengikuti `docs/02-MODEL-DATA.md` |
| `store.js` | Klien API tipis, plus service di backend yang memuat `js/domain` apa adanya |
| `rbac.js` di peramban | Penegakan di setiap endpoint, penyaringan lingkup sebelum data dikirim |
| Pemilih persona | SSO korporat, peran diambil dari direktori |
| `simpanan.js` | Tidak ada, keadaan dipegang server |
| `audit.js` | Tabel append only dengan hak tulis terpisah |

Tiga hal yang tidak bisa ditawar saat produksi: autentikasi SSO, penyaringan lingkup di sisi
server sebelum data dikirim ke peramban, dan penegakan kapabilitas di setiap endpoint.

## 5. Perkiraan usaha

Aturan bisnis, validasi, mesin biaya, dan seluruh uji fungsional bisa dipindahkan tanpa
ditulis ulang. Yang harus dibangun baru adalah skema basis data, lapisan API, autentikasi,
dan penyaringan lingkup di server. Antarmukanya bisa dipertahankan sementara, karena sudah
berupa HTML dan CSS biasa tanpa ketergantungan framework.
