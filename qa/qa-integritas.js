// Uji integritas. Menjalankan satu siklus penuh dari nol, lalu memeriksa apakah setiap
// angka masih konsisten dengan angka lain yang seharusnya menurunkannya.
//
// Yang dicari di sini bukan galat program, melainkan angka yang diam-diam berbeda:
// total departemen tidak sama dengan total perusahaan, alokasi tidak cocok dengan
// keputusan, biaya tidak cocok dengan kuantitas, atau catatan yang menggantung.
const { JSDOM } = require("jsdom");
const FX = require(__dirname + '/fixture.js');
const fs = require("fs");

const w = new JSDOM(fs.readFileSync("/home/claude/mpp/dist/index.html", "utf8"),
  { runScripts: "dangerously", url: "https://local.test/", pretendToBeVisual: true }).window;
w.scrollTo = () => {};

const gagal = [];
const cek = (n, ok, i) => { if (!ok) gagal.push(n); console.log((ok ? "PASS " : "GAGAL") + "  " + n + (!ok && i ? "  [" + i + "]" : "")); };

setTimeout(() => {
// Aplikasi kosong: data dimuat lewat jalur impor sungguhan.
FX.lengkap(w);
const S = w.NBStore, A = w.NBActions, C = w.NBCosting, F = w.NBFormat;

// ---------- Menjalankan satu siklus penuh ----------
S.masuk("U-OD-01");
S.ubahStatusSiklus("MPP-2027", "OPEN");
S.rilisSnapshot("MPP-2027", "2026-09-01");
S.keluar(); S.masuk("U-HOD-PRD");
const mutasi = S.tambahBaris("MPP-2027", "D-PRD", { action_type: "TRANSFER", employee_id: "NBT2030",
  target_department_id: "D-QAS", effective_month: 6,
  justification: "Kompetensi analitiknya lebih terpakai di Quality Assurance" });
S.kirimSubmission("MPP-2027", "D-PRD");
S.keluar(); S.masuk("U-HOD-MKT"); S.kirimSubmission("MPP-2027", "D-MKT");
S.keluar(); S.masuk("U-OD-01");
S.reviewSubmission("SUB-2027-MKT", "ACCEPT", null);
S.reviewSubmission("SUB-2027-PRD", "ACCEPT", null);
S.konfirmasiMutasi(mutasi.baris.line_item_id, "CONFIRM", null);
// Keputusan 4c dan 5c: OD menetapkan atasan baru di departemen tujuan sebelum mengunci.
S.tetapkanAtasanMutasi(mutasi.baris.line_item_id, S.hodDari('D-QAS').employee_id);
const kunci = S.kunciKonsolidasi("MPP-2027");
if (!kunci.ok) { console.log("GAGAL  penguncian konsolidasi: " + JSON.stringify(kunci)); gagal.push("kunci"); }
S.keluar(); S.masuk("U-MGT-01");
S.putuskanBaris("LI-0004", "REDUCE", 2, "Kapasitas anggaran 2027 hanya menampung dua operator");
S.putuskanBaris("LI-0003", "REJECT", 0, "Analisis kampanye cukup ditangani agensi tahun depan");
S.barisReview("MPP-2027").filter(l => !l.decision)
  .forEach(l => S.putuskanBaris(l.line_item_id, "APPROVE", null, null));
S.setujuiMpp("MPP-2027", "Disetujui dengan pemangkasan pada lini produksi");
S.keluar(); S.masuk("U-OD-01");
S.distribusikanAlokasi("MPP-2027");
const alokasi = S.alokasiTerlihat("MPP-2027");
const hire = alokasi.find(a => a.action_type === "EXTERNAL_HIRING");
S.keluar(); S.masuk("U-MON-01");
S.catatActual(hire.allocation_id, { quantity: 1, actual_date: "2027-04-05", employee_name: "Rizal Saputra" });
S.keluar(); S.masuk("U-OD-01");

// ---------- A. Konsolidasi ----------
const k = S.konsolidasi("MPP-2027");
const jumlahDept = k.perDept.reduce((t, d) => ({
  current: t.current + d.current, netto: t.netto + d.netto, proposed: t.proposed + d.proposed
}), { current: 0, netto: 0, proposed: 0 });
cek("A1 total current perusahaan sama dengan jumlah departemen",
    k.total.current === jumlahDept.current, k.total.current + " vs " + jumlahDept.current);
cek("A2 total netto sama dengan jumlah departemen",
    k.total.netto === jumlahDept.netto, k.total.netto + " vs " + jumlahDept.netto);
cek("A3 proposed sama dengan current ditambah netto",
    k.total.proposed === k.total.current + k.total.netto,
    k.total.proposed + " vs " + (k.total.current + k.total.netto));
cek("A4 netto sama dengan tambah dikurangi kurang",
    k.total.netto === k.total.tambah - k.total.kurang,
    k.total.netto + " vs " + (k.total.tambah - k.total.kurang));
const asal = k.perDept.find(d => d.department_id === "D-PRD");
const tujuan = k.perDept.find(d => d.department_id === "D-QAS");
cek("A5 mutasi netral: satu keluar satu masuk",
    asal.netto + tujuan.netto === (asal.netto + tujuan.netto) && tujuan.netto === 1,
    "asal " + asal.netto + " tujuan " + tujuan.netto);
cek("A6 sebaran bulan menjumlah sama dengan tambah perusahaan",
    k.perBulan.reduce((t, b) => t + b.tambah, 0) === k.total.tambah,
    k.perBulan.reduce((t, b) => t + b.tambah, 0) + " vs " + k.total.tambah);

// ---------- B. Keputusan versus usulan ----------
const r = S.ringkasKeputusan("MPP-2027");
cek("B1 tidak ada baris yang disetujui melebihi usulannya",
    r.baris.every(x => x.setujuQty <= x.usulanQty),
    JSON.stringify(r.baris.filter(x => x.setujuQty > x.usulanQty).map(x => x.baris.line_item_id)));
cek("B2 seluruh baris sudah diputuskan sebelum disetujui",
    r.diputuskan === r.baris.length, r.diputuskan + " dari " + r.baris.length);
cek("B3 HC disetujui tidak melebihi HC diusulkan",
    r.disetujuiHc <= r.usulanHc, r.disetujuiHc + " vs " + r.usulanHc);
cek("B4 biaya disetujui tidak melebihi biaya usulan",
    r.disetujuiBiaya <= r.usulanBiaya,
    F.rupiah(r.disetujuiBiaya) + " vs " + F.rupiah(r.usulanBiaya));
const apr = S.approvalSiklus("MPP-2027")[0];
cek("B5 netto beku pada persetujuan sama dengan hitungan sekarang",
    apr.netto_disetujui === r.disetujuiHc, apr.netto_disetujui + " vs " + r.disetujuiHc);

// ---------- C. Alokasi ----------
cek("C1 setiap alokasi menunjuk baris usulan yang ada",
    alokasi.every(a => S.barisReview("MPP-2027").some(l => l.line_item_id === a.line_item_id)));
cek("C2 kuota alokasi sama dengan kuantitas yang disetujui",
    alokasi.every(a => {
      const l = S.barisReview("MPP-2027").find(x => x.line_item_id === a.line_item_id);
      return a.approved_qty === S.kuantitasDisetujui(l);
    }));
cek("C3 baris yang ditolak tidak punya alokasi",
    !alokasi.some(a => a.line_item_id === "LI-0003"));
cek("C4 sisa sama dengan kuota dikurangi terpakai",
    alokasi.every(a => a.remaining_qty === Math.max(0, a.approved_qty - a.consumed_qty)));
cek("C5 tidak ada alokasi dengan kuota nol", alokasi.every(a => a.approved_qty > 0));
const alok2 = S.ringkasAlokasi("MPP-2027");
cek("C6 total kuota sama dengan jumlah alokasi",
    alok2.total.approvedQty === alokasi.reduce((t, a) => t + a.approved_qty, 0));

// ---------- D. Biaya ----------
const h = S.biayaSiklus("MPP-2027");
cek("D1 tahunan setiap baris sama dengan bulanan dikali bulan berlaku",
    h.rincian.every(x => x.biaya.annualized_cost === Math.round(x.biaya.monthly_cost * x.biaya.applicable_months)),
    JSON.stringify(h.rincian.filter(x => x.biaya.annualized_cost !== Math.round(x.biaya.monthly_cost * x.biaya.applicable_months)).map(x => x.baris.line_item_id)));
cek("D2 jumlah per departemen sama dengan total",
    h.perDept.reduce((t, d) => t + d.annualized, 0) === h.total.annualized);
cek("D3 jumlah per baris sama dengan total",
    h.rincian.reduce((t, x) => t + x.biaya.annualized_cost, 0) === h.total.annualized);
cek("D4 prorata tidak pernah melebihi asumsi dua belas bulan",
    h.total.annualized <= h.tanpaProrata,
    F.rupiah(h.total.annualized) + " vs " + F.rupiah(h.tanpaProrata));
cek("D5 bulan berlaku sesuai rumus tiga belas dikurangi bulan efektif",
    h.rincian.every(x => !x.biaya.monthly_cost ||
      x.biaya.applicable_months === 13 - x.baris.effective_month));
const g9 = S.biayaGrade("4B", "MPP-2027");
const jumlahUtama = ["fixed_income","variable_income","company_coverage","accrual_thr","accrual_bonus"]
  .reduce((t, key) => t + g9.komponen[key], 0);
cek("D6 total biaya grade sama dengan jumlah lima angka utama",
    g9.total === jumlahUtama, g9.total + " vs " + jumlahUtama);

// ---------- E. Realisasi ----------
const m = S.ringkasMonitoring("MPP-2027");
const actual = S.actualTerlihat("MPP-2027").filter(a => a.status === "RECORDED");
cek("E1 terpakai sama dengan jumlah realisasi tercatat",
    m.total.terpakai === actual.reduce((t, a) => t + a.quantity, 0),
    m.total.terpakai + " vs " + actual.reduce((t, a) => t + a.quantity, 0));
cek("E2 setiap realisasi menunjuk alokasi yang ada",
    actual.every(a => alokasi.some(x => x.allocation_id === a.allocation_id)));
cek("E3 penambahan headcount tidak pernah melebihi kuotanya",
    alokasi.filter(a => ["EXTERNAL_HIRING", "VACANCY_ACTION", "POSITION_CREATION"].includes(a.action_type))
      .every(a => a.consumed_qty <= a.approved_qty));
cek("E4 realisasi tidak melebihi kuota total", m.total.terpakai <= m.total.kuota,
    m.total.terpakai + " vs " + m.total.kuota);
cek("E5 utilisasi sama dengan terpakai dibagi kuota",
    m.total.utilisasi === Math.round(m.total.terpakai / m.total.kuota * 100));
cek("E6 realisasi HC tidak melebihi HC yang disetujui",
    m.total.hcRealisasi <= r.disetujuiHc, m.total.hcRealisasi + " vs " + r.disetujuiHc);

// ---------- F. Pembekuan snapshot ----------
const snapId = S.snapshotAktif("MPP-2027").snapshot_id;
const sebelum = JSON.stringify(S.snapshot(snapId).lines);
S.ubah("Employee", "NBT2001", "grade_id", "5B",
  { capability: "master.employee.edit", reason: "Uji integritas pembekuan snapshot" });
cek("F1 isi snapshot tidak berubah oleh perubahan master",
    JSON.stringify(S.snapshot(snapId).lines) === sebelum);
cek("F2 perbedaan tercatat, bukan disembunyikan",
    S.bandingkanSnapshot(snapId).some(b => b.employee_id === "NBT2001"));

// ---------- G. Rujukan menggantung ----------
const baris = S.barisSiklusTerlihat("MPP-2027");
cek("G1 setiap baris usulan menunjuk submission yang ada",
    baris.every(l => !!S.barisSubmission(l.submission_id).length));
cek("G2 setiap baris berbasis karyawan menunjuk karyawan yang ada",
    baris.filter(l => l.employee_id).every(l => !!S.karyawan(l.employee_id)));
cek("G3 setiap baris berbasis posisi menunjuk posisi yang ada",
    baris.filter(l => l.position_id).every(l => !!S.posisi(l.position_id)));
cek("G4 setiap baris turunan menunjuk induk yang ada",
    baris.filter(l => l.parent_line_item_id)
      .every(l => baris.some(x => x.line_item_id === l.parent_line_item_id)));

// ---------- H. Jejak ----------
const revisi = S.revisiSiklus("MPP-2027");
cek("H1 setiap keputusan yang mengubah angka punya entri revisi",
    r.baris.filter(x => x.baris.decision === "REDUCED" || x.baris.decision === "REJECTED")
      .every(x => revisi.some(v => v.object_id === x.baris.line_item_id)));
cek("H2 entri revisi menyimpan nilai lama dan nilai baru",
    revisi.filter(v => v.field === "approved_quantity")
      .every(v => v.old_value !== null && v.new_value !== null));
const jumlahAudit = w.NBAudit.semua().length;
S.karyawanTerlihat(); S.konsolidasi("MPP-2027"); S.biayaSiklus("MPP-2027");
cek("H3 membaca data tidak menambah entri audit", w.NBAudit.semua().length === jumlahAudit,
    jumlahAudit + " -> " + w.NBAudit.semua().length);

// ---------- I. Laporan ----------
const R3 = S.dataLaporan("R3", "MPP-2027");
cek("I1 laporan varians sama dengan ringkasan alokasi",
    R3.baris.length === alok2.perDept.length &&
    R3.baris.every((b, i) => b.variance === alok2.perDept[i].variance));
const R4 = S.dataLaporan("R4", "MPP-2027");
cek("I2 laporan biaya sama dengan perhitungan biaya",
    R4.baris.reduce((t, b) => t + b.annualized, 0) === h.total.annualized);
const R7 = S.dataLaporan("R7", "MPP-2027");
cek("I3 laporan realisasi sama dengan ringkasan monitoring",
    R7.baris.reduce((t, b) => t + b.terpakai, 0) === m.total.terpakai);
const R1 = S.dataLaporan("R1", "MPP-2027");
cek("I4 laporan struktur sama dengan isi snapshot",
    R1.baris.length === S.snapshotBarisTerlihat(snapId).length);

// ---------- J. Penutupan ----------
S.keluar(); S.masuk("U-MON-01");
const promo = alokasi.find(a => a.action_type === "PROMOTION");
S.catatActual(promo.allocation_id, { quantity: 1, actual_date: "2027-04-01", employee_name: "Dimas" });
S.catatActual(promo.allocation_id, { quantity: 1, actual_date: "2027-06-01", employee_name: "Kelebihan" });
S.keluar(); S.masuk("U-OD-01");
cek("J1 exception menggantung menghalangi penutupan", !S.periksaPenutupan("MPP-2027").bolehTutup);
S.putuskanException(S.exceptionTerlihat("MPP-2027")[0].exception_id, "ACCEPT",
  "Kelebihan promosi disetujui sebagai pengecualian terdokumentasi");
// Realisasi yang menunggu HC ikut menghalangi penutupan (F5-1), jadi diputuskan dulu.
cek("J1b realisasi menunggu HC menghalangi penutupan",
    S.periksaPenutupan("MPP-2027").masalah.some(m => m.kunci === "tutup.realisasiHc"));
S.realisasiMenunggu("MPP-2027").forEach(a => S.setujuiRealisasi(a.actual_id, "SETUJU", null));
// Realisasi rekrutmen yang dicatat di awal siklus ini juga.
S.actualTerlihat("MPP-2027").filter(a => a.status === "RECORDED" && a.master_status === "MENUNGGU")
  .forEach(a => S.setujuiRealisasi(a.actual_id, "SETUJU", null));
const mSebelumTutup = S.ringkasMonitoring("MPP-2027");
const tutup = S.ubahStatusSiklus("MPP-2027", "CLOSED", null);
cek("J1c penutupan berhasil setelah semua dibereskan", tutup.ok, JSON.stringify(tutup));
const ring = S.siklus("MPP-2027").closure_summary;
cek("J2 ringkasan penutupan sama dengan monitoring saat ditutup",
    ring.kuota === mSebelumTutup.total.kuota && ring.realisasi === mSebelumTutup.total.terpakai,
    JSON.stringify(ring));
cek("J3 siklus tertutup menolak seluruh penulisan",
    !S.rilisSnapshot("MPP-2027", "2027-01-01").ok &&
    !S.catatActual(hire.allocation_id, { quantity: 1, actual_date: "2027-05-01" }).ok);

console.log("\nTOTAL GAGAL: " + gagal.length);
gagal.forEach(x => console.log(" - " + x));
}, 500);
