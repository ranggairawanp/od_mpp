// Format lokal Indonesia. Satu-satunya tempat angka dan tanggal diformat.
// Aturan tetap: Rupiah tanpa desimal, pemisah ribuan titik, bulan bahasa Indonesia.
(function (global) {
  "use strict";

  var BULAN_ID = ["Januari","Februari","Maret","April","Mei","Juni",
                  "Juli","Agustus","September","Oktober","November","Desember"];
  var BULAN_PENDEK_ID = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  var BULAN_EN = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];
  var BULAN_PENDEK_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  function en() { return global.NBi18n && NBi18n.get() === "en"; }
  function bulanPanjangSet() { return en() ? BULAN_EN : BULAN_ID; }
  function bulanPendekSet() { return en() ? BULAN_PENDEK_EN : BULAN_PENDEK_ID; }

  function angka(n) {
    if (n === null || n === undefined || isNaN(n)) return "-";
    return Math.round(n).toLocaleString("id-ID");
  }

  // Rupiah penuh: Rp27.000.000
  // Mata uang mengikuti entitas yang sedang dilihat (F4-6). Bawaannya Rupiah; layar yang
  // menampilkan entitas lain memanggil setMataUang lebih dulu, lalu mengembalikannya.
  var mataUang = "Rp";
  var LAMBANG = { IDR: "Rp", MYR: "RM", SGD: "S$", PHP: "\u20b1", VND: "\u20ab", THB: "\u0e3f",
                  CNY: "\u00a5", INR: "\u20b9", MMK: "K", KHR: "\u17db", USD: "US$" };
  function setMataUang(kode) { mataUang = LAMBANG[kode] || (kode ? kode + " " : "Rp"); }
  function lambangMataUang(kode) { return LAMBANG[kode] || kode || "Rp"; }

  // Nominal dengan mata uang eksplisit, untuk baris yang mata uangnya berbeda dari lingkup.
  function uang(n, kode) {
    if (n === null || n === undefined || isNaN(n)) return "-";
    var l = lambangMataUang(kode || "IDR");
    return (n < 0 ? "-" + l : l) + angka(Math.abs(n));
  }

  function rupiah(n) {
    if (n === null || n === undefined || isNaN(n)) return "-";
    return (n < 0 ? "-" + mataUang : mataUang) + angka(Math.abs(n));
  }

  // Rupiah ringkas untuk kartu KPI: Rp27,0 jt / Rp1,2 M
  function rupiahRingkas(n) {
    if (n === null || n === undefined || isNaN(n)) return "-";
    var abs = Math.abs(n), tanda = n < 0 ? "-" + mataUang : mataUang;
    if (abs >= 1e9) return tanda + (abs / 1e9).toFixed(1).replace(".", ",") + " M";
    if (abs >= 1e6) return tanda + (abs / 1e6).toFixed(1).replace(".", ",") + " jt";
    return rupiah(n);
  }

  function delta(n) {
    if (!n) return "0";
    return (n > 0 ? "+" : "") + angka(n);
  }

  // "2026-08-30" menjadi "30 Agustus 2026"
  function tanggal(iso) {
    if (!iso) return "-";
    var d = new Date(iso);
    if (isNaN(d)) return "-";
    return d.getDate() + " " + bulanPanjangSet()[d.getMonth()] + " " + d.getFullYear();
  }

  // "2026-08-30" menjadi "30 Agu 2026"
  function tanggalPendek(iso) {
    if (!iso) return "-";
    var d = new Date(iso);
    if (isNaN(d)) return "-";
    return d.getDate() + " " + bulanPendekSet()[d.getMonth()] + " " + d.getFullYear();
  }

  // Jam gaya log aplikasi: 13.35.37 WIB
  function jam(iso) {
    var d = iso ? new Date(iso) : new Date();
    var p = function (x) { return String(x).padStart(2, "0"); };
    return p(d.getHours()) + "." + p(d.getMinutes()) + "." + p(d.getSeconds()) + " WIB";
  }

  // Bulan efektif 1 sampai 12 (BR-01). Bulan 6 berarti berlaku Juni.
  function bulanNama(n) { return bulanPanjangSet()[n - 1] || "-"; }
  function bulanPendek(n) { return bulanPendekSet()[n - 1] || "-"; }

  // Jumlah bulan biaya yang berlaku dalam satu tahun siklus (BR-E).
  // Efektif Juni berarti 7 bulan, bukan 12. Dipakai penuh di Modul 5.
  function bulanBerlaku(bulanEfektif) {
    var m = Number(bulanEfektif);
    if (!m || m < 1 || m > 12) return 0;
    return 13 - m;
  }

  global.NBFormat = {
    setMataUang: setMataUang, lambangMataUang: lambangMataUang, uang: uang,
    angka: angka, rupiah: rupiah, rupiahRingkas: rupiahRingkas, delta: delta,
    tanggal: tanggal, tanggalPendek: tanggalPendek, jam: jam,
    bulanNama: bulanNama, bulanPendek: bulanPendek, bulanBerlaku: bulanBerlaku,
    bulanPanjangSet: bulanPanjangSet, bulanPendekSet: bulanPendekSet
  };
})(window);
