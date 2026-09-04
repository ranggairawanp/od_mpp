# Menjalankan lokal dan deploy

## Menjalankan langsung dari disk

Buka `dist/index.html` dengan klik ganda. Tidak perlu server, tidak perlu Node, tidak perlu
koneksi. Struktur modular `index.html` di akar folder juga jalan dari disk, karena seluruh
berkas dimuat lewat tag script biasa, bukan fetch.

Yang sudah diuji lewat protokol `file://` untuk keduanya, dengan `qa/qa-lokal.py`:

- Halaman termuat tanpa satu pun galat konsol
- Font tertanam ikut terpasang, logo tampil
- Siklus penuh berjalan sampai alokasi dibagikan dan matriks bulanan tergambar
- Unggah CSV dari disk terbaca dan validasinya menolak baris bergalat
- Unduh templat CSV berhasil
- Sesi dan data bertahan setelah halaman dimuat ulang

Satu catatan: penyimpanan sesi pada `file://` terikat pada berkas itu sendiri. Kalau kamu
menyalin berkasnya ke folder lain, datanya tidak ikut pindah. Untuk memindahkan keadaan,
pakai Unduh cadangan lalu Pulihkan cadangan di layar Impor & Ekspor.

# Deploy ke GitHub dan Vercel

Aplikasi ini statis murni. Tidak ada build step, tidak ada Node, tidak ada environment variable.

## Cara paling aman: satu berkas

`dist/index.html` berisi seluruh aplikasi dalam satu berkas, termasuk font, gaya, data, dan logika.
Tidak ada rujukan ke berkas lain sama sekali.

- Unggah satu berkas itu ke akar repo dengan nama `index.html`, atau
- Seret berkas itu ke vercel.com/new untuk deploy tanpa GitHub.

Tidak ada folder, jadi tidak ada folder yang bisa hilang saat diunggah.

## Cara kedua: struktur lengkap

Kalau ingin kode tetap terbaca per berkas, unggah seluruh isi folder ini ke akar repo.
Jangan unggah berkas satu per satu lewat antarmuka web GitHub, karena folder bersarang
sering tidak ikut. Pakai salah satu cara berikut:

```
git init
git add .
git commit -m "MPP micro-app modul 0 dan 1"
git branch -M main
git remote add origin https://github.com/<akun>/<repo>.git
git push -u origin main
```

Atau ekstrak zip lalu seret seluruh foldernya sekaligus ke halaman unggah GitHub.

Struktur yang benar, dengan `index.html` di akar repo:

```
index.html
vercel.json
assets/   nabati-ds.css, nabati-fonts.css, nabati-logo.png
data/     master-org.js, master-people.js, users.js, cycles.js, history.js
js/       core/, pages/, app.js
tools/    build-standalone.py
qa/       qa-modul-1.js, qa-deploy.js
dist/     index.html versi satu berkas
```

## Pengaturan project di Vercel

Framework Preset: Other. Build Command: kosong. Output Directory: kosong.
Kalau Vercel salah menebak framework, hasil build kosong dan halaman jadi putih.
Berkas `vercel.json` di akar sudah mengunci ketiganya.

Kalau berkas berada di dalam subfolder di repo, isi Settings, Build and Deployment,
Root Directory dengan nama folder itu, lalu redeploy.

## Membangun ulang berkas tunggal

Setiap kali ada perubahan pada sumber modular, jalankan:

```
python3 tools/build-standalone.py
```

Sumber tetap modular. `dist/index.html` adalah keluaran, bukan tempat menulis kode.

## Kalau halaman masih kosong

1. Buka `https://namaproyek.vercel.app/assets/nabati-ds.css`. Kalau 404, berkasnya tidak terunggah.
2. Buka Console browser. `NB_DATA is not defined` berarti folder `data` tidak termuat.
3. Periksa huruf besar kecil nama berkas. macOS tidak membedakannya, server Vercel membedakan.
4. Buka tab Deployments, Source, dan pastikan seluruh folder benar-benar ada.
