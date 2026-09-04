// Pembungkus penyimpanan sesi. Dipakai hanya untuk simulasi sesi, draft, dan audit prototipe.
// Kalau sessionStorage diblokir (mode privat, iframe terkunci), otomatis jatuh ke memori
// sehingga aplikasi tetap jalan, hanya kehilangan jejak saat berpindah halaman.
//
// Data HR sungguhan tidak boleh disimpan di sini. Lihat peringatan di store.js.
(function (global) {
  "use strict";
  var memo = {};
  var kunciDipakai = ["nb_mpp_user", "nb_mpp_audit"];

  function get(k) {
    try { var v = sessionStorage.getItem(k); return v === null ? (memo[k] || null) : v; }
    catch (e) { return memo[k] || null; }
  }
  var gagalTerakhir = null;

  // Kegagalan penyimpanan tidak boleh ditelan diam-diam. Pada data besar, kuota
  // sessionStorage sekitar 5 MB akan terlampaui, dan tanpa penanda ini pengguna
  // baru sadar datanya hilang setelah berpindah layar.
  function set(k, v) {
    memo[k] = v;
    try { sessionStorage.setItem(k, v); gagalTerakhir = null; return true; }
    catch (e) {
      gagalTerakhir = { kunci: k, ukuran: v ? v.length : 0, waktu: new Date().toISOString() };
      return false;
    }
  }

  function statusSimpan() { return gagalTerakhir; }
  function hapus(k) {
    delete memo[k];
    try { sessionStorage.removeItem(k); } catch (e) { /* memori saja */ }
  }
  function bersihkan() { kunciDipakai.forEach(hapus); }

  global.NBSimpanan = { get: get, set: set, hapus: hapus, bersihkan: bersihkan,
                        statusSimpan: statusSimpan };
})(window);
