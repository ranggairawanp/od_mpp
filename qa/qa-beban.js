// Uji beban. Membangkitkan 15 legal entity dengan total 32.000 karyawan, lalu mengukur
// berapa lama fungsi inti berjalan dan berapa besar datanya.
//
// Tujuannya bukan membuktikan prototipe ini sanggup, melainkan menemukan di mana persisnya
// ia patah, supaya keputusan arsitektur versi produksi berdasar angka, bukan firasat.
const { JSDOM } = require("jsdom");
const fs = require("fs");

const ENTITAS = 15;
const KARYAWAN = 32000;
const DEPT_PER_ENTITAS = 8;

function bangkitkan() {
  const entities = [], divisions = [], departments = [], cost_centers = [],
        positions = [], employees = [];
  const grades = ["2A","3A","3C","4A","4B","4C","5A","5B","5C"];
  let ep = 0;
  for (let e = 1; e <= ENTITAS; e++) {
    const eid = "ENT-" + String(e).padStart(2, "0");
    entities.push({ entity_id: eid, name: "Entitas " + e, country: "ID", currency: "IDR" });
    divisions.push({ division_id: eid + "-DIV", entity_id: eid, name: "Divisi " + e });
    for (let dd = 1; dd <= DEPT_PER_ENTITAS; dd++) {
      const did = eid + "-D" + dd;
      departments.push({ department_id: did, division_id: eid + "-DIV",
        name: "Dept " + e + "." + dd, cost_center_id: "CC-" + e + dd, hod_user_id: null, note: "" });
      cost_centers.push({ cost_center_id: "CC-" + e + dd, name: "CC " + e + dd, owner_department_id: did });
      for (let pp = 1; pp <= 6; pp++) {
        positions.push({ position_id: did + "-P" + pp, code: did + "-P" + pp,
          title: "Posisi " + pp, grade_id: grades[pp % grades.length],
          department_id: did, is_unique: false, headcount_slot: 40 });
      }
    }
  }
  const perDept = Math.floor(KARYAWAN / departments.length);
  departments.forEach((d) => {
    for (let i = 0; i < perDept; i++) {
      ep++;
      const pos = positions.filter(p => p.department_id === d.department_id)[i % 6];
      employees.push({
        direct_report_id: i === 0 ? "" : "EMP" + String(ep - i).padStart(6, "0"),
        employee_id: "EMP" + String(ep).padStart(6, "0"),
        name: "Karyawan " + ep, position_id: pos.position_id, grade_id: pos.grade_id,
        department_id: d.department_id, division_id: d.division_id,
        entity_id: d.department_id.slice(0, 6), cost_center_id: d.cost_center_id,
        employment_status: "Tetap", join_date: "2020-01-01"
      });
    }
  });
  return { entities, divisions, departments, cost_centers, positions, employees };
}

const w = new JSDOM(fs.readFileSync("/home/claude/mpp/dist/index.html", "utf8"),
  { runScripts: "dangerously", url: "https://local.test/", pretendToBeVisual: true }).window;
w.scrollTo = () => {};

function ukur(nama, fn) {
  const t0 = process.hrtime.bigint();
  const hasil = fn();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(nama.padEnd(52) + ms.toFixed(0).padStart(7) + " ms" +
    (hasil !== undefined && hasil !== null ? "   " + hasil : ""));
  return ms;
}

setTimeout(() => {
const S = w.NBStore;
const data = bangkitkan();
console.log("Dibangkitkan: " + data.entities.length + " entitas, " +
  data.departments.length + " departemen, " + data.employees.length + " karyawan, " +
  data.positions.length + " posisi\n");

// Menyuntik data besar langsung ke basis data prototipe lewat pemulihan cadangan.
// Aplikasi kosong: master dan siklus dimuat lewat fixture, lalu ditimpa data besar.
require(__dirname + "/fixture.js").master(w); require(__dirname + "/fixture.js").siklus(w);
S.masuk("U-OD-01");
const cad = JSON.parse(S.cadangan());
Object.assign(cad.db, data);
cad.db.users = cad.db.users.map(u => u.role === "OD" ? u : u);
const teks = JSON.stringify(cad);
const mb = (teks.length / 1048576).toFixed(1);

console.log("UKURAN DATA");
console.log("Cadangan JSON".padEnd(52) + mb.padStart(7) + " MB");
console.log("Batas sessionStorage umum".padEnd(52) + "    5,0 MB");
console.log("Muat di sessionStorage".padEnd(52) +
  (teks.length / 1048576 < 5 ? "     ya" : "  TIDAK") + "\n");

ukur("Memulihkan basis data besar", () => { S.pulihkanCadangan(teks); return ""; });

console.log("\nWAKTU FUNGSI INTI (satu panggilan)");
ukur("karyawanTerlihat, lingkup seluruh perusahaan", () => S.karyawanTerlihat().length + " baris");
ukur("Menurunkan pengguna dari pohon 32.000 orang", () => S.semuaPengguna().length + " persona");
ukur("Deteksi pelaporan melingkar 32.000 orang", () => w.NBOrganisasi.deteksiSiklus(S.karyawanTerlihat()).length + " lingkaran");
ukur("karyawanTerlihat dengan kata kunci", () => S.karyawanTerlihat({ q: "Karyawan 1000" }).length + " baris");
ukur("departemenTerlihat", () => S.departemenTerlihat().length + " departemen");
ukur("Membuka siklus", () => { S.ubahStatusSiklus("MPP-2027", "OPEN"); return ""; });
ukur("Merilis snapshot 32.000 baris", () => {
  const r = S.rilisSnapshot("MPP-2027", "2026-09-01");
  return r.ok ? r.snapshot.line_count + " baris beku" : "GAGAL " + (r.kunci || r.alasan);
});
ukur("snapshotBarisTerlihat", () => {
  const s = S.snapshotAktif("MPP-2027");
  return s ? S.snapshotBarisTerlihat(s.snapshot_id).length + " baris" : "-";
});
ukur("bandingkanSnapshot", () => {
  const s = S.snapshotAktif("MPP-2027");
  return s ? S.bandingkanSnapshot(s.snapshot_id).length + " perbedaan" : "-";
});
ukur("konsolidasi", () => S.konsolidasi("MPP-2027").perDept.length + " departemen");
ukur("biayaSiklus", () => { const h = S.biayaSiklus("MPP-2027"); return h ? h.baris + " baris berbiaya" : "-"; });
ukur("ringkasAlokasi", () => S.ringkasAlokasi("MPP-2027").perDept.length + " departemen");
ukur("ringkasMonitoring", () => S.ringkasMonitoring("MPP-2027").perDept.length + " departemen");
ukur("dataLaporan R1 struktur organisasi", () => S.dataLaporan("R1", "MPP-2027").baris.length + " baris");
ukur("notifikasi", () => S.notifikasi("MPP-2027").length + " butir");

console.log("\nWAKTU MENGGAMBAR LAYAR");
ukur("Layar Data Organisasi", () => {
  w.location.hash = "#organisasi"; w.NBApp.ulang();
  return w.document.querySelectorAll("#nbPage tbody tr").length + " baris di DOM";
});
ukur("Layar Dashboard", () => { w.location.hash = "#dashboard"; w.NBApp.ulang(); return ""; });
ukur("Layar Siklus", () => { w.location.hash = "#siklus"; w.NBApp.ulang(); return ""; });

console.log("\nPENYIMPANAN SESI");
let simpanGagal = false;
try {
  w.sessionStorage.setItem("uji_besar", teks);
  w.sessionStorage.removeItem("uji_besar");
} catch (e) { simpanGagal = true; }
console.log("Menyimpan basis data ke sessionStorage".padEnd(52) +
  (simpanGagal ? "  GAGAL, melebihi kuota" : "  berhasil di lingkungan uji"));
console.log("Catatan: peramban sungguhan menolak di sekitar 5 MB, dan kegagalan itu\n" +
            "ditelan diam-diam oleh pembungkus penyimpanan, sehingga data hilang saat\n" +
            "berpindah layar.\n");
}, 500);
