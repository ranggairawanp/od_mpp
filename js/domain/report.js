// Pembangun laporan dan ekspor. Sembilan laporan bab 30, semuanya diturunkan dari data
// yang sudah ada, tanpa satu pun angka yang dihitung ulang di sini dengan cara berbeda.
//
// Ekspor memakai titik koma sebagai pemisah kolom, karena Excel dengan locale Indonesia
// membaca koma sebagai pemisah desimal. Angka diekspor mentah tanpa titik ribuan supaya
// tetap bisa dijumlahkan di spreadsheet.
(function (global) {
  "use strict";

  // Temuan uji keamanan: sel yang diawali sama dengan, tambah, kurang, atau at akan
  // dieksekusi sebagai rumus oleh Excel dan Google Sheets saat berkas dibuka. Nama karyawan
  // atau alasan bisnis yang diketik seseorang bisa berubah menjadi perintah di mesin orang
  // lain. Sel seperti itu diawali tanda kutip tunggal supaya dibaca sebagai teks.
  //
  // Angka tidak pernah ikut dilindungi, karena biaya negatif diawali tanda kurang dan
  // harus tetap bisa dijumlahkan di spreadsheet.
  function angkaMurni(v) {
    if (typeof v === "number") return true;
    var t = String(v).trim();
    return t !== "" && /^-?\d+([.,]\d+)?$/.test(t);
  }

  function sel(v) {
    if (v === null || v === undefined) return "";
    var t = String(v);
    if (!angkaMurni(v) && /^[=+\-@\t\r]/.test(t)) t = "'" + t;
    return /[";\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  }

  function keCsv(kolom, baris) {
    var isi = [kolom.map(function (k) { return sel(k.label); }).join(";")];
    baris.forEach(function (b) {
      isi.push(kolom.map(function (k) { return sel(b[k.kunci]); }).join(";"));
    });
    return "\uFEFF" + isi.join("\r\n");   // BOM supaya Excel membaca UTF-8 dengan benar
  }

  // Unduh berkas di sisi klien. Kalau lingkungan memblokir unduhan, kembalikan false
  // supaya layar bisa menawarkan salin ke papan klip.
  function unduh(namaBerkas, isi, tipe) {
    try {
      var blob = new Blob([isi], { type: (tipe || "text/csv") + ";charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = namaBerkas;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
      return true;
    } catch (e) { return false; }
  }

  global.NBReport = { keCsv: keCsv, unduh: unduh };
})(window);
