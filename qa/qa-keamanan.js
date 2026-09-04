// Uji keamanan defensif. Semua percobaan di sini menyerang aplikasi kita sendiri,
// lewat jalur yang memang tersedia bagi pengguna, untuk memastikan aturan dijaga di
// lapisan data dan bukan hanya disembunyikan di tampilan.
//
// Yang diuji: penembusan hak lewat pemanggilan langsung, kebocoran lintas departemen,
// kebocoran kolom biaya, penyisipan skrip lewat data, penyisipan rumus lewat ekspor,
// pencemaran prototipe lewat kepala CSV, dan penyalahgunaan pemulihan cadangan.
//
// Batas yang harus tetap disebut: prototipe ini berjalan sepenuhnya di browser, jadi
// seluruh data ada di sisi klien. Uji ini membuktikan aturan aplikasi, bukan keamanan
// sistem. Kontrol yang sesungguhnya harus dipasang di server.
const { JSDOM } = require("jsdom");
const FX = require(__dirname + '/fixture.js');
const fs = require("fs");

const w = new JSDOM(fs.readFileSync("/home/claude/mpp/dist/index.html", "utf8"),
  { runScripts: "dangerously", url: "https://local.test/", pretendToBeVisual: true }).window;
w.scrollTo = () => {};
w.URL.createObjectURL = () => "blob:uji"; w.URL.revokeObjectURL = () => {};

const gagal = [];
const cek = (n, ok, i) => { if (!ok) gagal.push(n); console.log((ok ? "PASS " : "GAGAL") + "  " + n + (!ok && i ? "  [" + i + "]" : "")); };

setTimeout(() => {
// Aplikasi kosong: data dimuat lewat jalur impor sungguhan.
FX.lengkap(w);
const d = w.document, S = w.NBStore, I = w.NBImpor, R = w.NBReport, Rb = w.NBRbac;

// Persiapan sampai alokasi dibagikan
S.masuk("U-OD-01"); S.ubahStatusSiklus("MPP-2027", "OPEN"); S.rilisSnapshot("MPP-2027", "2026-09-01");
S.keluar(); S.masuk("U-HOD-MKT"); S.kirimSubmission("MPP-2027", "D-MKT");
S.keluar(); S.masuk("U-HOD-PRD"); S.kirimSubmission("MPP-2027", "D-PRD");
S.keluar(); S.masuk("U-OD-01");
S.reviewSubmission("SUB-2027-MKT", "ACCEPT", null);
S.reviewSubmission("SUB-2027-PRD", "ACCEPT", null);
S.kunciKonsolidasi("MPP-2027");
S.keluar(); S.masuk("U-MGT-01");
S.barisReview("MPP-2027").forEach(l => S.putuskanBaris(l.line_item_id, "APPROVE", null, null));
S.setujuiMpp("MPP-2027", "Disetujui untuk pengujian keamanan");
S.keluar(); S.masuk("U-OD-01"); S.distribusikanAlokasi("MPP-2027");
const alokasiMkt = S.alokasiTerlihat("MPP-2027").find(a => a.department_id === "D-MKT");
const alokasiPrd = S.alokasiTerlihat("MPP-2027").find(a => a.department_id === "D-PRD");

// ---------- A. Penembusan hak lewat pemanggilan langsung ----------
// Setiap peran mencoba fungsi yang bukan haknya, memanggil store langsung tanpa lewat layar.
S.keluar(); S.masuk("U-HOD-MKT");
cek("A1 HOD tidak bisa membuat siklus", !S.buatSiklus({ year: 2029, start_date: "2028-09-01",
    end_date: "2029-12-31", submission_deadline: "2028-10-15" }).ok);
cek("A2 HOD tidak bisa merilis snapshot", !S.rilisSnapshot("MPP-2027", "2027-01-01").ok);
cek("A3 HOD tidak bisa mereview usulan", !S.reviewSubmission("SUB-2027-PRD", "ACCEPT", null).ok);
cek("A4 HOD tidak bisa mengunci konsolidasi", !S.kunciKonsolidasi("MPP-2027").ok);
cek("A5 HOD tidak bisa memutuskan baris", !S.putuskanBaris("LI-0001", "REJECT", 0, "Percobaan tanpa hak").ok);
cek("A6 HOD tidak bisa menyetujui MPP", !S.setujuiMpp("MPP-2027", "Percobaan tanpa hak").ok);
cek("A7 HOD tidak bisa membagikan alokasi", !S.distribusikanAlokasi("MPP-2027").ok);
cek("A8 HOD tidak bisa mencatat realisasi",
    !S.catatActual(alokasiMkt.allocation_id, { quantity: 1, actual_date: "2027-04-01" }).ok);
cek("A9 HOD tidak bisa mereset data", !S.reset().ok);
cek("A10 HOD tidak bisa memulihkan cadangan", !S.pulihkanCadangan(S.cadangan()).ok);

S.keluar(); S.masuk("U-MON-01");
cek("A11 monitor tidak bisa menyusun usulan",
    !S.tambahBaris("MPP-2027", "D-MKT", { action_type: "NO_CHANGE", employee_id: "NBT2001" }).ok);
cek("A12 monitor tidak bisa memutuskan exception",
    !S.putuskanException("EXC-2027-0001", "ACCEPT", "Percobaan tanpa hak yang panjang").ok);

S.keluar(); S.masuk("U-CB-01");
cek("A13 C&B tidak bisa menyetujui MPP", !S.setujuiMpp("MPP-2027", "Percobaan tanpa hak").ok);
cek("A14 C&B tidak bisa mengubah master karyawan",
    !S.ubah("Employee", "NBT2001", "grade_id", "5C", { capability: "master.employee.edit" }).ok);

S.keluar(); S.masuk("U-MGT-01");
cek("A15 manajemen tidak bisa membagikan alokasi", !S.distribusikanAlokasi("MPP-2027").ok);
cek("A16 manajemen tidak bisa menaikkan angka yang disetujui",
    !S.putuskanBaris("LI-0004", "REDUCE", 99, "Percobaan menaikkan lewat pemanggilan langsung").ok);

// Setiap penolakan harus meninggalkan jejak, bukan gagal diam-diam.
cek("A17 percobaan tanpa hak tercatat di audit",
    w.NBAudit.semua().filter(e => e.event_type === "SCOPE_DENIED").length >= 8,
    String(w.NBAudit.semua().filter(e => e.event_type === "SCOPE_DENIED").length));

// ---------- B. Kebocoran lintas departemen ----------
S.keluar(); S.masuk("U-HOD-MKT");
cek("B1 karyawan departemen lain tidak terbaca",
    S.karyawanTerlihat().every(e => e.department_id === "D-MKT"));
cek("B2 baris usulan departemen lain tidak terbaca",
    S.barisSiklusTerlihat("MPP-2027").every(l => l.department_id === "D-MKT"));
cek("B3 alokasi departemen lain tidak terbaca",
    S.alokasiTerlihat("MPP-2027").every(a => a.department_id === "D-MKT"));
cek("B4 realisasi departemen lain tidak terbaca",
    S.actualTerlihat("MPP-2027").every(a => a.department_id === "D-MKT"));
cek("B5 baris snapshot departemen lain tidak terbaca",
    S.snapshotBarisTerlihat(S.snapshotAktif("MPP-2027").snapshot_id)
      .every(l => l.department_id === "D-MKT"));
cek("B6 laporan usulan hanya berisi departemennya",
    S.dataLaporan("R2", "MPP-2027").baris.every(b => b.department_id === "D-MKT"));
cek("B7 laporan alokasi hanya berisi departemennya",
    S.dataLaporan("R6", "MPP-2027").baris.every(b => b.department_id === "D-MKT"));
cek("B8 audit hanya memuat jejak yang relevan baginya",
    w.NBAudit.untuk(S.user(), S.departemenDariAudit)
      .every(e => e.actor_id === "U-HOD-MKT" || S.departemenDariAudit(e) === "D-MKT" ||
                  S.departemenDariAudit(e) === null && e.actor_id === "U-HOD-MKT"));
cek("B9 menulis ke departemen lain ditolak",
    !S.tambahBaris("MPP-2027", "D-PRD", { action_type: "NO_CHANGE", employee_id: "NBT2030" }).ok);
// HOD tidak punya hak mencatat realisasi sama sekali, jadi impornya ditolak di gerbang.
const impRealisasi = S.pratinjauImpor("REALISASI",
  [{ allocation_id: alokasiPrd.allocation_id, quantity: 1, actual_date: "2027-04-01" }], "MPP-2027");
cek("B10 impor realisasi ditolak untuk peran tanpa hak",
    !impRealisasi.ok && impRealisasi.kunci === "imp.errPeran", JSON.stringify(impRealisasi));
// Impor usulan ke departemen lain harus gagal per baris, bukan diam-diam masuk.
const impUsulan = S.pratinjauImpor("USULAN", [{ department_id: "D-PRD", action_type: "NO_CHANGE",
  employee_id: "NBT2030", effective_month: 5, justification: "Percobaan menulis lintas departemen" }],
  "MPP-2027");
cek("B11 impor usulan ke departemen lain ditolak",
    impUsulan.ok && impUsulan.hasil[0].kunci === "plan.errLingkup",
    JSON.stringify(impUsulan.hasil ? impUsulan.hasil[0] : impUsulan));

// ---------- C. Kebocoran kolom biaya ----------
S.keluar(); S.masuk("U-MON-01");
cek("C1 monitor tidak berhak melihat biaya di departemen mana pun",
    S.semuaDepartemen().every(dep => !Rb.canSeeCost(S.user(), dep.department_id)));
w.location.hash = "#monitoring"; w.NBApp.ulang();
cek("C2 layar monitoring tidak memuat nominal untuk monitor",
    !/Rp[\d.]/.test(d.getElementById("nbPage").innerHTML));
w.location.hash = "#approved"; w.NBApp.ulang();
cek("C3 layar approved tidak memuat nominal untuk monitor",
    !/Rp[\d.]/.test(d.getElementById("nbPage").innerHTML));
w.location.hash = "#laporan"; w.NBApp.ulang();
cek("C4 laporan biaya tidak ditawarkan kepada monitor",
    !Array.from(d.querySelectorAll("#lPilih option")).map(o => o.value).includes("R4"));
w.location.hash = "#biaya"; w.NBApp.ulang();
cek("C5 layar biaya menolak monitor", w.location.hash === "#dashboard", w.location.hash);
S.keluar(); S.masuk("U-HOD-MKT");
cek("C6 HOD hanya berhak melihat biaya departemennya",
    Rb.canSeeCost(S.user(), "D-MKT") && !Rb.canSeeCost(S.user(), "D-PRD"));

// ---------- D. Penyisipan skrip lewat data ----------
S.keluar(); S.masuk("U-OD-01");
const racun = '<img src=x onerror="window.__diretas=1">';
const racun2 = '<script>window.__diretas2=1<\/script>';
S.terapkanImpor("KARYAWAN", [{ employee_id: "NBT9100", name: racun, position_id: "POS-MKT-004",
  grade_id: "4A", department_id: "D-MKT" }], "MPP-2027");
S.ubah("Department", "D-MKT", "note", racun2, { capability: "dept.note.edit" });
w.location.hash = "#organisasi"; w.NBApp.ulang();
cek("D1 nama berisi tag tidak menghasilkan elemen gambar",
    d.querySelectorAll("#nbPage img").length === 0);
cek("D2 tidak ada skrip yang tereksekusi dari data",
    !w.__diretas && !w.__diretas2);
cek("D3 nama berbahaya tampil sebagai teks apa adanya",
    d.getElementById("nbPage").textContent.indexOf("onerror") > -1);
w.location.hash = "#audit"; w.NBApp.ulang();
cek("D4 layar audit juga tidak mengeksekusi isi data",
    d.querySelectorAll("#nbPage img, #nbPage script").length === 0 && !w.__diretas2);

// ---------- E. Penyisipan rumus lewat ekspor ----------
const csv = R.keCsv([{ kunci: "a", label: "nama" }], [
  { a: "=1+1" }, { a: "+62812" }, { a: "-2+3" }, { a: "@SUM(A1)" }, { a: "Nama Biasa" }
]);
const barisCsv = csv.replace(/^\uFEFF/, "").split("\r\n");
cek("E1 sel diawali sama dengan dinetralkan", !/^"?=/.test(barisCsv[1]), barisCsv[1]);
cek("E2 sel diawali tambah dinetralkan", !/^"?\+/.test(barisCsv[2]), barisCsv[2]);
cek("E3 sel diawali kurang dinetralkan", !/^"?-/.test(barisCsv[3]), barisCsv[3]);
cek("E4 sel diawali at dinetralkan", !/^"?@/.test(barisCsv[4]), barisCsv[4]);
cek("E5 teks biasa tidak diubah", barisCsv[5] === "Nama Biasa", barisCsv[5]);

// ---------- F. Pencemaran prototipe lewat kepala CSV ----------
const u = I.urai("__proto__;constructor;name\nracun;racun;Budi");
cek("F1 kepala berbahaya tidak mencemari objek dasar",
    ({}).racun === undefined && Object.prototype.racun === undefined);
cek("F2 nilai tetap terbaca sebagai data biasa", u.baris[0].name === "Budi");

// ---------- G. Pemulihan cadangan ----------
S.keluar(); S.masuk("U-OD-01");
const cad = S.cadangan();
cek("G1 cadangan bukan pintu belakang untuk peran lain",
    (() => { S.keluar(); S.masuk("U-CB-01");
             const r = S.pulihkanCadangan(cad); S.keluar(); S.masuk("U-OD-01"); return !r.ok; })());
cek("G2 berkas rusak ditolak", !S.pulihkanCadangan("{bukan json").ok);
cek("G3 berkas asing ditolak", !S.pulihkanCadangan('{"db":{"x":1}}').ok);
cek("G4 pemulihan tercatat di audit",
    (() => { S.pulihkanCadangan(cad);
             return w.NBAudit.semua().some(e => e.event_type === "DATA_RESTORE"); })());

// ---------- H. Kekebalan data yang dibaca ----------
const kar = S.karyawan("NBT2001");
kar.name = "DIUBAH LEWAT SALINAN";
cek("H1 mengubah hasil pembacaan tidak mengubah data",
    S.karyawan("NBT2001").name !== "DIUBAH LEWAT SALINAN");
const daftarAlokasi = S.alokasiTerlihat("MPP-2027");
if (daftarAlokasi.length) { daftarAlokasi[0].approved_qty = 999; }
cek("H2 mengubah daftar alokasi hasil pembacaan tidak mengubah data",
    !S.alokasiTerlihat("MPP-2027").some(a => a.approved_qty === 999));
const sik = S.siklus("MPP-2027"); sik.status = "CLOSED";
cek("H3 mengubah objek siklus hasil pembacaan tidak mengubah data",
    S.siklus("MPP-2027").status !== "CLOSED", S.siklus("MPP-2027").status);
const logSebelum = w.NBAudit.semua().length;
const salinanLog = w.NBAudit.semua();
salinanLog.splice(0, salinanLog.length);
cek("H4 menghapus salinan audit tidak menghapus audit aslinya",
    w.NBAudit.semua().length === logSebelum, logSebelum + " -> " + w.NBAudit.semua().length);
const entri = w.NBAudit.semua()[0];
if (entri) entri.detail = "DIPALSUKAN";
cek("H5 mengubah entri audit hasil pembacaan tidak mengubah aslinya",
    w.NBAudit.semua()[0].detail !== "DIPALSUKAN");

// ---------- I. Sesi ----------
cek("I1 masuk dengan identitas asing ditolak", S.masuk("U-PALSU-99") === null);
cek("I2 sesi tetap milik pengguna sebelumnya", !!S.user());

console.log("\nTOTAL GAGAL: " + gagal.length);
gagal.forEach(x => console.log(" - " + x));
}, 500);
