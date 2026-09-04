// Fixture pengujian. Aplikasi dikirim kosong, jadi setiap uji memuat data lewat jalur impor
// yang sama persis dengan yang dipakai pengguna. Dengan begitu pengujian ikut menjaga bahwa
// impornya sendiri benar, dan data uji tetap sama dengan berkas contoh yang diterima Dzuhri.
const fs = require("fs");
const AKAR = "/home/claude/mpp";

function baca(nama) { return fs.readFileSync(AKAR + "/contoh/" + nama, "utf8"); }

// Mengunggah satu berkas sebagai pengguna tertentu. Mengembalikan hasil penerapan.
function unggah(w, userId, kode, nama, cycleId) {
  const S = w.NBStore, I = w.NBImpor;
  S.keluar(); S.masuk(userId);
  const u = I.urai(baca(nama));
  const cek = I.periksaKepala(kode, u.kolom);
  if (!cek.ok) throw new Error("kepala " + nama + ": " + cek.kunci + " " + JSON.stringify(cek.vars || {}));
  const hasil = S.terapkanImpor(kode, u.baris, cycleId || null);
  if (!hasil.ok) throw new Error("impor " + nama + ": " + hasil.kunci);
  if (hasil.galat.length) {
    throw new Error("impor " + nama + " menolak " + hasil.galat.length + " baris: " +
      hasil.galat.slice(0, 3).map(g => g.baris._baris + " " + g.kunci + " " + JSON.stringify(g.vars || {})).join("; "));
  }
  return hasil;
}

// Data master lengkap: struktur, posisi, karyawan, vacancy, pengguna, asumsi biaya.
// Setelah ini, tujuh persona lama tersedia dan tidak ada siklus.
function master(w) {
  unggah(w, "U-ADMIN", "ORGANISASI", "00-organisasi.csv");
  unggah(w, "U-ADMIN", "POSISI", "01-posisi.csv");
  unggah(w, "U-ADMIN", "KARYAWAN", "02-karyawan.csv");
  unggah(w, "U-ADMIN", "VACANCY", "03-vacancy.csv");
  unggah(w, "U-ADMIN", "PENGGUNA", "04-pengguna.csv");
  unggah(w, "U-CB-01", "ASUMSI", "05-asumsi-biaya.csv");
  w.NBStore.keluar();
}

// Dua siklus seperti data bawaan lama: MPP-2026 ditutup dengan snapshot, MPP-2027 draft.
function siklus(w) {
  const S = w.NBStore;
  S.keluar(); S.masuk("U-OD-01");
  const c26 = S.buatSiklus({ year: 2026, start_date: "2025-09-01", end_date: "2026-12-31",
                              submission_deadline: "2025-10-15" });
  if (!c26.ok) throw new Error("siklus 2026: " + c26.kunci);
  S.ubahStatusSiklus("MPP-2026", "OPEN");
  S.rilisSnapshot("MPP-2026", "2025-09-01");
  S.ubahStatusSiklus("MPP-2026", "LOCKED");
  S.ubahStatusSiklus("MPP-2026", "CLOSED", null);
  const c27 = S.buatSiklus({ year: 2027, start_date: "2026-09-01", end_date: "2027-12-31",
                              submission_deadline: "2026-10-15" });
  if (!c27.ok) throw new Error("siklus 2027: " + c27.kunci);
  S.keluar();
}

// Lima baris usulan bawaan lama (LI-0001 sampai LI-0005) di MPP-2027. Siklus harus OPEN.
function usulan(w) {
  const S = w.NBStore;
  S.keluar(); S.masuk("U-OD-01");
  if ((S.siklus("MPP-2027") || {}).status === "DRAFT") S.ubahStatusSiklus("MPP-2027", "OPEN");
  unggah(w, "U-OD-01", "USULAN", "06-usulan-mpp.csv", "MPP-2027");
  S.keluar();
}

// Paket lengkap: master, dua siklus, MPP-2027 dibuka, lima baris usulan.
function lengkap(w) { master(w); siklus(w); usulan(w); }

module.exports = { baca, unggah, master, siklus, usulan, lengkap };
