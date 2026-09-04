// Store. Satu-satunya jalur data masuk dan keluar layar.
// Alasan lapisan ini ada: saat prototipe berpindah ke API sungguhan, hanya berkas ini
// yang diganti, layar dan aturan bisnis tidak ikut dibongkar.
//
// PERINGATAN KEAMANAN (dibaca saat produksi):
// Seluruh data di sini berada di sisi klien dan bisa dilihat siapa pun yang membuka
// developer tools. Data HR sungguhan TIDAK BOLEH diperlakukan seperti ini. Penyaringan
// lingkup di bawah adalah simulasi kontrol, bukan kontrol keamanan. Di produksi,
// penyaringan wajib terjadi di server sebelum data dikirim ke browser.
(function (global) {
  "use strict";

  var KUNCI_DB = "nb_mpp_db";
  var simpanan = global.NBSimpanan;
  var sesi = { user: null, mulai: null };
  var db = null;

  function salin(x) { return JSON.parse(JSON.stringify(x)); }

  // --- Muat basis data ----------------------------------------------------
  function muat() {
    // RBAC butuh daftar departemen untuk lingkup entitas tanpa bergantung pada argumen pemanggil.
    NBRbac.daftarDepartemen = function () { return db ? db.departments : []; };
    var tersimpan = null;
    try {
      var mentah = simpanan.get(KUNCI_DB);
      if (mentah) tersimpan = JSON.parse(mentah);
    } catch (e) { tersimpan = null; }

    if (tersimpan) { db = tersimpan; return; }

    var D = global.NB_DATA || {};
    db = {
      entities: salin(D.entities || []),
      directorates: salin(D.directorates || []),
      divisions: salin(D.divisions || []),
      departments: salin(D.departments || []),
      cost_centers: salin(D.cost_centers || []),
      grades: salin(D.grades || []),
      positions: salin(D.positions || []),
      employees: salin(D.employees || []),
      users: salin(D.users || []),
      vacancies: salin(D.vacancies || []),
      cycles: salin(D.cycles || []),
      snapshots: salin(D.snapshots || []),
      submissions: salin(D.submissions || []),
      line_items: salin(D.line_items || []),
      consolidations: salin(D.consolidations || []),
      cost_parameters: salin(D.cost_parameters || []),
      cost_assumptions: salin(D.cost_assumptions || []),
      approvals: salin(D.approvals || []),
      fx_rates: salin(D.fx_rates || []),
      revisions: salin(D.revisions || []),
      allocations: salin(D.allocations || []),
      actuals: salin(D.actuals || []),
      exceptions: salin(D.exceptions || [])
    };
    // Baris snapshot historis dipasang sekali saat inisialisasi.
    db.snapshots.forEach(function (s) {
      if (s.snapshot_id === "SNAP-2026-V1" && !s.lines) {
        s.lines = salin(D.snapshot_lines_2026 || []);
        s.line_count = s.lines.length;
      }
    });
  }

  function simpan() {
    cacheTurunan = { kunci: null, hasil: null };
    cacheHod = { kunci: null, peta: {} };
    try { simpanan.set(KUNCI_DB, JSON.stringify(db)); } catch (e) { /* memori saja */ }
  }

  function reset() {
    if (!NBRbac.can(sesi.user, "admin")) return { ok: false, alasan: "Hanya OD yang boleh mereset data prototipe" };
    simpanan.hapus(KUNCI_DB);
    muat();
    if (global.NBAudit && NBAudit.reset) NBAudit.reset();
    NBAudit.tulis(sesi.user, "DATA_RESET", "Prototype", "-", { key: "audit.d.reset" });
    return { ok: true };
  }

  // --- Sesi ---------------------------------------------------------------
  // --- Pengguna turunan dari pohon atasan langsung (K4 nomor 6) -------------
  // HOD dan manajer tidak diketik di berkas pengguna. Sistem menurunkannya dari grade dan
  // pohon: 5A ke atas yang punya bawahan menjadi manajer, dan yang atasannya berada di luar
  // departemennya menjadi HOD. Baris di berkas pengguna yang menautkan employee_id hanya
  // menyumbang user_id, nama, dan surel; lingkupnya tetap dari pohon.
  function levelGrade(id) {
    var g = db.grades.filter(function (x) { return x.grade_id === id; })[0];
    return g ? g.level : 0;
  }

  function pohonOrganisasi() { return NBOrganisasi.bangunPohon(db.employees); }

  var cacheHod = { kunci: null, peta: {} };
  function hodDari(departmentId) {
    // Ditemukan uji beban: fungsi ini dipanggil per departemen dan menyisir seluruh karyawan.
    // Di-cache dengan kunci yang sama seperti pengguna turunan, dibersihkan saat simpan().
    var kunci = db.employees.length + ":" + db.departments.length + ":" +
                (db.employees.length ? db.employees[db.employees.length - 1].employee_id : "");
    if (cacheHod.kunci !== kunci) cacheHod = { kunci: kunci, peta: {} };
    if (!(departmentId in cacheHod.peta)) {
      cacheHod.peta[departmentId] = NBOrganisasi.hodDepartemen(departmentId, db.employees, levelGrade);
    }
    return cacheHod.peta[departmentId];
  }

  var cacheTurunan = { kunci: null, hasil: null };
  function penggunaTurunan() {
    // Ditemukan uji beban: menurunkan dari pohon 32.000 orang makan 630 ms dan dipanggil
    // setiap kali seseorang masuk. Hasilnya di-cache selama jumlah data tidak berubah.
    var kunci = db.employees.length + ":" + db.users.length + ":" + db.departments.length + ":" +
                db.positions.length + ":" + (db.employees.length ? db.employees[db.employees.length - 1].employee_id : "");
    if (cacheTurunan.kunci === kunci && cacheTurunan.hasil) return cacheTurunan.hasil;
    var hasil = [];
    var tertaut = {};
    (db.users || []).forEach(function (u) { if (u.employee_id) tertaut[u.employee_id] = u; });
    var hodPerDept = {};
    db.departments.forEach(function (d) {
      var h = hodDari(d.department_id);
      if (h) hodPerDept[h.employee_id] = d.department_id;
    });
    NBOrganisasi.manajerOtomatis(db.employees, levelGrade).forEach(function (e) {
      var peran = hodPerDept[e.employee_id] ? "HOD" : "MANAGER";
      var pos = _pos(e.position_id);
      var dasar = tertaut[e.employee_id];
      hasil.push({
        user_id: dasar ? dasar.user_id : "EMP-" + e.employee_id,
        name: dasar ? dasar.name : e.name,
        email: dasar ? dasar.email : (e.employee_id.toLowerCase() + "@karyawan"),
        role: peran, title: pos ? pos.title : "-",
        employee_id: e.employee_id, turunan: !dasar,
        scope: { type: "TREE", employee_id: e.employee_id, department_id: e.department_id }
      });
    });
    cacheTurunan = { kunci: kunci, hasil: hasil };
    return hasil;
  }

  // Seluruh pengguna: akun bawaan, berkas pengguna berperan non-lini, dan turunan pohon.
  function semuaPenggunaMentah() {
    var nonLini = (db.users || []).filter(function (u) { return !u.employee_id; });
    return nonLini.concat(penggunaTurunan());
  }

  function masuk(userId) {
    var u = semuaPenggunaMentah().filter(function (x) { return x.user_id === userId; })[0];
    if (!u) return null;
    sesi.user = u;
    sesi.mulai = new Date().toISOString();
    simpanan.set("nb_mpp_user", userId);
    NBAudit.tulis(u, "USER_LOGIN", "Session", u.user_id,
      { key: "audit.d.login", vars: { r: NBRbac.roleLabel(u.role) } });
    return u;
  }

  function pulihkanSesi() {
    var id = simpanan.get("nb_mpp_user");
    if (!id) return null;
    var u = semuaPenggunaMentah().filter(function (x) { return x.user_id === id; })[0];
    if (u) { sesi.user = u; sesi.mulai = new Date().toISOString(); }
    return u || null;
  }

  function keluar() {
    if (sesi.user) NBAudit.tulis(sesi.user, "USER_LOGOUT", "Session", sesi.user.user_id, { key: "audit.d.logout" });
    sesi.user = null;
    simpanan.hapus("nb_mpp_user");
  }

  function user() { return sesi.user; }

  // --- Master data --------------------------------------------------------
  // Pencari internal mengembalikan objek asli, hanya dipakai di dalam berkas ini.
  // Getter publik mengembalikan salinan, supaya layar tidak bisa menulis data
  // dengan cara mengubah objek hasil pembacaan dan melewati audit (BR-08).
  function _dep(id) { return db.departments.filter(function (d) { return d.department_id === id; })[0] || null; }
  function _kar(id) { return db.employees.filter(function (e) { return e.employee_id === id; })[0] || null; }
  function _pos(id) { return db.positions.filter(function (p) { return p.position_id === id; })[0] || null; }
  function _snap(id) { return db.snapshots.filter(function (s) { return s.snapshot_id === id; })[0] || null; }
  function _sik(id) { return db.cycles.filter(function (c) { return c.cycle_id === id; })[0] || null; }

  function semuaDepartemen() { return salin(db.departments); }
  function departemen(id) { var x = _dep(id); return x ? salin(x) : null; }
  function divisi(id) {
    var x = db.divisions.filter(function (d) { return d.division_id === id; })[0];
    return x ? salin(x) : null;
  }
  function grade(id) {
    var x = db.grades.filter(function (g) { return g.grade_id === id; })[0];
    return x ? salin(x) : null;
  }
  function semuaGrade() { return salin(db.grades); }
  function posisi(id) { var x = _pos(id); return x ? salin(x) : null; }
  function costCenter(id) {
    var x = db.cost_centers.filter(function (c) { return c.cost_center_id === id; })[0];
    return x ? salin(x) : null;
  }
  function karyawan(id) { var x = _kar(id); return x ? salin(x) : null; }
  // Pengguna aplikasi bukan karyawan. Dua entitas berbeda, jadi resolvernya juga berbeda.
  function semuaPengguna() { return salin(semuaPenggunaMentah()); }

  // Ringkasan ukuran data yang sedang dimuat. Dipakai halaman login, yang belum punya sesi
  // sehingga tidak bisa memakai penyaringan lingkup.
  function jumlahData() {
    return { departemen: db.departments.length, karyawan: db.employees.length,
             entitas: db.entities.length, posisi: db.positions.length };
  }
  function pengguna(id) {
    var x = semuaPenggunaMentah().filter(function (u) { return u.user_id === id; })[0];
    return x ? salin(x) : null;
  }

  // --- Data terikat lingkup pengguna --------------------------------------
  function departemenTerlihat() {
    var izin = NBRbac.scopeDepartments(sesi.user, semuaDepartemen());
    return semuaDepartemen().filter(function (d) { return izin.indexOf(d.department_id) !== -1; });
  }

  function karyawanTerlihat(filter) {
    var f = filter || {};
    var baris = NBRbac.filterEmployees(sesi.user, db.departments, salin(db.employees), pohonOrganisasi());
    if (f.department_id) baris = baris.filter(function (e) { return e.department_id === f.department_id; });
    if (f.q) {
      var q = f.q.toLowerCase();
      baris = baris.filter(function (e) {
        var p = posisi(e.position_id);
        return e.name.toLowerCase().indexOf(q) !== -1 ||
               e.employee_id.toLowerCase().indexOf(q) !== -1 ||
               (p && p.title.toLowerCase().indexOf(q) !== -1);
      });
    }
    return baris;
  }

  function posisiTerlihat() {
    return NBRbac.filterRows(sesi.user, db.departments, salin(db.positions), "department_id");
  }

  function vacancyTerlihat() {
    return NBRbac.filterRows(sesi.user, db.departments, salin(db.vacancies), "department_id");
  }

  // --- Siklus MPP (FR-01) -------------------------------------------------
  function semuaSiklus() {
    return salin(db.cycles).sort(function (a, b) { return b.year - a.year; });
  }
  function siklus(id) { var x = _sik(id); return x ? salin(x) : null; }

  // Siklus perencanaan aktif. Urutan prioritas: yang sedang berjalan lebih dulu,
  // lalu tahun terdekat. Tanpa aturan ini, membuat siklus tahun jauh di depan akan
  // merebut penanda siklus aktif dari siklus yang sedang dikerjakan.
  var URUT_STATUS = { OPEN: 0, LOCKED: 1, DRAFT: 2 };
  function siklusAktif() {
    var kandidat = db.cycles.filter(function (c) { return c.status !== "CLOSED"; })
      .sort(function (a, b) {
        var sa = URUT_STATUS[a.status], sb = URUT_STATUS[b.status];
        if (sa !== sb) return sa - sb;
        return a.year - b.year;
      });
    if (kandidat.length) return salin(kandidat[0]);
    return semuaSiklus()[0] || null;
  }

  function bolehUbahSiklus(c) {
    // BR-09: siklus tertutup hanya bisa dibaca.
    if (!c) return { ok: false, alasan: "Siklus tidak ditemukan" };
    if (c.status === "CLOSED") return { ok: false, alasan: "Siklus sudah ditutup dan bersifat read only (BR-09)" };
    return { ok: true };
  }

  function buatSiklus(data) {
    if (!NBRbac.can(sesi.user, "cycle.create")) {
      NBAudit.tulis(sesi.user, "SCOPE_DENIED", "MPPCycle", data.year, { key: "audit.d.denyCycleCreate" });
      return { ok: false, alasan: "Hanya OD yang boleh membuat siklus" };
    }
    var tahun = Number(data.year);
    if (!tahun || tahun < 2020 || tahun > 2100) return { ok: false, alasan: "Tahun siklus tidak masuk akal" };
    if (db.cycles.filter(function (c) { return c.year === tahun; }).length) {
      return { ok: false, alasan: "Siklus tahun " + data.year + " sudah ada" };
    }
    if (!data.start_date || !data.end_date || !data.submission_deadline) {
      return { ok: false, alasan: "Tanggal mulai, selesai, dan batas pengumpulan wajib diisi" };
    }
    if (data.end_date <= data.start_date) {
      return { ok: false, alasan: "Tanggal selesai harus setelah tanggal mulai" };
    }
    if (data.submission_deadline < data.start_date || data.submission_deadline > data.end_date) {
      return { ok: false, alasan: "Batas pengumpulan harus berada di dalam periode siklus" };
    }
    var c = {
      cycle_id: "MPP-" + data.year,
      year: Number(data.year),
      name: data.name || ("MPP " + data.year),
      start_date: data.start_date,
      end_date: data.end_date,
      submission_deadline: data.submission_deadline,
      status: "DRAFT",
      version: 1,
      created_by: sesi.user.user_id,
      created_at: new Date().toISOString(),
      closed_by: null, closed_at: null, reopen_reason: null, note: ""
    };
    db.cycles.push(c); simpan();
    NBAudit.tulis(sesi.user, "CYCLE_CREATE", "MPPCycle", c.cycle_id,
      { key: "audit.d.cycleCreate", vars: { name: c.name, tgl: NBFormat.tanggal(c.submission_deadline) } });
    return { ok: true, siklus: c };
  }

  // Transisi status yang diizinkan. Jalur mundur hanya lewat buka ulang dengan alasan.
  var TRANSISI = {
    DRAFT:  ["OPEN"],
    OPEN:   ["LOCKED", "CLOSED"],
    LOCKED: ["OPEN", "CLOSED"],
    CLOSED: ["OPEN"]
  };

  function ubahStatusSiklus(cycleId, statusBaru, alasan) {
    var c = _sik(cycleId);
    if (!c) return { ok: false, alasan: "Siklus tidak ditemukan" };
    if (!NBRbac.can(sesi.user, "cycle.create")) {
      NBAudit.tulis(sesi.user, "SCOPE_DENIED", "MPPCycle", cycleId, { key: "audit.d.denyCycleStatus" });
      return { ok: false, alasan: "Hanya OD yang boleh mengubah status siklus" };
    }
    if ((TRANSISI[c.status] || []).indexOf(statusBaru) === -1) {
      return { ok: false, alasan: "Transisi " + c.status + " ke " + statusBaru + " tidak diizinkan" };
    }
    // Buka ulang siklus tertutup menaikkan versi siklus. Alokasi lama tetap berlaku
    // sampai versi baru disetujui. Lihat catatan gap nomor 8 pada fase perencanaan.
    if (c.status === "CLOSED" && statusBaru === "OPEN") {
      if (!alasan) return { ok: false, alasan: "Buka ulang wajib menyertakan alasan" };
      c.version += 1;
      c.reopen_reason = alasan;
      c.closed_by = null; c.closed_at = null;
    }
    if (statusBaru === "CLOSED") {
      var jaga = periksaPenutupan(cycleId);
      if (!jaga.bolehTutup) {
        return { ok: false, kunci: "tutup.errBlokir",
                 vars: { n: jaga.masalah.filter(function (m) { return m.blokir; }).length } };
      }
      c.closed_by = sesi.user.user_id;
      c.closed_at = new Date().toISOString();
      // Ringkasan akhir tahun dibekukan bersama penutupan.
      var m = ringkasMonitoring(cycleId);
      c.closure_summary = {
        kuota: m.total.kuota, realisasi: m.total.terpakai, utilisasi: m.total.utilisasi,
        biaya_alokasi: m.total.biayaAlokasi, biaya_actual: m.total.biayaActual,
        ditutup_pada: new Date().toISOString()
      };
    }
    var sebelum = c.status;
    c.status = statusBaru;
    simpan();
    NBAudit.tulis(sesi.user, "CYCLE_STATUS", "MPPCycle", c.cycle_id,
      { key: "audit.d.cycleStatus", vars: { name: c.name }, reason: alasan || null }, sebelum, statusBaru);
    return { ok: true, siklus: c };
  }

  // --- Snapshot struktur organisasi (FR-02) -------------------------------
  // Ringkasan snapshot tanpa baris detail, supaya daftar tidak menyalin ribuan baris.
  function _ringkas(s) {
    var r = {};
    Object.keys(s).forEach(function (k) { if (k !== "lines") r[k] = s[k]; });
    r.line_count = s.line_count !== undefined ? s.line_count : (s.lines || []).length;
    return r;
  }
  function snapshotSiklus(cycleId) {
    return db.snapshots.filter(function (s) { return s.cycle_id === cycleId; })
                       .sort(function (a, b) { return b.version - a.version; })
                       .map(_ringkas);
  }
  function snapshot(id) { var x = _snap(id); return x ? salin(x) : null; }

  // Jumlah baris snapshot yang benar-benar boleh dilihat pengguna.
  // Tanpa ini, angka Current di dashboard membocorkan headcount seluruh perusahaan
  // kepada HOD yang lingkupnya hanya satu departemen (prinsip akses nomor 2).
  function snapshotBarisTerlihat(snapshotId) {
    var s = _snap(snapshotId);
    if (!s || !s.lines) return [];
    return NBRbac.filterRows(sesi.user, db.departments, salin(s.lines), "department_id");
  }

  function snapshotAktif(cycleId) {
    return snapshotSiklus(cycleId).filter(function (s) { return s.status === "RELEASED"; })[0] || null;
  }

  // Rilis snapshot menyalin keadaan master saat ini menjadi baris beku.
  // Setelah dirilis, baris ini tidak pernah diubah lagi walaupun master berubah.
  // Inilah state Current dalam rantai Current, Proposed, Approved, Actual.
  function rilisSnapshot(cycleId, effectiveDate) {
    var c = _sik(cycleId);
    var jaga = bolehUbahSiklus(c);
    if (!jaga.ok) return jaga;
    if (!NBRbac.can(sesi.user, "snapshot.upload")) {
      NBAudit.tulis(sesi.user, "SCOPE_DENIED", "OrgSnapshot", cycleId, { key: "audit.d.denySnapshot" });
      return { ok: false, alasan: "Hanya OD yang boleh merilis snapshot" };
    }
    if (!effectiveDate) return { ok: false, alasan: "Tanggal berlaku snapshot wajib diisi" };

    var versi = snapshotSiklus(cycleId).length + 1;
    var lines = db.employees.map(function (e) {
      var p = _pos(e.position_id);
      return {
        line_id: "SNL" + String(c.year).slice(2) + "-" + e.employee_id,
        employee_id: e.employee_id,
        employee_name: e.name,
        position_id: e.position_id,
        position_title: p ? p.title : "-",
        department_id: e.department_id,
        division_id: e.division_id,
        entity_id: e.entity_id,
        cost_center_id: e.cost_center_id,
        grade_id: e.grade_id,
        employment_status: e.employment_status,
        vacancy_flag: false,
        current_hc: 1
      };
    });

    var s = {
      snapshot_id: "SNAP-" + c.year + "-V" + versi,
      cycle_id: cycleId,
      version: versi,
      effective_date: effectiveDate,
      status: "RELEASED",
      released_by: sesi.user.user_id,
      released_at: new Date().toISOString(),
      source: "Salinan master organisasi dalam aplikasi",
      lines: salin(lines),
      line_count: lines.length,
      vacancy_ids: db.vacancies.filter(function (v) { return v.status === "Open"; })
                               .map(function (v) { return v.vacancy_id; }),
      note: ""
    };
    db.snapshots.push(s);
    simpan();
    NBAudit.tulis(sesi.user, "SNAPSHOT_RELEASE", "OrgSnapshot", s.snapshot_id,
      { key: "audit.d.snapshotRelease",
        vars: { id: s.snapshot_id, n: lines.length, v: s.vacancy_ids.length,
                tgl: NBFormat.tanggal(effectiveDate) } });
    return { ok: true, snapshot: s };
  }

  // Perbandingan snapshot terhadap master hari ini. Dipakai untuk membuktikan
  // snapshot benar-benar beku, dan nanti menjadi dasar analisis Current versus Actual.
  function bandingkanSnapshot(snapshotId) {
    var s = _snap(snapshotId);
    if (!s || !s.lines) return [];
    var beda = [];
    // Ditemukan saat uji beban: mencari karyawan satu per satu di dalam perulangan
    // membuat fungsi ini berperilaku kuadratik, lima detik pada 32.000 baris.
    // Dua peta pencarian menurunkannya menjadi linear.
    var petaKar = {};
    db.employees.forEach(function (e) { petaKar[e.employee_id] = e; });
    var petaSnap = {};
    s.lines.forEach(function (l) { petaSnap[l.employee_id] = true; });

    s.lines.forEach(function (l) {
      var e = petaKar[l.employee_id];
      if (!e) {
        beda.push({ employee_id: l.employee_id, nama: l.employee_name, field: "keberadaan",
                    snapshot: "ada", master: "tidak ada" });
        return;
      }
      ["grade_id", "department_id", "position_id", "employment_status"].forEach(function (f) {
        if (e[f] !== l[f]) {
          beda.push({ employee_id: l.employee_id, nama: l.employee_name, field: f,
                      snapshot: l[f], master: e[f] });
        }
      });
    });
    db.employees.forEach(function (e) {
      if (!petaSnap[e.employee_id]) {
        beda.push({ employee_id: e.employee_id, nama: e.name, field: "keberadaan",
                    snapshot: "tidak ada", master: "ada" });
      }
    });
    // Sumber perbedaan: realisasi MPP, atau perubahan master lain (F5-5).
    beda.forEach(function (x) {
      var rev = db.revisions.filter(function (r) {
        return r.object_type === "Employee" && r.object_id === x.employee_id &&
               (r.field === x.field || x.field === "keberadaan");
      });
      var terakhir = rev.length ? rev[rev.length - 1] : null;
      var alasan = terakhir ? (terakhir.reason || "") : "";
      x.sumber = /^Realisasi/.test(alasan) ? "realisasi" : (/^Impor/.test(alasan) ? "impor" : "master");
      x.actual_id = x.sumber === "realisasi" ? alasan.replace("Realisasi ", "") : null;
    });
    return beda;
  }

  // --- Perencanaan MPP (FR-03) --------------------------------------------
  function _sub(id) { return db.submissions.filter(function (x) { return x.submission_id === id; })[0] || null; }
  function _baris(id) { return db.line_items.filter(function (x) { return x.line_item_id === id; })[0] || null; }

  function subsDept(cycleId, departmentId) {
    return db.submissions.filter(function (s) {
      return s.cycle_id === cycleId && s.department_id === departmentId;
    });
  }

  // Submission aktif sebuah departemen adalah yang terakhir dibuat, karena setelah alokasi
  // dibagikan, departemen bisa membuka paket tambahan di luar siklus (F6-1).
  function submissionDepartemen(cycleId, departmentId) {
    var daftar = subsDept(cycleId, departmentId);
    var x = daftar[daftar.length - 1];
    return x ? salin(x) : null;
  }

  // Membuka permintaan di luar siklus (D16, F6-1 dan F6-2). Hanya HOD, hanya setelah paket
  // reguler departemen itu dibagikan alokasinya, dengan alasan mengapa tidak masuk siklus.
  function bukaPermintaanLuarSiklus(cycleId, departmentId, alasan) {
    var c = _sik(cycleId);
    if (!c || c.status !== "OPEN") return { ok: false, kunci: "plan.errBelumBuka" };
    if (sesi.user.role !== "HOD" && !NBRbac.can(sesi.user, "plan.review")) return { ok: false, kunci: "luar.errPeran" };
    if (!NBRbac.inScope(sesi.user, db.departments, departmentId)) return { ok: false, kunci: "plan.errLingkup" };
    if (!alasan || alasan.trim().length < 10) return { ok: false, kunci: "review.errAlasan" };
    var daftar = subsDept(cycleId, departmentId);
    var terakhir = daftar[daftar.length - 1];
    if (!terakhir || ["APPROVED", "DISTRIBUTED"].indexOf(terakhir.status) === -1) {
      return { ok: false, kunci: "luar.errBelumDibagikan" };
    }
    var urut = daftar.filter(function (x) { return x.off_cycle; }).length + 1;
    var sub = {
      submission_id: "SUB-" + c.year + "-" + departmentId.replace("D-", "") + "-A" + urut,
      cycle_id: cycleId, department_id: departmentId, status: "DRAFT", version: 1,
      off_cycle: true, off_cycle_reason: alasan,
      created_by: sesi.user.user_id, created_at: new Date().toISOString(),
      submitted_by: null, submitted_at: null, note: ""
    };
    db.submissions.push(sub);
    simpan();
    NBAudit.tulis(sesi.user, "PLAN_CREATE", "MPPSubmission", sub.submission_id,
      { key: "audit.d.luarSiklus", vars: { d: (_dep(departmentId) || {}).name }, reason: alasan });
    return { ok: true, submission: salin(sub) };
  }

  function barisSubmission(submissionId) {
    return salin(db.line_items.filter(function (l) { return l.submission_id === submissionId; }));
  }

  // Semua baris satu siklus dalam lingkup pengguna. Dipakai dashboard dan konsolidasi.
  function barisSiklusTerlihat(cycleId) {
    var subIds = db.submissions.filter(function (s) { return s.cycle_id === cycleId; })
                               .map(function (s) { return s.submission_id; });
    var rows = db.line_items.filter(function (l) { return subIds.indexOf(l.submission_id) !== -1; });
    return NBRbac.filterRows(sesi.user, db.departments, salin(rows), "department_id");
  }

  // Penjaga tunggal untuk semua penulisan usulan. Tiga lapis: siklus, kepemilikan, peran.
  function bolehRencana(cycleId, departmentId) {
    var c = _sik(cycleId);
    if (!c) return { ok: false, alasan: "Siklus tidak ditemukan" };
    if (c.status === "CLOSED") return { ok: false, kunci: "plan.errTutup" };
    if (c.status !== "OPEN") return { ok: false, kunci: "plan.errBelumBuka" };
    if (!NBRbac.can(sesi.user, "plan.create")) return { ok: false, kunci: "plan.errPeran" };
    if (!NBRbac.inScope(sesi.user, db.departments, departmentId)) return { ok: false, kunci: "plan.errLingkup" };
    var daftarSub = subsDept(cycleId, departmentId);
    var sub = daftarSub[daftarSub.length - 1];
    if (sub && sub.status !== "DRAFT" && sub.status !== "RETURNED") {
      return { ok: false, kunci: "plan.errTerkunci", vars: { s: sub.status } };
    }
    return { ok: true, submission: sub || null };
  }

  function pastikanSubmission(cycleId, departmentId) {
    var daftar = subsDept(cycleId, departmentId);
    var sub = daftar[daftar.length - 1];
    if (sub) return sub;
    sub = {
      submission_id: "SUB-" + String(_sik(cycleId).year) + "-" + departmentId.replace("D-", ""),
      cycle_id: cycleId, department_id: departmentId, status: "DRAFT", version: 1,
      created_by: sesi.user.user_id, created_at: new Date().toISOString(),
      submitted_by: null, submitted_at: null, note: ""
    };
    db.submissions.push(sub);
    NBAudit.tulis(sesi.user, "PLAN_CREATE", "MPPSubmission", sub.submission_id,
      { key: "audit.d.subCreate", vars: { d: (_dep(departmentId) || {}).name } });
    return sub;
  }

  function nomorBaris() {
    var n = db.line_items.length + 1;
    while (_baris("LI-" + String(n).padStart(4, "0"))) n += 1;
    return "LI-" + String(n).padStart(4, "0");
  }

  function tambahBaris(cycleId, departmentId, data) {
    var jaga = bolehRencana(cycleId, departmentId);
    if (!jaga.ok) {
      NBAudit.tulis(sesi.user, "SCOPE_DENIED", "MPPLineItem", departmentId, { key: "audit.d.denyPlan" });
      return jaga;
    }
    // Manajer hanya boleh mengusulkan orang di pohonnya sendiri.
    if (data.employee_id && sesi.user.scope.type === "TREE" &&
        !NBRbac.employeeInScope(sesi.user, db.departments, data.employee_id, pohonOrganisasi())) {
      NBAudit.tulis(sesi.user, "SCOPE_DENIED", "MPPLineItem", data.employee_id, { key: "audit.d.denyPohon" });
      return { ok: false, kunci: "plan.errPohon" };
    }
    var sub = pastikanSubmission(cycleId, departmentId);
    // HOD menang: baris manajer untuk orang yang sama ditandai ditimpa, tetap terlihat.
    if (data.employee_id && sesi.user.role !== "MANAGER") {
      db.line_items.forEach(function (l) {
        if (l.submission_id === sub.submission_id && l.employee_id === data.employee_id &&
            l.proposed_role === "MANAGER" && !l.superseded_by) {
          l.superseded_by = sesi.user.user_id;
          l.status = "SUPERSEDED";
        }
      });
    }
    var baris = {
      line_item_id: nomorBaris(), submission_id: sub.submission_id, department_id: departmentId,
      proposed_by: sesi.user.user_id, proposed_role: sesi.user.role,
      action_type: data.action_type, employee_id: data.employee_id || null,
      position_id: data.position_id || null, vacancy_id: data.vacancy_id || null,
      target_grade_id: data.target_grade_id || null,
      target_department_id: data.target_department_id || null,
      target_manager_id: data.target_manager_id || null,
      linked_line_item_id: data.linked_line_item_id || null,
      quantity: Number(data.quantity || 1), effective_month: Number(data.effective_month || 0),
      replacement_flag: data.replacement_flag || null, vacancy_subtype: data.vacancy_subtype || null,
      new_position_title: data.new_position_title || null,
      fill_immediately: !!data.fill_immediately, reduction_reason: data.reduction_reason || null,
      parent_line_item_id: data.parent_line_item_id || null,
      justification: data.justification || "", status: "DRAFT",
      created_at: new Date().toISOString()
    };
    db.line_items.push(baris);
    simpan();
    NBAudit.tulis(sesi.user, "PLAN_LINE_ADD", "MPPLineItem", baris.line_item_id,
      { key: "audit.d.lineAdd", vars: { a: baris.action_type, d: (_dep(departmentId) || {}).name } });
    return { ok: true, baris: salin(baris) };
  }

  function ubahBaris(lineId, data) {
    var b = _baris(lineId);
    if (!b) return { ok: false, kunci: "plan.errBarisHilang" };
    var sub = _sub(b.submission_id);
    var jaga = bolehRencana(sub.cycle_id, b.department_id);
    if (!jaga.ok) return jaga;

    var sebelum = JSON.stringify({
      action_type: b.action_type, quantity: b.quantity, effective_month: b.effective_month,
      target_grade_id: b.target_grade_id
    });
    Object.keys(data).forEach(function (k) {
      if (k === "quantity" || k === "effective_month") b[k] = Number(data[k] || 0);
      else if (k === "fill_immediately") b[k] = !!data[k];
      else b[k] = data[k];
    });
    var sesudah = JSON.stringify({
      action_type: b.action_type, quantity: b.quantity, effective_month: b.effective_month,
      target_grade_id: b.target_grade_id
    });
    simpan();
    NBAudit.tulis(sesi.user, "PLAN_LINE_EDIT", "MPPLineItem", lineId,
      { key: "audit.d.lineEdit", vars: { a: b.action_type } }, sebelum, sesudah);
    return { ok: true, baris: salin(b) };
  }

  function hapusBaris(lineId) {
    var b = _baris(lineId);
    if (!b) return { ok: false, kunci: "plan.errBarisHilang" };
    var sub = _sub(b.submission_id);
    var jaga = bolehRencana(sub.cycle_id, b.department_id);
    if (!jaga.ok) return jaga;
    // Baris induk tidak boleh dihapus selama masih punya anak, supaya tautan tidak menggantung.
    var anak = db.line_items.filter(function (x) { return x.parent_line_item_id === lineId; });
    if (anak.length) return { ok: false, kunci: "plan.errPunyaAnak", vars: { n: anak.length } };

    db.line_items = db.line_items.filter(function (x) { return x.line_item_id !== lineId; });
    simpan();
    NBAudit.tulis(sesi.user, "PLAN_LINE_DELETE", "MPPLineItem", lineId,
      { key: "audit.d.lineDelete", vars: { a: b.action_type } }, b.action_type, null);
    return { ok: true };
  }

  // Headcount berjalan satu departemen, diambil dari snapshot bila sudah ada,
  // kalau belum dari master. Snapshot yang menang, karena itulah baseline Current.
  function currentHc(cycleId, departmentId) {
    var snap = snapshotAktif(cycleId);
    if (snap) {
      var s = _snap(snap.snapshot_id);
      return (s.lines || []).filter(function (l) { return l.department_id === departmentId; }).length;
    }
    return db.employees.filter(function (e) { return e.department_id === departmentId; }).length;
  }

  // Validasi satu baris memakai konteks yang dirakit di sini, bukan di layar.
  function periksaBaris(baris) {
    var sub = _sub(baris.submission_id);
    var semua = sub ? db.line_items.filter(function (l) { return l.submission_id === sub.submission_id; }) : [];
    var kar = baris.employee_id ? _kar(baris.employee_id) : null;
    var vac = baris.vacancy_id
      ? db.vacancies.filter(function (v) { return v.vacancy_id === baris.vacancy_id; })[0] : null;
    var atasanTujuan = baris.target_manager_id ? _kar(baris.target_manager_id) : null;
    return NBValidate.periksa(baris, {
      semuaBaris: salin(semua),
      gradeAsal: kar ? kar.grade_id : (baris.action_type === "POSITION_CREATION" ? null : null),
      vacancyStatus: vac ? vac.status : null,
      // Mutasi internal: atasan tujuan harus ada dan berada di departemen yang sama.
      lintasEntitas: baris.target_department_id
        ? (entitasDepartemen(baris.target_department_id) !== entitasDepartemen(baris.department_id))
        : null,
      karyawanSementara: !!(kar && kar.sementara),
      atasanTujuan: baris.target_manager_id
        ? !!(atasanTujuan && atasanTujuan.department_id === baris.department_id) : null,
      atasanSekarang: kar ? (kar.direct_report_id || null) : null,
      currentHc: sub ? currentHc(sub.cycle_id, baris.department_id) : null,
      levelGrade: function (id) {
        var g = db.grades.filter(function (x) { return x.grade_id === id; })[0];
        return g ? g.level : 0;
      }
    });
  }

  // --- Pengiriman dan review usulan (FR-04) --------------------------------
  // Status submission: DRAFT, SUBMITTED, RETURNED, OD_ACCEPTED.
  // Jalur mundur satu-satunya adalah RETURNED, dan wajib menyertakan alasan (bab 16).

  function ringkasSubmission(sub) {
    var baris = db.line_items.filter(function (l) { return l.submission_id === sub.submission_id; });
    var galat = 0, peringatan = 0;
    baris.forEach(function (b) {
      var h = periksaBaris(b);
      galat += h.errors.length ? 1 : 0;
      peringatan += h.warnings.length ? 1 : 0;
    });
    var rekap = NBActions.rekap(salin(baris), sub.department_id);
    return {
      baris: baris.length, galat: galat, peringatan: peringatan,
      netto: rekap.netto, tambah: rekap.tambah + rekap.masuk, kurang: rekap.kurang + rekap.keluar,
      mutasiMenunggu: baris.filter(function (b) {
        return b.action_type === "TRANSFER" && b.transfer_status === "PENDING";
      }).length
    };
  }

  function daftarSubmission(cycleId) {
    var rows = db.submissions.filter(function (s) { return s.cycle_id === cycleId; });
    return NBRbac.filterRows(sesi.user, db.departments, salin(rows), "department_id")
      .map(function (s) { s.ringkas = ringkasSubmission(s); return s; });
  }

  // Kirim usulan ke OD. Ditolak selama masih ada baris bergalat, karena mengirim
  // usulan yang belum lolos validasi hanya memindahkan pekerjaan ke OD.
  function kirimSubmission(cycleId, departmentId) {
    var jaga = bolehRencana(cycleId, departmentId);
    if (!jaga.ok) return jaga;
    // Pengusul ke OD minimal HOD (K4 nomor 3). Manajer menyusun, tidak mengirim.
    if (!NBRbac.can(sesi.user, "plan.submit")) {
      NBAudit.tulis(sesi.user, "SCOPE_DENIED", "MPPSubmission", departmentId, { key: "audit.d.denyKirim" });
      return { ok: false, kunci: "kirim.errPeran" };
    }
    var daftarSub = subsDept(cycleId, departmentId);
    var sub = daftarSub[daftarSub.length - 1];
    if (!sub) return { ok: false, kunci: "kirim.errKosong" };

    var baris = db.line_items.filter(function (l) {
      return l.submission_id === sub.submission_id && l.status !== "SUPERSEDED";
    });
    if (!baris.length) return { ok: false, kunci: "kirim.errKosong" };
    var galat = baris.filter(function (b) { return periksaBaris(b).errors.length; });
    if (galat.length) return { ok: false, kunci: "kirim.errGalat", vars: { n: galat.length } };

    var c = _sik(cycleId);
    var sekarang = new Date().toISOString();
    sub.status = "SUBMITTED";
    sub.submitted_by = sesi.user.user_id;
    sub.submitted_at = sekarang;
    sub.is_late = sekarang.slice(0, 10) > c.submission_deadline;   // BR-H, penanda keterlambatan

    // BR-D: mutasi keluar menunggu konfirmasi departemen penerima.
    baris.forEach(function (b) {
      b.status = "SUBMITTED";
      if ((b.action_type === "TRANSFER" || b.action_type === "INTERNAL_TRANSFER" ||
           (b.action_type === "PLANNED_REDUCTION" && b.reduction_reason === "Pindah entitas")) && !b.transfer_status) {
        b.transfer_status = "PENDING";
      }
    });
    simpan();
    NBAudit.tulis(sesi.user, "PLAN_SUBMIT", "MPPSubmission", sub.submission_id,
      { key: "audit.d.submit", vars: { d: (_dep(departmentId) || {}).name, n: baris.length } },
      "DRAFT", "SUBMITTED");
    return { ok: true, submission: salin(sub) };
  }

  // Keputusan OD atas satu submission. ACCEPT mengunci, RETURN mengembalikan ke HOD.
  function reviewSubmission(submissionId, keputusan, alasan) {
    var sub = _sub(submissionId);
    if (!sub) return { ok: false, kunci: "kirim.errKosong" };
    if (!NBRbac.can(sesi.user, "plan.review")) {
      NBAudit.tulis(sesi.user, "SCOPE_DENIED", "MPPSubmission", submissionId, { key: "audit.d.denyReview" });
      return { ok: false, kunci: "review.errPeran" };
    }
    var c = _sik(sub.cycle_id);
    if (c.status === "CLOSED") return { ok: false, kunci: "plan.errTutup" };
    if (sub.status !== "SUBMITTED") return { ok: false, kunci: "review.errBelumDikirim", vars: { s: sub.status } };
    if (keputusan === "RETURN" && (!alasan || alasan.trim().length < 10)) {
      return { ok: false, kunci: "review.errAlasan" };
    }

    var sebelum = sub.status;
    sub.status = keputusan === "ACCEPT" ? "OD_ACCEPTED" : "RETURNED";
    sub.reviewed_by = sesi.user.user_id;
    sub.reviewed_at = new Date().toISOString();
    sub.review_note = alasan || null;
    if (keputusan === "RETURN") {
      sub.version += 1;   // versi naik supaya riwayat revisi terbaca (bab 16)
      db.line_items.forEach(function (l) {
        if (l.submission_id === sub.submission_id) l.status = "DRAFT";
      });
    }
    simpan();
    NBAudit.tulis(sesi.user, keputusan === "ACCEPT" ? "PLAN_ACCEPT" : "PLAN_RETURN",
      "MPPSubmission", sub.submission_id,
      { key: keputusan === "ACCEPT" ? "audit.d.accept" : "audit.d.return",
        vars: { d: (_dep(sub.department_id) || {}).name }, reason: alasan || null },
      sebelum, sub.status);
    return { ok: true, submission: salin(sub) };
  }

  // Mutasi masuk yang menunggu keputusan departemen penerima (BR-D).
  function mutasiMasuk(cycleId) {
    var subIds = db.submissions.filter(function (s) { return s.cycle_id === cycleId; })
                               .map(function (s) { return s.submission_id; });
    var rows = db.line_items.filter(function (l) {
      return subIds.indexOf(l.submission_id) !== -1 && l.transfer_status &&
        ((l.action_type === "TRANSFER" && l.target_department_id) ||
         l.action_type === "INTERNAL_TRANSFER" ||
         (l.action_type === "PLANNED_REDUCTION" && l.reduction_reason === "Pindah entitas" && l.target_department_id));
    });
    var izin = NBRbac.scopeDepartments(sesi.user, db.departments);
    // Mutasi antar departemen menunggu penerima; mutasi internal menunggu HOD departemen sendiri.
    return salin(rows.filter(function (l) {
      var dept = l.action_type === "INTERNAL_TRANSFER" ? l.department_id : l.target_department_id;
      if (izin.indexOf(dept) === -1) return false;
      if (l.action_type === "INTERNAL_TRANSFER" && sesi.user.role === "MANAGER") return false;
      return true;
    }));
  }

  // Keputusan 4c dan 5c: atasan baru untuk mutasi antar departemen ditetapkan OD saat
  // review, wajib ada sebelum konsolidasi dikunci. HOD tujuan tetap mengonfirmasi mutasinya.
  function tetapkanAtasanMutasi(lineId, managerId) {
    var b = _baris(lineId);
    if (!b || b.action_type !== "TRANSFER") return { ok: false, kunci: "plan.errBarisHilang" };
    if (!NBRbac.can(sesi.user, "plan.review")) return { ok: false, kunci: "mutasi.errHanyaOd" };
    var m = _kar(managerId);
    if (!m || m.department_id !== b.target_department_id) return { ok: false, kunci: "mutasi.errAtasanBukanTujuan" };
    if (levelGrade(m.grade_id) < NBOrganisasi.LEVEL_MANAJER) return { ok: false, kunci: "mutasi.errAtasanBukanManajer" };
    var sebelum = b.target_manager_id || null;
    b.target_manager_id = managerId;
    catatRevisi("MPPLineItem", lineId, "target_manager_id", sebelum, managerId, null, b.version || 1);
    simpan();
    NBAudit.tulis(sesi.user, "DATA_EDIT", "MPPLineItem", lineId,
      { key: "audit.d.atasanMutasi", vars: { n: m.name } }, sebelum || "-", managerId);
    return { ok: true };
  }

  // Konfirmasi pindah entitas (F9-1). HOD tujuan memilih posisi, dan sistem membuat baris
  // Rekrutmen Eksternal di paketnya yang tertaut ke baris pengurangan di entitas asal.
  // Biayanya dihitung di mata uang tujuan, headcount grup netral, headcount entitas berubah.
  function konfirmasiPindahEntitas(lineId, positionId, alasan) {
    var b = _baris(lineId);
    if (!b || b.reduction_reason !== "Pindah entitas") return { ok: false, kunci: "plan.errBarisHilang" };
    if (!NBRbac.inScope(sesi.user, db.departments, b.target_department_id)) {
      NBAudit.tulis(sesi.user, "SCOPE_DENIED", "MPPLineItem", lineId, { key: "audit.d.denyTransfer" });
      return { ok: false, kunci: "plan.errLingkup" };
    }
    if (sesi.user.role === "MANAGER") return { ok: false, kunci: "mutasi.errHanyaHod", vars: { n: "-" } };
    if (b.transfer_status !== "PENDING") return { ok: false, kunci: "mutasi.errSudah" };
    var pos = _pos(positionId);
    if (!pos || pos.department_id !== b.target_department_id) return { ok: false, kunci: "pindah.errPosisi" };
    var sub = _sub(b.submission_id);
    var jaga = bolehRencana(sub.cycle_id, b.target_department_id);
    if (!jaga.ok) return jaga;
    var e = _kar(b.employee_id) || {};
    var res = tambahBaris(sub.cycle_id, b.target_department_id, {
      action_type: "EXTERNAL_HIRING", position_id: positionId, quantity: 1,
      effective_month: b.effective_month, replacement_flag: "Additional",
      justification: (alasan || "") + " (pindah entitas: " + (e.name || b.employee_id) + " dari " +
                     ((_dep(b.department_id) || {}).name || b.department_id) + ")",
      linked_line_item_id: lineId
    });
    if (!res.ok) return res;
    var baru = _baris(res.baris.line_item_id);
    baru.linked_line_item_id = lineId;
    b.linked_line_item_id = baru.line_item_id;
    b.transfer_status = "CONFIRMED";
    simpan();
    NBAudit.tulis(sesi.user, "TRANSFER_DECISION", "MPPLineItem", lineId,
      { key: "audit.d.pindahEntitas", vars: { d: (_dep(b.target_department_id) || {}).name, id: baru.line_item_id } });
    return { ok: true, baris: salin(baru) };
  }

  function konfirmasiMutasi(lineId, keputusan, alasan) {
    var b = _baris(lineId);
    if (!b) return { ok: false, kunci: "plan.errBarisHilang" };
    // Mutasi internal dikonfirmasi HOD departemennya sendiri (K4 nomor 7), bukan manajer penerima.
    if (b.action_type === "PLANNED_REDUCTION") return { ok: false, kunci: "pindah.errLewatKonfirmasiBiasa" };
    if (b.action_type === "INTERNAL_TRANSFER") {
      var hodNya = hodDari(b.department_id);
      var akuHod = sesi.user.role === "HOD" && sesi.user.scope.department_id === b.department_id;
      if (!akuHod && !NBRbac.can(sesi.user, "plan.review")) {
        NBAudit.tulis(sesi.user, "SCOPE_DENIED", "MPPLineItem", lineId, { key: "audit.d.denyTransfer" });
        return { ok: false, kunci: "mutasi.errHanyaHod", vars: { n: hodNya ? hodNya.name : "-" } };
      }
    } else if (!NBRbac.inScope(sesi.user, db.departments, b.target_department_id)) {
      NBAudit.tulis(sesi.user, "SCOPE_DENIED", "MPPLineItem", lineId, { key: "audit.d.denyTransfer" });
      return { ok: false, kunci: "plan.errLingkup" };
    }
    if (b.transfer_status !== "PENDING") return { ok: false, kunci: "mutasi.errBukanMenunggu" };
    if (keputusan === "REJECT" && (!alasan || alasan.trim().length < 10)) {
      return { ok: false, kunci: "review.errAlasan" };
    }
    var sebelum = b.transfer_status;
    b.transfer_status = keputusan === "CONFIRM" ? "CONFIRMED" : "REJECTED";
    b.transfer_note = alasan || null;
    b.transfer_by = sesi.user.user_id;
    simpan();
    NBAudit.tulis(sesi.user, "TRANSFER_DECISION", "MPPLineItem", lineId,
      { key: keputusan === "CONFIRM" ? "audit.d.transferOk" : "audit.d.transferNo",
        vars: { d: (_dep(b.department_id) || {}).name }, reason: alasan || null },
      sebelum, b.transfer_status);
    return { ok: true };
  }

  // --- Konsolidasi (FR-05) ------------------------------------------------
  // Menggabungkan seluruh usulan departemen menjadi satu angka perusahaan.
  // Tiga hal yang dijaga di sini dan tidak boleh berpindah ke layar:
  // 1. Baris turunan Position Creation tidak dihitung dua kali.
  // 2. Mutasi hanya berlaku setelah departemen penerima mengonfirmasi (BR-D).
  // 3. Mutasi yang berlaku selalu netral di tingkat perusahaan, hanya berpindah departemen.

  var STATUS_IKUT = ["OD_ACCEPTED", "CONSOLIDATED", "APPROVED", "DISTRIBUTED"];

  function konsolidasi(cycleId) {
    var subs = db.submissions.filter(function (s) { return s.cycle_id === cycleId; });
    var ikut = subs.filter(function (s) { return STATUS_IKUT.indexOf(s.status) !== -1; });
    var idIkut = ikut.map(function (s) { return s.submission_id; });
    var baris = db.line_items.filter(function (l) {
      return idIkut.indexOf(l.submission_id) !== -1 && l.status !== "SUPERSEDED";
    });

    var perDept = db.departments.map(function (d) {
      // Departemen tujuan hanya relevan untuk mutasi. Pindah entitas menyimpan tujuan juga,
      // tetapi dampaknya di tujuan datang dari baris rekrutmen yang tertaut, bukan dari sini.
      var milik = baris.filter(function (l) {
        return l.department_id === d.department_id ||
               (l.action_type === "TRANSFER" && l.target_department_id === d.department_id);
      });
      var r = NBActions.rekap(milik, d.department_id);
      var current = currentHc(cycleId, d.department_id);
      var subsD = subs.filter(function (s) { return s.department_id === d.department_id; });
      var sub = subsD[subsD.length - 1];
      var adaYangIkut = subsD.some(function (s) { return STATUS_IKUT.indexOf(s.status) !== -1; });
      return {
        department_id: d.department_id, name: d.name, division_id: d.division_id,
        cost_center_id: d.cost_center_id,
        status: sub ? sub.status : "NONE",
        luarSiklus: sub ? !!sub.off_cycle : false,
        ikut: adaYangIkut,
        baris: baris.filter(function (l) { return l.department_id === d.department_id; }).length,
        current: current, tambah: r.tambah + r.masuk, kurang: r.kurang + r.keluar,
        netto: r.netto, proposed: current + r.netto
      };
    });

    // Rekap per jenis action. Kolom hc memakai dampak perusahaan, jadi mutasi selalu nol.
    var perAction = {};
    NBActions.daftar().forEach(function (k) { perAction[k] = { action: k, baris: 0, qty: 0, hc: 0 }; });
    baris.forEach(function (l) {
      var a = perAction[l.action_type];
      if (!a) return;
      a.baris += 1;
      a.qty += (NBActions.def(l.action_type).perluKuantitas ? Number(l.quantity || 0) : 1);
      if (l.action_type === "TRANSFER") return;         // netral di tingkat perusahaan
      a.hc += NBActions.dampakHc(l).perusahaan;
    });

    // Sebaran bulan efektif. Ini yang nanti dipakai mesin biaya untuk prorata (BR-E).
    var perBulan = [];
    for (var m = 1; m <= 12; m++) perBulan.push({ bulan: m, tambah: 0, kurang: 0 });
    baris.forEach(function (l) {
      if (l.action_type === "TRANSFER") return;
      var m = Number(l.effective_month);
      if (!m || m < 1 || m > 12) return;
      var hc = NBActions.dampakHc(l).perusahaan;
      if (hc > 0) perBulan[m - 1].tambah += hc;
      if (hc < 0) perBulan[m - 1].kurang += Math.abs(hc);
    });

    // Pengecualian yang harus dilihat OD sebelum mengunci.
    var exceptions = [];
    subs.forEach(function (s) {
      if (STATUS_IKUT.indexOf(s.status) === -1) {
        exceptions.push({ jenis: s.off_cycle ? "LUARSIKLUS" : "SUBMISSION",
                          kunci: s.off_cycle ? "kons.exLuar" : "kons.exSub",
                          vars: { d: (_dep(s.department_id) || {}).name, s: s.status } });
      }
    });
    db.departments.forEach(function (d) {
      if (!subs.filter(function (s) { return s.department_id === d.department_id; }).length) {
        exceptions.push({ jenis: "KOSONG", kunci: "kons.exKosong", vars: { d: d.name } });
      }
    });
    baris.forEach(function (l) {
      if (l.action_type === "TRANSFER" && l.transfer_status !== "CONFIRMED") {
        exceptions.push({ jenis: "MUTASI", kunci: "kons.exMutasi",
                          vars: { d: (_dep(l.department_id) || {}).name, id: l.line_item_id,
                                  s: l.transfer_status || "PENDING" } });
      }
    });

    // Tingkat entitas: departemen dijumlahkan per legal entity (F4-5).
    var perEntitas = {};
    perDept.forEach(function (d) {
      var ent = entitasDepartemen(d.department_id) || "-";
      var e = perEntitas[ent] || (perEntitas[ent] = { entity_id: ent,
        name: (db.entities.filter(function (x) { return x.entity_id === ent; })[0] || {}).name || ent,
        current: 0, tambah: 0, kurang: 0, netto: 0, proposed: 0, departemen: 0 });
      e.current += d.current; e.tambah += d.tambah; e.kurang += d.kurang;
      e.netto += d.netto; e.proposed += d.proposed; e.departemen += 1;
    });

    var total = perDept.reduce(function (acc, d) {
      acc.current += d.current; acc.tambah += d.tambah; acc.kurang += d.kurang;
      acc.netto += d.netto; acc.proposed += d.proposed;
      return acc;
    }, { current: 0, tambah: 0, kurang: 0, netto: 0, proposed: 0 });

    // Mutasi berpindah antar departemen, jadi tambah dan kurang di tingkat perusahaan
    // tidak boleh ikut menghitungnya dua kali.
    var mutasiBerlaku = baris.filter(function (l) {
      return l.action_type === "TRANSFER" && NBActions.mutasiBerlaku(l);
    }).length;
    total.tambah -= mutasiBerlaku;
    total.kurang -= mutasiBerlaku;
    total.mutasi = mutasiBerlaku;
    total.baris = baris.length;

    return {
      cycle_id: cycleId, perDept: perDept, perAction: Object.keys(perAction).map(function (k) { return perAction[k]; }),
      perEntitas: Object.keys(perEntitas).map(function (k) { return perEntitas[k]; }),
      perBulan: perBulan, exceptions: exceptions, total: total,
      kelengkapan: { ikut: ikut.length, departemen: db.departments.length,
                     terkunci: ikut.filter(function (s) { return s.status === "CONSOLIDATED"; }).length },
      terkunci: db.consolidations.filter(function (k) { return k.cycle_id === cycleId; })
                                 .sort(function (a, b) { return b.version - a.version; })
                                 .map(function (k) { return salin(k); })
    };
  }

  // Mengunci konsolidasi. Hasilnya menjadi catatan beku yang dipakai C&B di Modul 5.
  function kunciKonsolidasi(cycleId) {
    var c = _sik(cycleId);
    if (!c) return { ok: false, kunci: "kirim.errKosong" };
    if (c.status === "CLOSED") return { ok: false, kunci: "plan.errTutup" };
    if (!NBRbac.can(sesi.user, "consolidate")) {
      NBAudit.tulis(sesi.user, "SCOPE_DENIED", "Consolidation", cycleId, { key: "audit.d.denyKons" });
      return { ok: false, kunci: "kons.errPeran" };
    }
    var hasil = konsolidasi(cycleId);
    var siap = db.submissions.filter(function (s) {
      return s.cycle_id === cycleId && s.status === "OD_ACCEPTED";
    });
    if (!siap.length) return { ok: false, kunci: "kons.errBelumAda" };
    var idSiap = siap.map(function (x) { return x.submission_id; });
    var tanpaAtasan = db.line_items.filter(function (l) {
      return idSiap.indexOf(l.submission_id) !== -1 && l.action_type === "TRANSFER" &&
             l.transfer_status === "CONFIRMED" && !l.target_manager_id;
    });
    if (tanpaAtasan.length) {
      return { ok: false, kunci: "kons.errMutasiTanpaAtasan",
               vars: { n: tanpaAtasan.length, id: tanpaAtasan[0].line_item_id } };
    }

    var versi = db.consolidations.filter(function (k) { return k.cycle_id === cycleId; }).length + 1;
    var rec = {
      consolidation_id: "KONS-" + c.year + "-V" + versi,
      cycle_id: cycleId, version: versi,
      locked_by: sesi.user.user_id, locked_at: new Date().toISOString(),
      departemen: siap.length, baris: hasil.total.baris,
      current: hasil.total.current, netto: hasil.total.netto, proposed: hasil.total.proposed,
      per_dept: salin(hasil.perDept.filter(function (d) { return d.ikut; })),
      per_bulan: salin(hasil.perBulan)
    };
    db.consolidations.push(rec);
    siap.forEach(function (s) { s.status = "CONSOLIDATED"; });
    simpan();
    NBAudit.tulis(sesi.user, "CONSOLIDATE", "Consolidation", rec.consolidation_id,
      { key: "audit.d.konsolidasi",
        vars: { id: rec.consolidation_id, n: siap.length, hc: rec.proposed } });
    return { ok: true, konsolidasi: salin(rec) };
  }

  // --- Biaya (FR-06) ------------------------------------------------------
  // Asumsi biaya tidak pernah diubah di tempat. Setiap perubahan menjadi paket baru
  // dengan tanggal berlaku sendiri, sehingga angka lama tetap bisa direkonstruksi (BR-11).

  function paketBerlaku(daftar, tanggal) {
    var t = tanggal || new Date().toISOString().slice(0, 10);
    var cocok = daftar.filter(function (x) { return x.effective_date <= t; })
                      .sort(function (a, b) { return a.effective_date < b.effective_date ? 1 : -1; });
    return cocok[0] || daftar.sort(function (a, b) {
      return a.effective_date < b.effective_date ? -1 : 1;
    })[0] || null;
  }

  function parameterBiaya(tanggal) {
    var p = paketBerlaku(db.cost_parameters.slice(), tanggal);
    return p ? salin(p) : null;
  }

  function asumsiBiaya(tanggal, entityId) {
    var khusus = entityId ? db.cost_assumptions.filter(function (x) { return x.entity_id === entityId; }) : [];
    var umum = db.cost_assumptions.filter(function (x) { return !x.entity_id; });
    var a = paketBerlaku(khusus.slice(), tanggal) || paketBerlaku(umum.slice(), tanggal);
    return a ? salin(a) : null;
  }

  // Kurs ke Rupiah pada tanggal tertentu (F5-4). Rupiah selalu satu. Mata uang tanpa kurs
  // mengembalikan null, dan pemanggil wajib menandainya, bukan diam-diam memakai satu.
  //
  // Dikunci Kang Rangga: MPP memakai satu kurs anggaran untuk setahun, yaitu kurs yang
  // berlaku pada 1 Januari tahun siklus (tanggalAcuan). Kurs baru yang diunggah di tengah
  // tahun tidak menggeser angka siklus berjalan, karena anggaran yang sudah disetujui tidak
  // boleh berubah sendiri hanya karena mata uang bergerak.
  function kurs(currency, tanggal) {
    if (!currency || currency === "IDR") return 1;
    var t = tanggal || new Date().toISOString().slice(0, 10);
    var cocok = db.fx_rates.filter(function (k) { return k.currency === currency && k.effective_date <= t; })
                           .sort(function (a, b) { return a.effective_date < b.effective_date ? 1 : -1; });
    return cocok.length ? Number(cocok[0].rate_to_idr) : null;
  }

  function mataUangDepartemen(departmentId) {
    var ent = db.entities.filter(function (e) { return e.entity_id === entitasDepartemen(departmentId); })[0];
    return ent ? (ent.currency || "IDR") : "IDR";
  }

  function entitasDepartemen(departmentId) {
    var d = _dep(departmentId);
    if (!d) return null;
    if (d.entity_id) return d.entity_id;
    var div = db.divisions.filter(function (x) { return x.division_id === d.division_id; })[0];
    return div ? div.entity_id : null;
  }

  function semuaAsumsi() { return salin(db.cost_assumptions); }
  function semuaParameter() { return salin(db.cost_parameters); }

  // Tanggal acuan asumsi untuk satu siklus adalah 1 Januari tahun perencanaan.
  function tanggalAcuan(cycleId) {
    var c = _sik(cycleId);
    return c ? (c.year + "-01-01") : new Date().toISOString().slice(0, 10);
  }

  // Konteks biaya boleh dibatasi pada satu departemen supaya paket entitasnya yang dipakai.
  function konteksBiaya(cycleId, departmentId) {
    var t = tanggalAcuan(cycleId);
    var paket = asumsiBiaya(t, departmentId ? entitasDepartemen(departmentId) : null);
    var param = parameterBiaya(t);
    return {
      tanggal: t, assumption_id: paket ? paket.assumption_id : null,
      param_id: param ? param.param_id : null, param: param,
      asumsi: function (gradeId) {
        if (!paket) return null;
        return paket.grades.filter(function (g) { return g.grade_id === gradeId; })[0] || null;
      }
    };
  }

  // Rincian biaya bulanan satu grade, untuk layar asumsi.
  function biayaGrade(gradeId, cycleId) {
    var ctx = konteksBiaya(cycleId);
    if (!ctx.assumption_id) return null;
    var r = NBCosting.bulanan(ctx.asumsi(gradeId), ctx.param);
    if (r) { r.grade_id = gradeId; r.assumption_id = ctx.assumption_id; }
    return r;
  }

  // Grade asal dan tujuan satu baris usulan, dipakai mesin biaya.
  function gradeBaris(b) {
    var asal = null, tujuan = b.target_grade_id || null;
    if (b.employee_id) { var e = _kar(b.employee_id); asal = e ? e.grade_id : null; }
    if (b.position_id) { var p = _pos(b.position_id); if (!asal) asal = p ? p.grade_id : null; }
    if (b.vacancy_id) {
      var v = db.vacancies.filter(function (x) { return x.vacancy_id === b.vacancy_id; })[0];
      if (v) { asal = asal || v.grade_id; tujuan = tujuan || v.grade_id; }
    }
    if (!tujuan) tujuan = asal;
    return { asal: asal, tujuan: tujuan };
  }

  function biayaBaris(b) {
    var sub = _sub(b.submission_id);
    var ctx = konteksBiaya(sub ? sub.cycle_id : null, b.department_id);
    if (!ctx.assumption_id) return null;
    var g = gradeBaris(b);
    var hasil = NBCosting.baris(b, {
      asumsi: ctx.asumsi, param: ctx.param, gradeAsal: g.asal, gradeTujuan: g.tujuan
    });
    if (hasil) {
      hasil.assumption_id = ctx.assumption_id;
      hasil.grade_asal = g.asal;
      hasil.grade_tujuan = g.tujuan;
      hasil.mata_uang = mataUangDepartemen(b.department_id);
      var k0 = kurs(hasil.mata_uang, ctx.tanggal);
      hasil.annualized_idr = k0 === null ? null : Math.round(hasil.annualized_cost * k0);
      hasil.monthly_idr = k0 === null ? null : Math.round(hasil.monthly_cost * k0);
    }
    return hasil;
  }

  // Perhitungan biaya seluruh siklus, mengikuti baris yang ikut konsolidasi.
  function biayaSiklus(cycleId) {
    var subs = db.submissions.filter(function (s) {
      return s.cycle_id === cycleId && STATUS_IKUT.indexOf(s.status) !== -1;
    });
    var idIkut = subs.map(function (s) { return s.submission_id; });
    var baris = db.line_items.filter(function (l) {
      return idIkut.indexOf(l.submission_id) !== -1 && l.status !== "SUPERSEDED";
    });
    var ctx = konteksBiaya(cycleId);
    if (!ctx.assumption_id) return null;

    var rincian = [], perDept = {}, perBulan = [];
    for (var m = 1; m <= 12; m++) perBulan.push({ bulan: m, biaya: 0 });

    baris.forEach(function (l) {
      var h = biayaBaris(l);
      if (!h) return;
      // Mutasi yang belum dikonfirmasi tidak menimbulkan biaya di mana pun.
      if (l.action_type === "TRANSFER" && !NBActions.mutasiBerlaku(l)) return;
      rincian.push({ baris: salin(l), biaya: h });

      var d = perDept[l.department_id] || (perDept[l.department_id] = {
        department_id: l.department_id, name: (_dep(l.department_id) || {}).name,
        cost_center_id: (_dep(l.department_id) || {}).cost_center_id,
        monthly: 0, annualized: 0, baris: 0
      });
      d.mata_uang = mataUangDepartemen(l.department_id);
      d.kurs = kurs(d.mata_uang, ctx.tanggal);
      h.mata_uang = d.mata_uang;
      h.annualized_idr = d.kurs === null ? null : Math.round(h.annualized_cost * d.kurs);
      h.monthly_idr = d.kurs === null ? null : Math.round(h.monthly_cost * d.kurs);
      d.baris += 1; d.monthly += h.monthly_cost; d.annualized += h.annualized_cost;
      d.annualized_idr = (d.annualized_idr || 0) + (h.annualized_idr || 0);
      d.monthly_idr = (d.monthly_idr || 0) + (h.monthly_idr || 0);

      if (h.annualized_cost && l.effective_month >= 1 && l.effective_month <= 12) {
        for (var i = l.effective_month; i <= 12; i++) perBulan[i - 1].biaya += h.monthly_cost;
      }
    });

    // Total perusahaan selalu dalam Rupiah. Departemen dengan mata uang tanpa kurs dicatat
    // di tanpaKurs dan tidak ikut dijumlahkan, supaya angkanya tidak diam-diam salah.
    var tanpaKurs = [];
    var total = rincian.reduce(function (acc, r) {
      if (r.biaya.annualized_idr === null) {
        if (tanpaKurs.indexOf(r.biaya.mata_uang) === -1) tanpaKurs.push(r.biaya.mata_uang);
        return acc;
      }
      acc.monthly += r.biaya.monthly_idr;
      acc.annualized += r.biaya.annualized_idr;
      return acc;
    }, { monthly: 0, annualized: 0 });
    total.tanpaKurs = tanpaKurs;

    // Pembanding jujur: kalau seluruh usulan diasumsikan berlaku sejak Januari.
    var tanpaProrata = rincian.reduce(function (a, r) { return a + (r.biaya.monthly_idr || 0) * 12; }, 0);

    return {
      cycle_id: cycleId, assumption_id: ctx.assumption_id, param_id: ctx.param_id,
      tanggal: ctx.tanggal, rincian: rincian,
      perDept: Object.keys(perDept).map(function (k) { return perDept[k]; }),
      perBulan: perBulan, total: total, tanpaProrata: tanpaProrata,
      baris: rincian.length
    };
  }

  // --- Management review dan versioning (FR-07) ---------------------------
  // Keputusan Kang Rangga, pilihan A: manajemen boleh menurunkan angka, kenaikan wajib
  // lewat pengembalian ke departemen. Alasannya, menurunkan masih di dalam batas yang
  // sudah diusulkan dan sudah dijustifikasi HOD, sedangkan menaikkan menciptakan angka
  // yang tidak pernah diusulkan siapa pun dan tidak punya alasan bisnis penopang.

  function catatRevisi(objectType, objectId, field, dari, ke, alasan, versi) {
    var r = {
      revision_id: "REV-" + String(db.revisions.length + 1).padStart(4, "0"),
      object_type: objectType, object_id: objectId, field: field,
      old_value: dari, new_value: ke, reason: alasan || null,
      actor_id: sesi.user ? sesi.user.user_id : "-", version: versi || 1,
      timestamp: new Date().toISOString()
    };
    db.revisions.push(r);
    return r;
  }

  function revisiObjek(objectId) {
    return salin(db.revisions.filter(function (r) { return r.object_id === objectId; }));
  }

  function revisiSiklus(cycleId) {
    var subIds = db.submissions.filter(function (s) { return s.cycle_id === cycleId; })
                               .map(function (s) { return s.submission_id; });
    var lineIds = db.line_items.filter(function (l) { return subIds.indexOf(l.submission_id) !== -1; })
                               .map(function (l) { return l.line_item_id; });
    return salin(db.revisions.filter(function (r) {
      return lineIds.indexOf(r.object_id) !== -1 || subIds.indexOf(r.object_id) !== -1 ||
             r.object_id === cycleId;
    })).reverse();
  }

  // Baris yang siap diputuskan manajemen, yaitu yang sudah dikonsolidasikan.
  function barisReview(cycleId) {
    var subs = db.submissions.filter(function (s) {
      return s.cycle_id === cycleId &&
             ["CONSOLIDATED", "APPROVED", "DISTRIBUTED"].indexOf(s.status) !== -1;
    });
    var ids = subs.map(function (s) { return s.submission_id; });
    return salin(db.line_items.filter(function (l) {
      return ids.indexOf(l.submission_id) !== -1 && l.status !== "SUPERSEDED" &&
             (l.action_type !== "TRANSFER" || NBActions.mutasiBerlaku(l));
    }));
  }

  function kuantitasUsulan(l) {
    return NBActions.def(l.action_type).perluKuantitas ? Number(l.quantity || 0) : 1;
  }

  function kuantitasDisetujui(l) {
    return l.approved_quantity === undefined || l.approved_quantity === null
      ? kuantitasUsulan(l) : Number(l.approved_quantity);
  }

  // Keputusan atas satu baris. decision: APPROVE, REDUCE, REJECT.
  function putuskanBaris(lineId, keputusan, jumlahBaru, alasan) {
    var b = _baris(lineId);
    if (!b) return { ok: false, kunci: "plan.errBarisHilang" };
    if (!NBRbac.can(sesi.user, "review.decide")) {
      NBAudit.tulis(sesi.user, "SCOPE_DENIED", "MPPLineItem", lineId, { key: "audit.d.denyKeputusan" });
      return { ok: false, kunci: "mgmt.errPeran" };
    }
    var sub = _sub(b.submission_id);
    if (!sub || (sub.status !== "CONSOLIDATED")) {
      return { ok: false, kunci: "mgmt.errBelumKonsolidasi" };
    }
    var usulan = kuantitasUsulan(b);
    var baru = keputusan === "APPROVE" ? usulan
             : (keputusan === "REJECT" ? 0 : Math.floor(Number(jumlahBaru)));

    if (isNaN(baru) || baru < 0) return { ok: false, kunci: "mgmt.errAngka" };
    // Inti pilihan A: angka yang disetujui tidak pernah boleh melampaui yang diusulkan.
    if (baru > usulan) return { ok: false, kunci: "mgmt.errNaik", vars: { n: usulan } };
    if (keputusan !== "APPROVE" && (!alasan || alasan.trim().length < 10)) {
      return { ok: false, kunci: "review.errAlasan" };
    }
    if (keputusan === "REDUCE" && baru === usulan) {
      return { ok: false, kunci: "mgmt.errSamaSaja" };
    }

    var sebelum = kuantitasDisetujui(b);
    b.approved_quantity = baru;
    b.decision = keputusan === "REDUCE" ? "REDUCED" : (keputusan === "REJECT" ? "REJECTED" : "APPROVED");
    b.decision_reason = alasan || null;
    b.decided_by = sesi.user.user_id;
    b.decided_at = new Date().toISOString();
    b.version = (b.version || 1) + 1;

    catatRevisi("MPPLineItem", lineId, "approved_quantity", sebelum, baru, alasan, b.version);
    simpan();
    NBAudit.tulis(sesi.user, "MGMT_DECISION", "MPPLineItem", lineId,
      { key: "audit.d.keputusan", vars: { a: b.decision }, reason: alasan || null },
      String(sebelum), String(baru));
    return { ok: true, baris: salin(b) };
  }

  // Persetujuan tingkat siklus. Menutup tahap review dan membekukan angka Approved.
  function setujuiMpp(cycleId, catatan) {
    if (!NBRbac.can(sesi.user, "approve")) {
      NBAudit.tulis(sesi.user, "SCOPE_DENIED", "Approval", cycleId, { key: "audit.d.denyApprove" });
      return { ok: false, kunci: "mgmt.errPeran" };
    }
    var c = _sik(cycleId);
    if (!c || c.status === "CLOSED") return { ok: false, kunci: "plan.errTutup" };
    var subs = db.submissions.filter(function (s) {
      return s.cycle_id === cycleId && s.status === "CONSOLIDATED";
    });
    if (!subs.length) return { ok: false, kunci: "mgmt.errBelumAda" };

    var baris = barisReview(cycleId);
    var belum = baris.filter(function (l) { return !l.decision; });
    if (belum.length) return { ok: false, kunci: "mgmt.errBelumSemua", vars: { n: belum.length } };

    var versi = db.approvals.filter(function (a) { return a.cycle_id === cycleId; }).length + 1;
    var hcDisetujui = baris.reduce(function (a, l) {
      var salinan = Object.assign({}, l, { quantity: kuantitasDisetujui(l) });
      if (l.action_type === "TRANSFER") return a;
      return a + NBActions.dampakHc(salinan).perusahaan;
    }, 0);

    var rec = {
      approval_id: "APR-" + c.year + "-V" + versi,
      cycle_id: cycleId, version: versi,
      approved_by: sesi.user.user_id, approved_at: new Date().toISOString(),
      note: catatan || null, departemen: subs.length, baris: baris.length,
      netto_disetujui: hcDisetujui,
      assumption_id: konteksBiaya(cycleId).assumption_id
    };
    db.approvals.push(rec);
    subs.forEach(function (s) { s.status = "APPROVED"; });
    db.line_items.forEach(function (l) {
      if (subs.some(function (s) { return s.submission_id === l.submission_id; })) l.status = "APPROVED";
    });
    catatRevisi("MPPCycle", cycleId, "status", "CONSOLIDATED", "APPROVED", catatan, versi);
    simpan();
    NBAudit.tulis(sesi.user, "MGMT_APPROVE", "Approval", rec.approval_id,
      { key: "audit.d.approve", vars: { id: rec.approval_id, n: subs.length, hc: hcDisetujui },
        reason: catatan || null });
    return { ok: true, approval: salin(rec) };
  }

  // Mengembalikan seluruh paket ke departemen. Ini satu-satunya jalan menaikkan angka.
  function kembalikanKeDepartemen(cycleId, alasan) {
    if (!NBRbac.can(sesi.user, "review.decide")) return { ok: false, kunci: "mgmt.errPeran" };
    if (!alasan || alasan.trim().length < 10) return { ok: false, kunci: "review.errAlasan" };
    var subs = db.submissions.filter(function (s) {
      return s.cycle_id === cycleId && s.status === "CONSOLIDATED";
    });
    if (!subs.length) return { ok: false, kunci: "mgmt.errBelumAda" };

    subs.forEach(function (s) {
      var sebelum = s.status;
      s.status = "RETURNED";
      s.version += 1;
      s.review_note = alasan;
      catatRevisi("MPPSubmission", s.submission_id, "status", sebelum, "RETURNED", alasan, s.version);
      db.line_items.forEach(function (l) { if (l.submission_id === s.submission_id) l.status = "DRAFT"; });
    });
    simpan();
    NBAudit.tulis(sesi.user, "MGMT_RETURN", "MPPCycle", cycleId,
      { key: "audit.d.mgmtReturn", vars: { n: subs.length }, reason: alasan });
    return { ok: true, jumlah: subs.length };
  }

  function approvalSiklus(cycleId) {
    return salin(db.approvals.filter(function (a) { return a.cycle_id === cycleId; }))
      .sort(function (a, b) { return b.version - a.version; });
  }

  // Ringkasan usulan versus disetujui, termasuk sisi biayanya.
  function ringkasKeputusan(cycleId) {
    var baris = barisReview(cycleId);
    var ctx = konteksBiaya(cycleId);
    var hasil = { baris: [], usulanHc: 0, disetujuiHc: 0, usulanBiaya: 0, disetujuiBiaya: 0,
                  diputuskan: 0, dikurangi: 0, ditolak: 0 };

    baris.forEach(function (l) {
      var usulanQty = kuantitasUsulan(l);
      var setujuQty = kuantitasDisetujui(l);
      var biayaUsulan = biayaBaris(l);
      var barisSetuju = Object.assign({}, l, { quantity: setujuQty });
      if (setujuQty === 0) barisSetuju.fill_immediately = false;
      var g = gradeBaris(l);
      var biayaSetuju = setujuQty === 0 ? { monthly_cost: 0, annualized_cost: 0, applicable_months: 0 }
        : NBCosting.baris(barisSetuju, { asumsi: ctx.asumsi, param: ctx.param,
                                         gradeAsal: g.asal, gradeTujuan: g.tujuan });

      var hcUsulan = l.action_type === "TRANSFER" ? 0 : NBActions.dampakHc(l).perusahaan;
      var hcSetuju = l.action_type === "TRANSFER" ? 0
        : NBActions.dampakHc(Object.assign({}, barisSetuju,
            { fill_immediately: setujuQty > 0 && l.fill_immediately })).perusahaan;

      hasil.usulanHc += hcUsulan;
      hasil.disetujuiHc += hcSetuju;
      hasil.usulanBiaya += biayaUsulan ? biayaUsulan.annualized_cost : 0;
      hasil.disetujuiBiaya += biayaSetuju ? biayaSetuju.annualized_cost : 0;
      if (l.decision) hasil.diputuskan += 1;
      if (l.decision === "REDUCED") hasil.dikurangi += 1;
      if (l.decision === "REJECTED") hasil.ditolak += 1;

      hasil.baris.push({
        baris: l, usulanQty: usulanQty, setujuQty: setujuQty,
        hcUsulan: hcUsulan, hcSetuju: hcSetuju,
        biayaUsulan: biayaUsulan, biayaSetuju: biayaSetuju
      });
    });
    return hasil;
  }

  // --- Approved Allocation dan distribusi (FR-07 lanjutan, bab 20 dan 21) ---
  // Entitas ini tidak ada di dokumen. Saya tambahkan pada fase perencanaan, gap nomor 1,
  // karena keputusan manajemen tersimpan di tabel Approval yang terikat sesi review,
  // sedangkan monitoring sepanjang tahun butuh objek yang bisa dikurangi. Tanpa alokasi
  // sebagai objek tersendiri, sisa kuota harus dihitung ulang dari log setiap kali layar
  // dibuka, dan angkanya akan berbeda antar layar.

  function alokasiSiklus(cycleId) {
    return db.allocations.filter(function (a) { return a.cycle_id === cycleId; });
  }

  function alokasiTerlihat(cycleId) {
    return NBRbac.filterRows(sesi.user, db.departments,
      salin(alokasiSiklus(cycleId)), "department_id");
  }

  function alokasiBaris(lineId) {
    var a = db.allocations.filter(function (x) { return x.line_item_id === lineId; })[0];
    return a ? salin(a) : null;
  }

  // Membuat alokasi dari baris yang sudah disetujui, lalu membagikannya ke departemen.
  function distribusikanAlokasi(cycleId) {
    if (!NBRbac.can(sesi.user, "approved.distribute")) {
      NBAudit.tulis(sesi.user, "SCOPE_DENIED", "Allocation", cycleId, { key: "audit.d.denyDistribusi" });
      return { ok: false, kunci: "alok.errPeran" };
    }
    var c = _sik(cycleId);
    if (!c || c.status === "CLOSED") return { ok: false, kunci: "plan.errTutup" };
    var apr = db.approvals.filter(function (a) { return a.cycle_id === cycleId; })
                          .sort(function (a, b) { return b.version - a.version; })[0];
    if (!apr) return { ok: false, kunci: "alok.errBelumDisetujui" };
    if (alokasiSiklus(cycleId).some(function (a) { return a.approval_id === apr.approval_id; })) {
      return { ok: false, kunci: "alok.errSudah", vars: { id: apr.approval_id } };
    }

    var subs = db.submissions.filter(function (s) {
      return s.cycle_id === cycleId && (s.status === "APPROVED" || s.status === "DISTRIBUTED");
    });
    var ids = subs.map(function (s) { return s.submission_id; });
    var ctx = konteksBiaya(cycleId);
    var dibuat = 0;
    var nomor = alokasiSiklus(cycleId).length;

    db.line_items.forEach(function (l) {
      if (ids.indexOf(l.submission_id) === -1) return;
      // Distribusi bertahap (F6-1): baris yang sudah menjadi alokasi tidak dibuat lagi.
      if (db.allocations.some(function (al) { return al.line_item_id === l.line_item_id; })) return;
      if (l.action_type === "TRANSFER" && !NBActions.mutasiBerlaku(l)) return;
      var qty = kuantitasDisetujui(l);
      if (qty <= 0) return;   // baris yang ditolak tidak menjadi alokasi

      var barisSetuju = Object.assign({}, l, { quantity: qty });
      var g = gradeBaris(l);
      var biaya = NBCosting.baris(barisSetuju, {
        asumsi: ctx.asumsi, param: ctx.param, gradeAsal: g.asal, gradeTujuan: g.tujuan
      });
      dibuat += 1; nomor += 1;
      db.allocations.push({
        allocation_id: "ALO-" + c.year + "-" + String(nomor).padStart(4, "0"),
        cycle_id: cycleId, approval_id: apr.approval_id, version: apr.version,
        line_item_id: l.line_item_id, submission_id: l.submission_id,
        department_id: l.department_id, target_department_id: l.target_department_id || null,
        action_type: l.action_type, position_id: l.position_id || null,
        vacancy_id: l.vacancy_id || null, employee_id: l.employee_id || null,
        new_position_title: l.new_position_title || null,
        grade_id: g.tujuan || g.asal, effective_month: l.effective_month,
        approved_qty: qty, consumed_qty: 0, remaining_qty: qty,
        hc_impact: l.action_type === "TRANSFER" ? 0 : NBActions.dampakHc(barisSetuju).perusahaan,
        monthly_cost: biaya ? biaya.monthly_cost : 0,
        annualized_cost: biaya ? biaya.annualized_cost : 0,
        assumption_id: ctx.assumption_id,
        status: "OPEN", distributed_at: new Date().toISOString(),
        distributed_by: sesi.user.user_id
      });
    });

    if (!dibuat) return { ok: false, kunci: "alok.errKosong" };
    subs.forEach(function (s) { s.status = "DISTRIBUTED"; });
    catatRevisi("MPPCycle", cycleId, "distribusi", apr.approval_id, dibuat + " alokasi", null, apr.version);
    simpan();
    NBAudit.tulis(sesi.user, "ALLOC_DISTRIBUTE", "Allocation", apr.approval_id,
      { key: "audit.d.distribusi", vars: { n: dibuat, d: subs.length, id: apr.approval_id } });
    return { ok: true, jumlah: dibuat };
  }

  // Tabel Requested, Approved, Variance per departemen (bab 20).
  function ringkasAlokasi(cycleId) {
    var alokasi = alokasiTerlihat(cycleId);
    var deps = departemenTerlihat();
    var baris = barisReview(cycleId);

    var perDept = deps.map(function (d) {
      var milik = alokasi.filter(function (a) { return a.department_id === d.department_id; });
      var usulan = baris.filter(function (l) { return l.department_id === d.department_id; });
      var reqHc = usulan.reduce(function (a, l) {
        return a + (l.action_type === "TRANSFER" ? 0 : NBActions.dampakHc(l).perusahaan);
      }, 0);
      var apprHc = milik.reduce(function (a, x) { return a + x.hc_impact; }, 0);
      return {
        department_id: d.department_id, name: d.name, cost_center_id: d.cost_center_id,
        requested: reqHc, approved: apprHc, variance: apprHc - reqHc,
        alokasi: milik.length,
        approvedQty: milik.reduce(function (a, x) { return a + x.approved_qty; }, 0),
        terpakai: milik.reduce(function (a, x) { return a + x.consumed_qty; }, 0),
        sisa: milik.reduce(function (a, x) { return a + x.remaining_qty; }, 0),
        biaya: milik.reduce(function (a, x) { return a + x.annualized_cost; }, 0)
      };
    }).filter(function (d) { return d.alokasi > 0 || d.requested !== 0; });

    var total = perDept.reduce(function (a, d) {
      a.requested += d.requested; a.approved += d.approved; a.variance += d.variance;
      a.approvedQty += d.approvedQty; a.terpakai += d.terpakai; a.sisa += d.sisa; a.biaya += d.biaya;
      return a;
    }, { requested: 0, approved: 0, variance: 0, approvedQty: 0, terpakai: 0, sisa: 0, biaya: 0 });

    return { perDept: perDept, total: total, alokasi: alokasi,
             terdistribusi: alokasiSiklus(cycleId).length > 0 };
  }

  // --- Monitoring realisasi (FR-08, bab 21 dan 22) --------------------------
  // Dua keputusan yang dipakai di sini, keduanya default yang disetujui Kang Rangga:
  // 1. Actual dihitung sejak tanggal masuk kerja, bukan tanda tangan kontrak atau payroll.
  // 2. Realisasi melebihi alokasi diblokir untuk penambahan headcount, sementara jenis lain
  //    tetap dicatat tetapi memunculkan exception yang harus diputuskan OD (BR-06).

  var AKSI_MENAMBAH = ["EXTERNAL_HIRING", "VACANCY_ACTION", "POSITION_CREATION"];

  function _alok(id) { return db.allocations.filter(function (a) { return a.allocation_id === id; })[0] || null; }

  function actualTerlihat(cycleId) {
    var rows = db.actuals.filter(function (a) { return a.cycle_id === cycleId; });
    return NBRbac.filterRows(sesi.user, db.departments, salin(rows), "department_id");
  }

  function exceptionTerlihat(cycleId) {
    var rows = db.exceptions.filter(function (e) { return e.cycle_id === cycleId; });
    return NBRbac.filterRows(sesi.user, db.departments, salin(rows), "department_id");
  }

  function hitungUlangAlokasi(alokasi) {
    var dipakai = 0;
    for (var i = 0; i < db.actuals.length; i++) {
      var a = db.actuals[i];
      if (a.allocation_id === alokasi.allocation_id && a.status === "RECORDED") {
        dipakai += Number(a.quantity || 0);
      }
    }
    alokasi.consumed_qty = dipakai;
    alokasi.remaining_qty = Math.max(0, alokasi.approved_qty - dipakai);
    alokasi.over_qty = Math.max(0, dipakai - alokasi.approved_qty);
    alokasi.status = dipakai === 0 ? "OPEN"
      : (dipakai < alokasi.approved_qty ? "PARTIAL"
      : (dipakai === alokasi.approved_qty ? "FULFILLED" : "OVER"));
  }

  // --- Realisasi menulis ke master (F5-1 sampai F5-3) -----------------------
  // Sebelum ini, realisasi hanya mengurangi kuota. Data master tidak pernah tahu bahwa
  // seseorang sudah promosi, pindah, atau keluar, sehingga bagan organisasi dan snapshot
  // berikutnya tetap membaca keadaan lama. Sekarang setiap realisasi menulis perubahannya
  // ke master, menyimpan nilai lama di riwayat revisi, dan pembatalan mengembalikannya.
  var nomorSementara = 0;

  function gantiNik(dari, ke) {
    db.employees.forEach(function (e) {
      if (e.employee_id === dari) { e.employee_id = ke; e.sementara = false; }
      if (e.direct_report_id === dari) e.direct_report_id = ke;
    });
    db.line_items.forEach(function (l) {
      if (l.employee_id === dari) l.employee_id = ke;
      if (l.target_manager_id === dari) l.target_manager_id = ke;
    });
    db.actuals.forEach(function (x) {
      if (x.employee_id === dari) x.employee_id = ke;
      if (x.karyawan_baru) x.karyawan_baru = x.karyawan_baru.map(function (n) { return n === dari ? ke : n; });
      (x.jejak_master || []).forEach(function (j) { if (j.employee_id === dari) j.employee_id = ke; });
    });
    (db.users || []).forEach(function (u) {
      if (u.employee_id === dari) u.employee_id = ke;
      if (u.scope && u.scope.employee_id === dari) u.scope.employee_id = ke;
    });
    catatRevisi("Employee", ke, "employee_id", dari, ke, "Impor berkas karyawan", 1);
  }

  function terapkanKeMaster(rec, a, data) {
    var l = _baris(a.line_item_id) || {};
    var jejak = [];   // {employee_id, field, dari, ke} untuk dibalik saat pembatalan
    function ubahField(e, field, ke) {
      if (e[field] === ke) return;
      jejak.push({ employee_id: e.employee_id, field: field, dari: e[field] === undefined ? null : e[field], ke: ke });
      catatRevisi("Employee", e.employee_id, field, e[field] === undefined ? null : e[field], ke,
                  "Realisasi " + rec.actual_id, 1);
      e[field] = ke;
    }
    var e = l.employee_id ? _kar(l.employee_id) : null;

    if (a.action_type === "PROMOTION" || a.action_type === "GRADE_ADJUSTMENT") {
      if (e && l.target_grade_id) ubahField(e, "grade_id", l.target_grade_id);
    } else if (a.action_type === "TRANSFER") {
      if (e && l.target_department_id) {
        var dTujuan = _dep(l.target_department_id) || {};
        ubahField(e, "department_id", l.target_department_id);
        ubahField(e, "division_id", dTujuan.division_id || null);
        ubahField(e, "cost_center_id", dTujuan.cost_center_id || null);
        // Atasan baru: HOD departemen tujuan, sampai berkas karyawan menetapkan yang tepat.
        var atasanBaru = l.target_manager_id ? _kar(l.target_manager_id) : null;
        var hodTujuan = atasanBaru || hodDari(l.target_department_id);
        if (hodTujuan) ubahField(e, "direct_report_id", hodTujuan.employee_id);
      }
    } else if (a.action_type === "INTERNAL_TRANSFER") {
      if (e && l.target_manager_id) ubahField(e, "direct_report_id", l.target_manager_id);
    } else if (a.action_type === "PLANNED_REDUCTION") {
      if (e) {
        ubahField(e, "employment_status", "Keluar"); ubahField(e, "exit_date", data.actual_date);
        // F7-2: kepergian yang bukan restrukturisasi menyisakan kursi kosong, jadi vacancy dibuka.
        if (["Restrukturisasi", "Pindah entitas"].indexOf(l.reduction_reason) === -1 && e.position_id) {
          var vacId = "VAC-R" + String(db.vacancies.length + 1).padStart(3, "0");
          var posLama = _pos(e.position_id);
          db.vacancies.push({ vacancy_id: vacId, position_id: e.position_id,
            position_title: posLama ? posLama.title : e.position_id, department_id: e.department_id,
            grade_id: e.grade_id, vacancy_date: data.actual_date, source: l.reduction_reason || "Keluar",
            existing_position: true, status: "Open", planned_action: null, dari_realisasi: rec.actual_id });
          jejak.push({ vacancy_baru: vacId });
        }
      }
    } else if (["EXTERNAL_HIRING", "VACANCY_ACTION", "POSITION_CREATION"].indexOf(a.action_type) !== -1) {
      // Rekrutmen terealisasi membuat karyawan baru. NIK sementara bila belum diisi,
      // ditandai supaya diganti lewat berkas karyawan begitu HRIS menerbitkan NIK.
      var pos = _pos(l.position_id || a.position_id);
      // F7-1: posisi baru belum ada di master, jadi dibuat dari judul dan grade usulannya.
      if (!pos && a.action_type === "POSITION_CREATION") {
        var kodePos = "POS-" + a.department_id.replace("D-", "") + "-N" +
          String(db.positions.filter(function (p) { return p.department_id === a.department_id; }).length + 1).padStart(3, "0");
        pos = { position_id: kodePos, code: kodePos, title: l.new_position_title || "Posisi baru",
                grade_id: l.target_grade_id || a.grade_id, department_id: a.department_id,
                is_unique: false, headcount_slot: rec.quantity, dari_realisasi: rec.actual_id };
        db.positions.push(pos);
        rec.posisi_baru = kodePos;
        // Baris usulannya ikut menunjuk posisi yang kini ada, supaya laporan tidak kosong.
        l.position_id = kodePos;
        catatRevisi("Position", kodePos, "dibuat", null, a.department_id, "Realisasi " + rec.actual_id, 1);
      }
      var d = _dep(a.department_id) || {};
      var hod = hodDari(a.department_id);
      var baru = [];
      for (var i = 0; i < rec.quantity; i++) {
        nomorSementara += 1;
        var nik = (data.employee_id && rec.quantity === 1) ? data.employee_id
                : "BARU-" + String(nomorSementara).padStart(4, "0");
        var orang = {
          employee_id: nik, name: data.employee_name || (l.new_position_title || (pos ? pos.title : a.action_type)),
          position_id: pos ? pos.position_id : null, grade_id: a.grade_id || (pos ? pos.grade_id : null),
          department_id: a.department_id, division_id: d.division_id || null,
          entity_id: entitasDepartemen(a.department_id), cost_center_id: d.cost_center_id || null,
          employment_status: "PKWT", join_date: data.actual_date,
          direct_report_id: hod ? hod.employee_id : null,
          sementara: !data.employee_id, dari_realisasi: rec.actual_id
        };
        db.employees.push(orang);
        baru.push(nik);
        catatRevisi("Employee", nik, "dibuat", null, a.department_id, "Realisasi " + rec.actual_id, 1);
      }
      rec.karyawan_baru = baru;
      // Vacancy yang diisi menutup dirinya.
      if (l.vacancy_id) {
        var v = db.vacancies.filter(function (x) { return x.vacancy_id === l.vacancy_id; })[0];
        if (v && v.status === "Open") { v.status = "Filled"; jejak.push({ vacancy_id: v.vacancy_id, dari: "Open", ke: "Filled" }); }
      }
    }
    rec.jejak_master = jejak;
  }

  function balikkanDariMaster(rec) {
    (rec.jejak_master || []).slice().reverse().forEach(function (j) {
      if (j.vacancy_baru) {
        var idx = db.vacancies.findIndex(function (v) { return v.vacancy_id === j.vacancy_baru; });
        if (idx !== -1) db.vacancies.splice(idx, 1);
        return;
      }
      if (j.vacancy_id) {
        var v = db.vacancies.filter(function (x) { return x.vacancy_id === j.vacancy_id; })[0];
        if (v) v.status = j.dari;
        return;
      }
      var e = _kar(j.employee_id);
      if (e) {
        catatRevisi("Employee", e.employee_id, j.field, e[j.field], j.dari, "Pembatalan " + rec.actual_id, 1);
        e[j.field] = j.dari;
      }
    });
    if (rec.posisi_baru) {
      var idxPos = db.positions.findIndex(function (p) { return p.position_id === rec.posisi_baru; });
      if (idxPos !== -1) db.positions.splice(idxPos, 1);
      var l0 = _baris((_alok(rec.allocation_id) || {}).line_item_id);
      if (l0 && l0.position_id === rec.posisi_baru) l0.position_id = null;
    }
    (rec.karyawan_baru || []).forEach(function (nik) {
      var idx = db.employees.findIndex(function (e) { return e.employee_id === nik && e.dari_realisasi === rec.actual_id; });
      if (idx !== -1) {
        catatRevisi("Employee", nik, "dihapus", db.employees[idx].department_id, null, "Pembatalan " + rec.actual_id, 1);
        db.employees.splice(idx, 1);
      }
    });
  }

  function catatActual(allocationId, data) {
    var a = _alok(allocationId);
    if (!a) return { ok: false, kunci: "mon.errAlokasi" };
    if (!NBRbac.can(sesi.user, "actual.record")) {
      NBAudit.tulis(sesi.user, "SCOPE_DENIED", "ActualAction", allocationId, { key: "audit.d.denyActual" });
      return { ok: false, kunci: "mon.errPeran" };
    }
    var c = _sik(a.cycle_id);
    if (!c || c.status === "CLOSED") return { ok: false, kunci: "plan.errTutup" };

    var qty = Math.floor(Number(data.quantity || 0));
    if (!qty || qty < 1) return { ok: false, kunci: "mon.errQty" };
    data.actual_date = NBImpor.tanggalDari(data.actual_date);
    if (!data.actual_date) return { ok: false, kunci: "mon.errTanggal" };
    // Tanggal masuk kerja wajib berada di dalam tahun siklus.
    if (String(data.actual_date).slice(0, 4) !== String(c.year)) {
      return { ok: false, kunci: "mon.errTahun", vars: { y: c.year } };
    }

    var sisa = a.approved_qty - a.consumed_qty;
    var melebihi = qty > sisa;
    // Penambahan headcount diblokir keras. Selebihnya dicatat tetapi menjadi exception.
    if (melebihi && AKSI_MENAMBAH.indexOf(a.action_type) !== -1) {
      NBAudit.tulis(sesi.user, "ACTUAL_BLOCKED", "Allocation", allocationId,
        { key: "audit.d.actualBlok", vars: { q: qty, s: Math.max(0, sisa) } });
      return { ok: false, kunci: "mon.errMelebihi", vars: { q: qty, s: Math.max(0, sisa) } };
    }

    var rec = {
      actual_id: "ACT-" + c.year + "-" + String(db.actuals.length + 1).padStart(4, "0"),
      cycle_id: a.cycle_id, allocation_id: allocationId, line_item_id: a.line_item_id,
      department_id: a.department_id, action_type: a.action_type,
      employee_name: data.employee_name || null, quantity: qty,
      actual_date: data.actual_date, effective_month: Number(String(data.actual_date).slice(5, 7)),
      note: data.note || null, source: "Pencatatan manual di aplikasi",
      status: "RECORDED", recorded_by: sesi.user.user_id, recorded_at: new Date().toISOString()
    };
    // Keputusan F5-1: master baru berubah setelah HC menyetujui, bukan saat dicatat.
    rec.employee_id = data.employee_id || null;
    rec.master_status = "MENUNGGU";
    db.actuals.push(rec);
    hitungUlangAlokasi(a);

    if (melebihi) {
      db.exceptions.push({
        exception_id: "EXC-" + c.year + "-" + String(db.exceptions.length + 1).padStart(4, "0"),
        cycle_id: a.cycle_id, allocation_id: allocationId, actual_id: rec.actual_id,
        department_id: a.department_id, jenis: "OVER_ALLOCATION",
        kelebihan: qty - Math.max(0, sisa), status: "PENDING",
        raised_at: new Date().toISOString(), raised_by: sesi.user.user_id,
        decided_by: null, decided_at: null, reason: null
      });
      NBAudit.tulis(sesi.user, "ACTUAL_EXCEPTION", "Allocation", allocationId,
        { key: "audit.d.exception", vars: { q: qty, s: Math.max(0, sisa) } });
    }

    simpan();
    NBAudit.tulis(sesi.user, "ACTUAL_RECORD", "ActualAction", rec.actual_id,
      { key: "audit.d.actual", vars: { q: qty, a: a.allocation_id,
        t: NBFormat.tanggal(data.actual_date) } });
    return { ok: true, actual: salin(rec), exception: melebihi };
  }

  // Persetujuan HC atas realisasi (F5-1). Setuju: perubahan ditulis ke master.
  // Tolak: realisasinya dibatalkan sekalian dan kuota kembali, dengan alasan wajib.
  function setujuiRealisasi(actualId, keputusan, alasan) {
    var r = db.actuals.filter(function (a) { return a.actual_id === actualId; })[0];
    if (!r) return { ok: false, kunci: "mon.errActual" };
    if (!NBRbac.can(sesi.user, "actual.approve") ||
        !NBRbac.inScope(sesi.user, db.departments, r.department_id)) {
      NBAudit.tulis(sesi.user, "SCOPE_DENIED", "ActualAction", actualId, { key: "audit.d.denyApproveActual" });
      return { ok: false, kunci: "mon.errPeranSetuju" };
    }
    if (r.status !== "RECORDED" || r.master_status !== "MENUNGGU") return { ok: false, kunci: "mon.errSudahDiputus" };
    var a = _alok(r.allocation_id);
    if (keputusan === "SETUJU") {
      terapkanKeMaster(r, a, { actual_date: r.actual_date, employee_name: r.employee_name, employee_id: r.employee_id });
      r.master_status = "DITERAPKAN";
    } else {
      if (!alasan || alasan.trim().length < 10) return { ok: false, kunci: "review.errAlasan" };
      r.master_status = "DITOLAK";
      r.status = "CANCELLED";
      r.cancel_reason = alasan;
      r.cancelled_by = sesi.user.user_id;
      r.cancelled_at = new Date().toISOString();
      if (a) hitungUlangAlokasi(a);
    }
    r.approved_by = sesi.user.user_id;
    r.approved_at = new Date().toISOString();
    r.approval_note = alasan || null;
    catatRevisi("ActualAction", actualId, "master_status", "MENUNGGU", r.master_status, alasan, 1);
    simpan();
    NBAudit.tulis(sesi.user, keputusan === "SETUJU" ? "ACTUAL_APPROVE" : "ACTUAL_REJECT", "ActualAction", actualId,
      { key: keputusan === "SETUJU" ? "audit.d.actualSetuju" : "audit.d.actualTolak", vars: { id: actualId }, reason: alasan || null });
    return { ok: true, actual: salin(r) };
  }

  function realisasiMenunggu(cycleId) {
    return actualTerlihat(cycleId).filter(function (a) { return a.status === "RECORDED" && a.master_status === "MENUNGGU"; });
  }

  // Pembatalan realisasi. Catatan tidak dihapus, hanya ditandai batal, supaya jejaknya utuh.
  function batalkanActual(actualId, alasan) {
    var r = db.actuals.filter(function (a) { return a.actual_id === actualId; })[0];
    if (!r) return { ok: false, kunci: "mon.errActual" };
    if (!NBRbac.can(sesi.user, "actual.record")) return { ok: false, kunci: "mon.errPeran" };
    if (!alasan || alasan.trim().length < 10) return { ok: false, kunci: "review.errAlasan" };
    if (r.status !== "RECORDED") return { ok: false, kunci: "mon.errSudahBatal" };

    r.status = "CANCELLED";
    r.cancel_reason = alasan;
    r.cancelled_by = sesi.user.user_id;
    r.cancelled_at = new Date().toISOString();
    var a = _alok(r.allocation_id);
    if (a) hitungUlangAlokasi(a);
    if (r.master_status === "DITERAPKAN") { balikkanDariMaster(r); r.master_status = "DIBALIK"; }
    catatRevisi("ActualAction", actualId, "status", "RECORDED", "CANCELLED", alasan, 1);
    simpan();
    NBAudit.tulis(sesi.user, "ACTUAL_CANCEL", "ActualAction", actualId,
      { key: "audit.d.actualBatal", vars: { q: r.quantity }, reason: alasan });
    return { ok: true };
  }

  function putuskanException(exceptionId, keputusan, alasan) {
    var e = db.exceptions.filter(function (x) { return x.exception_id === exceptionId; })[0];
    if (!e) return { ok: false, kunci: "mon.errException" };
    if (!NBRbac.can(sesi.user, "monitor.all") || !NBRbac.can(sesi.user, "consolidate")) {
      NBAudit.tulis(sesi.user, "SCOPE_DENIED", "Exception", exceptionId, { key: "audit.d.denyException" });
      return { ok: false, kunci: "mon.errPeranException" };
    }
    if (e.status !== "PENDING") return { ok: false, kunci: "mon.errSudahDiputus" };
    if (!alasan || alasan.trim().length < 10) return { ok: false, kunci: "review.errAlasan" };

    e.status = keputusan === "ACCEPT" ? "ACCEPTED" : "REJECTED";
    e.reason = alasan;
    e.decided_by = sesi.user.user_id;
    e.decided_at = new Date().toISOString();
    // Penolakan membatalkan realisasi yang memicunya, supaya angka kembali cocok.
    if (keputusan === "REJECT") {
      var r = db.actuals.filter(function (a) { return a.actual_id === e.actual_id; })[0];
      if (r && r.status === "RECORDED") {
        r.status = "CANCELLED";
        r.cancel_reason = alasan;
        r.cancelled_by = sesi.user.user_id;
        r.cancelled_at = new Date().toISOString();
        var a = _alok(r.allocation_id);
        if (a) hitungUlangAlokasi(a);
        if (r.master_status === "DITERAPKAN") { balikkanDariMaster(r); r.master_status = "DIBALIK"; }
      }
    }
    catatRevisi("Exception", exceptionId, "status", "PENDING", e.status, alasan, 1);
    simpan();
    NBAudit.tulis(sesi.user, "EXCEPTION_DECISION", "Exception", exceptionId,
      { key: keputusan === "ACCEPT" ? "audit.d.excAccept" : "audit.d.excReject",
        vars: { id: exceptionId }, reason: alasan });
    return { ok: true };
  }

  // Ringkasan monitoring: alokasi versus realisasi, utilisasi, dan sebaran bulan.
  function ringkasMonitoring(cycleId) {
    var alokasi = alokasiTerlihat(cycleId);
    var actual = actualTerlihat(cycleId).filter(function (a) { return a.status === "RECORDED"; });
    var deps = departemenTerlihat();

    var perDept = deps.map(function (d) {
      var al = alokasi.filter(function (a) { return a.department_id === d.department_id; });
      var ac = actual.filter(function (a) { return a.department_id === d.department_id; });
      var kuota = al.reduce(function (n, a) { return n + a.approved_qty; }, 0);
      var pakai = ac.reduce(function (n, a) { return n + a.quantity; }, 0);
      var biayaAlok = al.reduce(function (n, a) { return n + a.annualized_cost; }, 0);
      // Biaya realisasi memakai biaya bulanan alokasi dan bulan masuk kerja sebenarnya.
      var biayaAct = ac.reduce(function (n, a) {
        var al1 = alokasi.filter(function (x) { return x.allocation_id === a.allocation_id; })[0];
        if (!al1 || !al1.approved_qty) return n;
        var perOrang = al1.monthly_cost / al1.approved_qty;
        return n + perOrang * a.quantity * NBFormat.bulanBerlaku(a.effective_month);
      }, 0);
      var hcPakai = ac.reduce(function (n, a) {
        var al1 = alokasi.filter(function (x) { return x.allocation_id === a.allocation_id; })[0];
        if (!al1 || !al1.approved_qty) return n;
        return n + (al1.hc_impact / al1.approved_qty) * a.quantity;
      }, 0);
      return {
        department_id: d.department_id, name: d.name, cost_center_id: d.cost_center_id,
        kuota: kuota, terpakai: pakai, sisa: Math.max(0, kuota - pakai),
        hcAlokasi: al.reduce(function (n, x) { return n + x.hc_impact; }, 0),
        hcRealisasi: Math.round(hcPakai),
        utilisasi: kuota ? Math.round(pakai / kuota * 100) : 0,
        biayaAlokasi: biayaAlok, biayaActual: Math.round(biayaAct),
        alokasi: al.length
      };
    }).filter(function (d) { return d.alokasi > 0; });

    var perBulan = [];
    for (var m = 1; m <= 12; m++) perBulan.push({ bulan: m, rencana: 0, realisasi: 0 });
    alokasi.forEach(function (a) {
      if (a.effective_month >= 1 && a.effective_month <= 12 && a.hc_impact > 0) {
        perBulan[a.effective_month - 1].rencana += a.approved_qty;
      }
    });
    actual.forEach(function (a) {
      if (a.effective_month >= 1 && a.effective_month <= 12) {
        perBulan[a.effective_month - 1].realisasi += a.quantity;
      }
    });

    var total = perDept.reduce(function (t, d) {
      t.kuota += d.kuota; t.terpakai += d.terpakai; t.sisa += d.sisa;
      t.hcAlokasi += d.hcAlokasi; t.hcRealisasi += d.hcRealisasi;
      t.biayaAlokasi += d.biayaAlokasi; t.biayaActual += d.biayaActual;
      return t;
    }, { kuota: 0, terpakai: 0, sisa: 0, hcAlokasi: 0, hcRealisasi: 0,
         biayaAlokasi: 0, biayaActual: 0 });
    total.utilisasi = total.kuota ? Math.round(total.terpakai / total.kuota * 100) : 0;

    return {
      perDept: perDept, perBulan: perBulan, total: total,
      alokasi: alokasi, actual: actual,
      exceptions: exceptionTerlihat(cycleId),
      menunggu: exceptionTerlihat(cycleId).filter(function (e) { return e.status === "PENDING"; }).length
    };
  }

  // --- Laporan, notifikasi, dan penutupan siklus (bab 30, 31, 65) -----------

  // Semua laporan memakai fungsi yang sama dengan yang dipakai layar, jadi angka di
  // laporan tidak mungkin berbeda dari angka di aplikasi.
  function dataLaporan(kode, cycleId) {
    var c = _sik(cycleId);
    if (!c) return { kolom: [], baris: [] };

    if (kode === "R1") {
      var snap = snapshotAktif(cycleId);
      var lines = snap ? snapshotBarisTerlihat(snap.snapshot_id) : [];
      return {
        kolom: [{ kunci: "employee_id", label: "NIK" }, { kunci: "employee_name", label: "Nama" },
                { kunci: "position_title", label: "Posisi" }, { kunci: "grade_id", label: "Grade" },
                { kunci: "departemen", label: "Departemen" }, { kunci: "cost_center_id", label: "Cost Center" }],
        baris: lines.map(function (l) {
          l.departemen = (_dep(l.department_id) || {}).name; return l;
        })
      };
    }

    if (kode === "R2") {
      var baris = barisSiklusTerlihat(cycleId);
      return {
        kolom: [{ kunci: "line_item_id", label: "ID" }, { kunci: "departemen", label: "Departemen" },
                { kunci: "action_type", label: "Action" }, { kunci: "sasaran", label: "Sasaran" },
                { kunci: "quantity", label: "Kuantitas" }, { kunci: "effective_month", label: "Bulan efektif" },
                { kunci: "hc", label: "Dampak HC" }, { kunci: "status", label: "Status" }],
        baris: baris.map(function (l) {
          return Object.assign({}, l, {
            departemen: (_dep(l.department_id) || {}).name,
            sasaran: namaSasaranBaris(l),
            hc: NBActions.dampakHc(l).perusahaan
          });
        })
      };
    }

    if (kode === "R3") {
      var r = ringkasAlokasi(cycleId);
      return {
        kolom: [{ kunci: "name", label: "Departemen" }, { kunci: "cost_center_id", label: "Cost Center" },
                { kunci: "requested", label: "Requested" }, { kunci: "approved", label: "Approved" },
                { kunci: "variance", label: "Variance" }],
        baris: r.perDept
      };
    }

    if (kode === "R4") {
      var h = biayaSiklus(cycleId);
      return {
        kolom: [{ kunci: "name", label: "Departemen" }, { kunci: "cost_center_id", label: "Cost Center" },
                { kunci: "baris", label: "Baris" }, { kunci: "monthly", label: "Biaya bulanan" },
                { kunci: "annualized", label: "Biaya tahunan" }],
        baris: h ? h.perDept : []
      };
    }

    if (kode === "R5") {
      var h5 = biayaSiklus(cycleId);
      return {
        kolom: [{ kunci: "bulan", label: "Bulan" }, { kunci: "nama", label: "Nama bulan" },
                { kunci: "biaya", label: "Beban bulanan" }],
        baris: h5 ? h5.perBulan.map(function (b) {
          return { bulan: b.bulan, nama: NBFormat.bulanNama(b.bulan), biaya: Math.round(b.biaya) };
        }) : []
      };
    }

    if (kode === "R6") {
      return {
        kolom: [{ kunci: "allocation_id", label: "Alokasi" }, { kunci: "departemen", label: "Departemen" },
                { kunci: "action_type", label: "Action" }, { kunci: "sasaran", label: "Sasaran" },
                { kunci: "approved_qty", label: "Kuota" }, { kunci: "consumed_qty", label: "Terpakai" },
                { kunci: "remaining_qty", label: "Sisa" }, { kunci: "status", label: "Status" }],
        baris: alokasiTerlihat(cycleId).map(function (a) {
          return Object.assign({}, a, {
            departemen: (_dep(a.department_id) || {}).name, sasaran: namaSasaranBaris(a)
          });
        })
      };
    }

    if (kode === "R7") {
      var m = ringkasMonitoring(cycleId);
      return {
        kolom: [{ kunci: "name", label: "Departemen" }, { kunci: "kuota", label: "Kuota" },
                { kunci: "terpakai", label: "Realisasi" }, { kunci: "sisa", label: "Sisa" },
                { kunci: "utilisasi", label: "Utilisasi persen" },
                { kunci: "hcRealisasi", label: "Realisasi HC" }],
        baris: m.perDept
      };
    }

    if (kode === "R8") {
      return {
        kolom: [{ kunci: "exception_id", label: "Exception" }, { kunci: "departemen", label: "Departemen" },
                { kunci: "allocation_id", label: "Alokasi" }, { kunci: "kelebihan", label: "Kelebihan" },
                { kunci: "status", label: "Status" }, { kunci: "reason", label: "Alasan" }],
        baris: exceptionTerlihat(cycleId).map(function (e) {
          return Object.assign({}, e, { departemen: (_dep(e.department_id) || {}).name });
        })
      };
    }

    if (kode === "R10") {
      var mx = matriksBulanan(cycleId, { mode: "HC", level: "POSISI" });
      var kolomMx = [
        { kunci: "entitas", label: "Legal Entity" }, { kunci: "negara", label: "Negara" },
        { kunci: "divisi", label: "Divisi" }, { kunci: "departemen", label: "Departemen" },
        { kunci: "jabatan", label: "Jabatan" }, { kunci: "cost_center_id", label: "Cost Center" },
        { kunci: "ukuran", label: "Ukuran" }
      ];
      for (var bl = 1; bl <= 12; bl++) {
        kolomMx.push({ kunci: "b" + bl, label: NBFormat.bulanPendek(bl) });
      }
      kolomMx.push({ kunci: "total", label: "Posisi Desember" });

      var barisMx = [];
      mx.baris.forEach(function (b) {
        [["Budget", "budget"], ["Actual", "actual"], ["Selisih", "selisih"]].forEach(function (pita) {
          var o3 = { entitas: b.entitas, negara: b.negara, divisi: b.divisi,
                     departemen: b.departemen, jabatan: b.jabatan || "-",
                     cost_center_id: b.cost_center_id, ukuran: pita[0] };
          for (var m2 = 0; m2 < 12; m2++) o3["b" + (m2 + 1)] = b[pita[1]][m2];
          o3.total = b[pita[1]][11];
          barisMx.push(o3);
        });
      });
      return { kolom: kolomMx, baris: barisMx };
    }

    if (kode === "R9") {
      return {
        kolom: [{ kunci: "timestamp", label: "Waktu" }, { kunci: "actor_email", label: "Aktor" },
                { kunci: "actor_role", label: "Peran" }, { kunci: "event_type", label: "Event" },
                { kunci: "objek", label: "Objek" }, { kunci: "rincian", label: "Rincian" },
                { kunci: "before", label: "Nilai lama" }, { kunci: "after", label: "Nilai baru" }],
        baris: NBAudit.untuk(sesi.user, departemenDariAudit).map(function (e) {
          return Object.assign({}, e, {
            objek: e.object_type + " " + e.object_id,
            rincian: e.detail_key ? NBi18n.t(e.detail_key, e.detail_vars || {}) : e.detail
          });
        })
      };
    }

    return { kolom: [], baris: [] };
  }

  function namaSasaranBaris(l) {
    if (l.employee_id) return (_kar(l.employee_id) || {}).name || l.employee_id;
    if (l.new_position_title) return l.new_position_title;
    if (l.position_id) return (_pos(l.position_id) || {}).title || l.position_id;
    if (l.vacancy_id) return l.vacancy_id;
    return "-";
  }

  // Daftar pekerjaan yang menunggu pengguna ini. Menggantikan notifikasi surel yang
  // belum ada di prototipe, dan sengaja dihitung dari keadaan data, bukan disimpan.
  function notifikasi(cycleId) {
    var u = sesi.user;
    if (!u) return [];
    var out = [];
    var c = _sik(cycleId);
    if (!c) return out;

    if (NBRbac.can(u, "plan.create")) {
      departemenTerlihat().forEach(function (d) {
        var sub = db.submissions.filter(function (s) {
          return s.cycle_id === cycleId && s.department_id === d.department_id;
        })[0];
        if (c.status === "OPEN" && (!sub || sub.status === "DRAFT")) {
          out.push({ jenis: "PLAN", kunci: "notif.usulanDraft", vars: { d: d.name }, rute: "planning" });
        }
        if (sub && sub.status === "RETURNED") {
          out.push({ jenis: "RETURN", kunci: "notif.dikembalikan", vars: { d: d.name }, rute: "planning" });
        }
      });
      mutasiMasuk(cycleId).filter(function (b) { return b.transfer_status === "PENDING"; })
        .forEach(function (b) {
          out.push({ jenis: "TRANSFER", kunci: "notif.mutasi",
                     vars: { d: (_dep(b.department_id) || {}).name }, rute: "planning" });
        });
    }

    if (NBRbac.can(u, "plan.review")) {
      var menunggu = db.submissions.filter(function (s) {
        return s.cycle_id === cycleId && s.status === "SUBMITTED";
      }).length;
      if (menunggu) out.push({ jenis: "REVIEW", kunci: "notif.reviewOd", vars: { n: menunggu }, rute: "usulan" });
      var siap = db.submissions.filter(function (s) {
        return s.cycle_id === cycleId && s.status === "OD_ACCEPTED";
      }).length;
      if (siap) out.push({ jenis: "KONSOLIDASI", kunci: "notif.konsolidasi", vars: { n: siap }, rute: "konsolidasi" });
    }

    if (NBRbac.can(u, "review.decide")) {
      var belum = barisReview(cycleId).filter(function (l) { return !l.decision; }).length;
      if (belum) out.push({ jenis: "KEPUTUSAN", kunci: "notif.keputusan", vars: { n: belum }, rute: "review" });
    }

    if (NBRbac.can(u, "approved.distribute")) {
      var apr = approvalSiklus(cycleId);
      if (apr.length && !alokasiSiklus(cycleId).length) {
        out.push({ jenis: "DISTRIBUSI", kunci: "notif.distribusi", vars: {}, rute: "approved" });
      }
      var exc = db.exceptions.filter(function (e) {
        return e.cycle_id === cycleId && e.status === "PENDING";
      }).length;
      if (exc) out.push({ jenis: "EXCEPTION", kunci: "notif.exception", vars: { n: exc }, rute: "monitoring" });
    }

    if (NBRbac.can(u, "actual.approve")) {
      var tunggu = realisasiMenunggu(cycleId).length;
      if (tunggu) out.push({ jenis: "PERSETUJUAN", kunci: "notif.realisasiHc", vars: { n: tunggu }, rute: "monitoring" });
    }

    if (NBRbac.can(u, "actual.record")) {
      var sisa = alokasiTerlihat(cycleId).filter(function (a) { return a.remaining_qty > 0; }).length;
      if (sisa) out.push({ jenis: "REALISASI", kunci: "notif.realisasi", vars: { n: sisa }, rute: "monitoring" });
    }

    return out;
  }

  // Pemeriksaan sebelum siklus ditutup (bab 65). Menutup siklus dengan exception yang
  // masih menggantung akan meninggalkan angka yang tidak pernah bisa direkonsiliasi.
  function periksaPenutupan(cycleId) {
    var masalah = [];
    var exc = db.exceptions.filter(function (e) {
      return e.cycle_id === cycleId && e.status === "PENDING";
    }).length;
    if (exc) masalah.push({ kunci: "tutup.exception", vars: { n: exc }, blokir: true });

    var belumReview = db.submissions.filter(function (s) {
      return s.cycle_id === cycleId && s.status === "SUBMITTED";
    }).length;
    if (belumReview) masalah.push({ kunci: "tutup.review", vars: { n: belumReview }, blokir: true });

    var mut = db.line_items.filter(function (l) {
      var sub = _sub(l.submission_id);
      return sub && sub.cycle_id === cycleId && l.action_type === "TRANSFER" &&
             l.transfer_status === "PENDING";
    }).length;
    if (mut) masalah.push({ kunci: "tutup.mutasi", vars: { n: mut }, blokir: true });

    var menungguHc = db.actuals.filter(function (a) {
      return a.cycle_id === cycleId && a.status === "RECORDED" && a.master_status === "MENUNGGU";
    }).length;
    if (menungguHc) masalah.push({ kunci: "tutup.realisasiHc", vars: { n: menungguHc }, blokir: true });

    var sisa = alokasiSiklus(cycleId).filter(function (a) { return a.remaining_qty > 0; });
    if (sisa.length) {
      masalah.push({ kunci: "tutup.sisa",
                     vars: { n: sisa.reduce(function (t, a) { return t + a.remaining_qty; }, 0) },
                     blokir: false });
    }
    return { masalah: masalah, bolehTutup: !masalah.some(function (m) { return m.blokir; }) };
  }

  // --- Impor dan ekspor data (micro-app) ------------------------------------
  // Impor memakai jalur tulis yang sama dengan layar, jadi tidak ada aturan yang bisa
  // dilewati dengan cara mengunggah berkas. Baris yang gagal dikembalikan dengan alasannya.

  function bolehImpor(kode) {
    var b = NBImpor.def(kode);
    if (!b) return { ok: false, kunci: "imp.errBerkas" };
    if (b.cap === "cost.assumption" && !NBRbac.can(sesi.user, "cost.assumption")) {
      return { ok: false, kunci: "imp.errPeran" };
    }
    if (b.cap !== "cost.assumption" && !NBRbac.can(sesi.user, b.cap)) {
      return { ok: false, kunci: "imp.errPeran" };
    }
    // Akun bawaan hanya boleh menyiapkan struktur dan pengguna, bukan data siklus (K7).
    if (sesi.user.role === "ADMIN" && ["ORGANISASI", "POSISI", "KARYAWAN", "VACANCY", "PENGGUNA"].indexOf(kode) === -1) {
      return { ok: false, kunci: "imp.errPeran" };
    }
    return { ok: true };
  }

  function angkaDari(v) {
    if (v === null || v === undefined || v === "") return 0;
    return Number(String(v).replace(/[^0-9,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  }

  function benarDari(v) {
    return ["1", "true", "ya", "y", "yes"].indexOf(String(v || "").toLowerCase()) !== -1;
  }

  // Periksa satu baris impor tanpa menuliskannya. Dipakai untuk pratinjau.
  function periksaImpor(kode, r, cycleId) {
    if (kode === "ORGANISASI") {
      ["entity_id", "division_id", "department_id", "cost_center_id"].forEach(function () {});
      if (!r.entity_id || !r.entity_name) return { ok: false, kunci: "imp.vEntitas" };
      if (!r.country || String(r.country).trim().length < 2) return { ok: false, kunci: "imp.vNegara" };
      if (!r.directorate_id || !r.directorate_name) return { ok: false, kunci: "imp.vDirektorat" };
      if (!r.division_id || !r.division_name) return { ok: false, kunci: "imp.vDivisi" };
      if (!r.department_id || !r.department_name) return { ok: false, kunci: "imp.vDeptBaru" };
      if (!r.cost_center_id) return { ok: false, kunci: "imp.vCostCenter" };
      // Departemen tidak boleh berpindah divisi diam-diam, karena seluruh konsolidasi
      // dan laporan mengelompokkan lewat jalur entitas, divisi, departemen.
      var adaDept = _dep(r.department_id);
      if (adaDept && adaDept.division_id !== r.division_id) {
        return { ok: false, kunci: "imp.vPindahDivisi",
                 vars: { d: r.department_id, a: adaDept.division_id, b: r.division_id } };
      }
      var adaDiv = db.divisions.filter(function (x) { return x.division_id === r.division_id; })[0];
      if (adaDiv && adaDiv.entity_id !== r.entity_id) {
        return { ok: false, kunci: "imp.vPindahEntitas",
                 vars: { d: r.division_id, a: adaDiv.entity_id, b: r.entity_id } };
      }
      return { ok: true, aksi: adaDept ? "PERBARUI" : "TAMBAH" };
    }

    if (kode === "KURS") {
      if (!r.currency || String(r.currency).length !== 3) return { ok: false, kunci: "imp.vMataUang" };
      if (String(r.currency).toUpperCase() === "IDR") return { ok: false, kunci: "imp.vKursIdr" };
      if (angkaDari(r.rate_to_idr) <= 0) return { ok: false, kunci: "imp.vKursNol" };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(NBImpor.tanggalDari(r.effective_date) || ""))) return { ok: false, kunci: "imp.vKursTanggal" };
      return { ok: true, aksi: "TAMBAH" };
    }

    if (kode === "POSISI") {
      if (!r.position_id || !r.title) return { ok: false, kunci: "imp.vPosisiBaru" };
      if (!_dep(r.department_id)) return { ok: false, kunci: "imp.vDept", vars: { v: r.department_id } };
      if (!db.grades.some(function (g) { return g.grade_id === r.grade_id; })) {
        return { ok: false, kunci: "imp.vGrade", vars: { v: r.grade_id } };
      }
      return { ok: true, aksi: _pos(r.position_id) ? "PERBARUI" : "TAMBAH" };
    }

    if (kode === "VACANCY") {
      if (!r.vacancy_id) return { ok: false, kunci: "imp.vVacancy" };
      if (!_dep(r.department_id)) return { ok: false, kunci: "imp.vDept", vars: { v: r.department_id } };
      if (!_pos(r.position_id)) return { ok: false, kunci: "imp.vPosisi", vars: { v: r.position_id } };
      var adaVac = db.vacancies.some(function (v) { return v.vacancy_id === r.vacancy_id; });
      return { ok: true, aksi: adaVac ? "PERBARUI" : "TAMBAH" };
    }

    if (kode === "PENGGUNA") {
      if (!r.user_id || !r.name || !r.email) return { ok: false, kunci: "imp.vPengguna" };
      var peranSah = ["OD", "CB", "MANAGEMENT", "MONITOR", "HOD", "HCBP"];
      if (peranSah.indexOf(String(r.role).toUpperCase()) === -1) {
        return { ok: false, kunci: "imp.vPeran", vars: { v: r.role } };
      }
      if (r.user_id === "U-ADMIN") return { ok: false, kunci: "imp.vAdmin" };
      if (r.employee_id && !_kar(r.employee_id)) {
        return { ok: false, kunci: "imp.vKaryawan", vars: { v: r.employee_id } };
      }
      // HOD dan manajer diturunkan dari pohon. Baris HOD wajib menaut ke karyawan.
      if (String(r.role).toUpperCase() === "HOD" && !r.employee_id) {
        return { ok: false, kunci: "imp.vHodTanpaKaryawan" };
      }
      // Lingkup entitas wajib menyebut entitas yang ada.
      if (String(r.scope_type).toUpperCase() === "ENTITY") {
        var ents = String(r.scope_ids || "").split("|").map(function (x) { return x.trim(); }).filter(Boolean);
        if (!ents.length) return { ok: false, kunci: "imp.vEntitasLingkup" };
        var asing = ents.filter(function (id) { return !db.entities.some(function (e) { return e.entity_id === id; }); });
        if (asing.length) return { ok: false, kunci: "imp.vEntitasAsing", vars: { v: asing.join(", ") } };
      }
      var adaUser = db.users.some(function (u) { return u.user_id === r.user_id; });
      return { ok: true, aksi: adaUser ? "PERBARUI" : "TAMBAH" };
    }

    if (kode === "KARYAWAN") {
      if (!r.employee_id) return { ok: false, kunci: "imp.vNik" };
      if (!r.name) return { ok: false, kunci: "imp.vNama" };
      if (!_dep(r.department_id)) return { ok: false, kunci: "imp.vDept", vars: { v: r.department_id } };
      if (!db.grades.some(function (g) { return g.grade_id === r.grade_id; })) {
        return { ok: false, kunci: "imp.vGrade", vars: { v: r.grade_id } };
      }
      if (!_pos(r.position_id)) return { ok: false, kunci: "imp.vPosisi", vars: { v: r.position_id } };
      if (r.direct_report_id && r.direct_report_id === r.employee_id) {
        return { ok: false, kunci: "imp.vAtasanDiri" };
      }
      // Keberadaan atasan dan lingkaran pelaporan diperiksa di tingkat berkas oleh
      // pratinjauImpor, karena atasannya boleh berada di berkas yang sama.
      var peringatan = [];
      var pos = _pos(r.position_id);
      if (r.position_title && pos && pos.title !== r.position_title) peringatan.push("imp.wJudulPosisi");
      return { ok: true, aksi: _kar(r.employee_id) ? "PERBARUI" : "TAMBAH", peringatan: peringatan };
    }

    if (kode === "ASUMSI") {
      if (!db.grades.some(function (g) { return g.grade_id === r.grade_id; })) {
        return { ok: false, kunci: "imp.vGrade", vars: { v: r.grade_id } };
      }
      if (r.entity_id && !db.entities.some(function (e) { return e.entity_id === r.entity_id; })) {
        return { ok: false, kunci: "imp.vEntitasAsing", vars: { v: r.entity_id } };
      }
      if (angkaDari(r.fixed_income) <= 0) return { ok: false, kunci: "imp.vFixed" };
      if (angkaDari(r.variable_income) < 0 || angkaDari(r.company_coverage) < 0 ||
          angkaDari(r.accrual_thr) < 0 || angkaDari(r.accrual_bonus) < 0) {
        return { ok: false, kunci: "imp.vNegatif" };
      }
      return { ok: true, aksi: "VERSI BARU" };
    }

    if (kode === "USULAN") {
      var jaga = bolehRencana(cycleId, r.department_id);
      if (!jaga.ok) return { ok: false, kunci: jaga.kunci || "plan.errTutup", vars: jaga.vars };
      if (!NBActions.def(r.action_type)) return { ok: false, kunci: "imp.vAction", vars: { v: r.action_type } };
      var calon = {
        line_item_id: "SEMENTARA", submission_id: (submissionDepartemen(cycleId, r.department_id) || {}).submission_id || "",
        department_id: r.department_id, action_type: r.action_type,
        employee_id: r.employee_id || null, position_id: r.position_id || null,
        vacancy_id: r.vacancy_id || null, new_position_title: r.new_position_title || null,
        target_grade_id: r.target_grade_id || null, target_department_id: r.target_department_id || null,
        target_manager_id: r.target_manager_id || null,
        vacancy_subtype: r.vacancy_subtype || null, reduction_reason: r.reduction_reason || null,
        replacement_flag: r.replacement_flag || null,
        quantity: angkaDari(r.quantity) || 1, effective_month: angkaDari(r.effective_month),
        fill_immediately: benarDari(r.fill_immediately), justification: r.justification || ""
      };
      var kar = calon.employee_id ? _kar(calon.employee_id) : null;
      if (calon.employee_id && !kar) return { ok: false, kunci: "imp.vKaryawan", vars: { v: calon.employee_id } };
      var h = NBValidate.periksa(calon, {
        semuaBaris: calon.submission_id ? db.line_items.filter(function (l) {
          return l.submission_id === calon.submission_id;
        }) : [],
        gradeAsal: kar ? kar.grade_id : null,
        currentHc: null,
        levelGrade: function (id) {
          var g = db.grades.filter(function (x) { return x.grade_id === id; })[0];
          return g ? g.level : 0;
        }
      });
      if (h.errors.length) {
        return { ok: false, kunci: h.errors[0].kunci, vars: h.errors[0].vars, kode: h.errors[0].kode };
      }
      return { ok: true, aksi: "TAMBAH", data: calon };
    }

    if (kode === "REALISASI") {
      var a = _alok(r.allocation_id);
      if (!a) return { ok: false, kunci: "mon.errAlokasi" };
      if (!NBRbac.inScope(sesi.user, db.departments, a.department_id)) {
        return { ok: false, kunci: "plan.errLingkup" };
      }
      var q = angkaDari(r.quantity);
      if (!q || q < 1) return { ok: false, kunci: "mon.errQty" };
      if (!r.actual_date) return { ok: false, kunci: "mon.errTanggal" };
      var c = _sik(a.cycle_id);
      if (String(r.actual_date).slice(0, 4) !== String(c.year)) {
        return { ok: false, kunci: "mon.errTahun", vars: { y: c.year } };
      }
      var sisa = a.approved_qty - a.consumed_qty;
      if (q > sisa && ["EXTERNAL_HIRING", "VACANCY_ACTION", "POSITION_CREATION"].indexOf(a.action_type) !== -1) {
        return { ok: false, kunci: "mon.errMelebihi", vars: { q: q, s: Math.max(0, sisa) } };
      }
      return { ok: true, aksi: q > sisa ? "EXCEPTION" : "TAMBAH" };
    }

    return { ok: false, kunci: "imp.errBerkas" };
  }

  function pratinjauImpor(kode, baris, cycleId) {
    var izin = bolehImpor(kode);
    if (!izin.ok) return { ok: false, kunci: izin.kunci };
    var ganda = NBImpor.barisGanda(kode, baris);
    var hasil = baris.map(function (r) {
      if (ganda[r._baris]) {
        return { baris: r, ok: false, aksi: null, data: null, kunci: "imp.vGanda",
                 vars: { v: ganda[r._baris] }, kodeGalat: null, peringatan: [] };
      }
      var h = periksaImpor(kode, r, cycleId);
      return { baris: r, ok: h.ok, aksi: h.aksi || null, data: h.data || null,
               kunci: h.kunci || null, vars: h.vars || {}, kodeGalat: h.kode || null,
               peringatan: h.peringatan || [] };
    });

    // Pemeriksaan tingkat berkas untuk karyawan: atasan harus ada di data atau di berkas,
    // dan tidak boleh membentuk lingkaran (K8). Dilakukan atas gabungan data lama dan baru.
    if (kode === "KARYAWAN") {
      var gabungan = {};
      db.employees.forEach(function (e) { gabungan[e.employee_id] = { employee_id: e.employee_id,
        direct_report_id: e.direct_report_id || "" }; });
      hasil.forEach(function (h) {
        if (h.ok) gabungan[h.baris.employee_id] = { employee_id: h.baris.employee_id,
          direct_report_id: h.baris.direct_report_id || "" };
      });
      var daftar = Object.keys(gabungan).map(function (k) { return gabungan[k]; });
      var hilang = {};
      NBOrganisasi.atasanHilang(daftar).forEach(function (x) { hilang[x.employee_id] = x.direct_report_id; });
      var melingkar = {};
      NBOrganisasi.deteksiSiklus(daftar).forEach(function (ring) {
        ring.forEach(function (id) { melingkar[id] = ring.join(" > "); });
      });
      hasil.forEach(function (h) {
        if (!h.ok) return;
        var id = h.baris.employee_id;
        if (hilang[id]) { h.ok = false; h.kunci = "imp.vAtasanHilang"; h.vars = { v: hilang[id] }; }
        else if (melingkar[id]) { h.ok = false; h.kunci = "imp.vMelingkar"; h.vars = { v: melingkar[id] }; }
      });
    }
    return {
      ok: true, hasil: hasil,
      valid: hasil.filter(function (h) { return h.ok; }).length,
      galat: hasil.filter(function (h) { return !h.ok; }).length
    };
  }

  // Terapkan hanya baris yang lolos. Baris bergalat dikembalikan supaya bisa diperbaiki.
  function terapkanImpor(kode, baris, cycleId) {
    var pra = pratinjauImpor(kode, baris, cycleId);
    if (!pra.ok) return pra;
    var lolos = pra.hasil.filter(function (h) { return h.ok; });
    var masuk = 0;

    if (kode === "ORGANISASI") {
      lolos.forEach(function (h) {
        var r = h.baris;
        var ent = db.entities.filter(function (x) { return x.entity_id === r.entity_id; })[0];
        if (ent) { ent.name = r.entity_name; ent.country = r.country; if (r.currency) ent.currency = r.currency; }
        else db.entities.push({ entity_id: r.entity_id, name: r.entity_name,
                                country: r.country, currency: r.currency || "IDR" });

        var dir = db.directorates.filter(function (x) { return x.directorate_id === r.directorate_id; })[0];
        if (dir) dir.name = r.directorate_name;
        else db.directorates.push({ directorate_id: r.directorate_id, entity_id: r.entity_id,
                                    name: r.directorate_name });

        var div = db.divisions.filter(function (x) { return x.division_id === r.division_id; })[0];
        if (div) { div.name = r.division_name; div.directorate_id = r.directorate_id; }
        else db.divisions.push({ division_id: r.division_id, entity_id: r.entity_id,
                                 directorate_id: r.directorate_id, name: r.division_name });

        var cc = db.cost_centers.filter(function (x) { return x.cost_center_id === r.cost_center_id; })[0];
        if (cc) cc.name = r.cost_center_name || cc.name;
        else db.cost_centers.push({ cost_center_id: r.cost_center_id,
                                    name: r.cost_center_name || r.department_name,
                                    owner_department_id: r.department_id });

        var dep = _dep(r.department_id);
        if (dep) {
          dep.name = r.department_name;
          dep.cost_center_id = r.cost_center_id;
          dep.entity_id = r.entity_id;
          dep.directorate_id = r.directorate_id;
        } else {
          db.departments.push({ department_id: r.department_id, division_id: r.division_id,
                                directorate_id: r.directorate_id, entity_id: r.entity_id,
                                name: r.department_name, cost_center_id: r.cost_center_id,
                                hod_user_id: null, note: "" });
        }
        masuk += 1;
      });
    }

    if (kode === "KURS") {
      lolos.forEach(function (h) {
        var r = h.baris;
        // Kurs tidak pernah ditimpa; tanggal berlaku baru menjadi baris baru.
        db.fx_rates.push({ currency: String(r.currency).toUpperCase(), rate_to_idr: angkaDari(r.rate_to_idr),
                           effective_date: r.effective_date, source: r.source || null,
                           created_by: sesi.user.user_id });
        masuk += 1;
      });
    }

    if (kode === "POSISI") {
      lolos.forEach(function (h) {
        var r = h.baris, p0 = _pos(r.position_id);
        var isi = { position_id: r.position_id, code: r.code || r.position_id, title: r.title,
                    grade_id: r.grade_id, department_id: r.department_id,
                    is_unique: benarDari(r.is_unique), headcount_slot: angkaDari(r.headcount_slot) || 1 };
        if (p0) Object.assign(p0, isi); else db.positions.push(isi);
        masuk += 1;
      });
    }

    if (kode === "VACANCY") {
      lolos.forEach(function (h) {
        var r = h.baris, v0 = db.vacancies.filter(function (v) { return v.vacancy_id === r.vacancy_id; })[0];
        var pos = _pos(r.position_id);
        var isi = { vacancy_id: r.vacancy_id, position_id: r.position_id, position_title: pos ? pos.title : "",
                    department_id: r.department_id, grade_id: r.grade_id || (pos ? pos.grade_id : null),
                    vacancy_date: r.vacancy_date || null, source: r.source || null,
                    existing_position: true, status: r.status || "Open", planned_action: null };
        if (v0) Object.assign(v0, isi); else db.vacancies.push(isi);
        masuk += 1;
      });
    }

    if (kode === "PENGGUNA") {
      lolos.forEach(function (h) {
        var r = h.baris, u0 = db.users.filter(function (u) { return u.user_id === r.user_id; })[0];
        var peran = String(r.role).toUpperCase();
        var isi = { user_id: r.user_id, name: r.name, email: r.email, role: peran,
                    title: r.title || NBRbac.roleLabel(peran), employee_id: r.employee_id || null,
                    scope: r.employee_id
                      ? { type: "TREE", employee_id: r.employee_id,
                          department_id: (_kar(r.employee_id) || {}).department_id }
                      : (String(r.scope_type).toUpperCase() === "ENTITY"
                          ? { type: "ENTITY", ids: String(r.scope_ids || "").split("|")
                                .map(function (x) { return x.trim(); }).filter(Boolean) }
                          : { type: "ALL" }) };
        if (u0) Object.assign(u0, isi); else db.users.push(isi);
        masuk += 1;
      });
    }

    if (kode === "KARYAWAN") {
      lolos.forEach(function (h) {
        var r = h.baris;
        // Keputusan 2a: kolom nik_sementara memetakan karyawan sementara dari realisasi ke
        // NIK asli. Seluruh rujukan ikut berganti supaya tidak ada yang menggantung.
        if (r.nik_sementara) {
          var lama = _kar(r.nik_sementara);
          if (lama && lama.sementara && r.employee_id !== r.nik_sementara) {
            gantiNik(r.nik_sementara, r.employee_id);
          }
        }
        var e = _kar(r.employee_id);
        var d = _dep(r.department_id);
        var div = d ? db.divisions.filter(function (x) { return x.division_id === d.division_id; })[0] : null;
        var isi = {
          name: r.name, position_id: r.position_id, grade_id: r.grade_id,
          department_id: r.department_id, division_id: d ? d.division_id : null,
          directorate_id: div ? div.directorate_id : null,
          entity_id: div ? div.entity_id : null, cost_center_id: d ? d.cost_center_id : null,
          employment_status: r.employment_status || "Tetap", join_date: r.join_date || null,
          direct_report_id: r.direct_report_id || null
        };
        if (e) {
          // Keputusan 6b: perubahan dari berkas karyawan tercatat sebagai sumber tersendiri.
          Object.keys(isi).forEach(function (f) {
            if (isi[f] !== undefined && e[f] !== isi[f] && ["grade_id", "department_id", "position_id",
                "employment_status", "direct_report_id", "name"].indexOf(f) !== -1) {
              catatRevisi("Employee", e.employee_id, f, e[f] === undefined ? null : e[f], isi[f],
                          "Impor berkas karyawan", 1);
            }
          });
          Object.assign(e, isi);
          if (e.sementara) e.sementara = false;
        } else {
          db.employees.push(Object.assign({ employee_id: r.employee_id }, isi));
        }
        masuk += 1;
      });
    }

    if (kode === "ASUMSI") {
      var tahun = _sik(cycleId) ? _sik(cycleId).year : new Date().getFullYear();
      var versi = db.cost_assumptions.length + 1;
      // Satu berkas boleh memuat beberapa entitas; tiap entitas menjadi paket sendiri.
      var perEntitas = {};
      lolos.forEach(function (h) { var e = h.baris.entity_id || ""; (perEntitas[e] = perEntitas[e] || []).push(h); });
      Object.keys(perEntitas).forEach(function (ent, idx) {
        var paketEnt = {
          assumption_id: "CA-" + tahun + "-U" + (versi + idx) + (ent ? "-" + ent : ""),
          effective_date: tahun + "-01-01", entity_id: ent || null,
          created_by: sesi.user.user_id, note: "Diunggah lewat impor" + (ent ? ", entitas " + ent : ""),
          grades: perEntitas[ent].map(function (h) {
            var r = h.baris, o = { grade_id: r.grade_id };
            NBImpor.def("ASUMSI").kolom.forEach(function (k) {
              if (k.k !== "grade_id" && k.k !== "entity_id") o[k.k] = angkaDari(r[k.k]);
            });
            return o;
          })
        };
        db.cost_assumptions.push(paketEnt);
        masuk += paketEnt.grades.length;
      });
    }

    if (kode === "USULAN") {
      lolos.forEach(function (h) {
        var res = tambahBaris(cycleId, h.baris.department_id, h.data);
        if (res.ok) masuk += 1; else { h.ok = false; h.kunci = res.kunci || "plan.errTutup"; }
      });
    }

    if (kode === "REALISASI") {
      lolos.forEach(function (h) {
        var r = h.baris;
        var res = catatActual(r.allocation_id, {
          quantity: angkaDari(r.quantity), actual_date: r.actual_date,
          employee_name: r.employee_name || null, employee_id: r.employee_id || null
        });
        if (res.ok) masuk += 1; else { h.ok = false; h.kunci = res.kunci || "mon.errAlokasi"; }
      });
    }

    simpan();
    NBAudit.tulis(sesi.user, "DATA_IMPORT", "Import", kode,
      { key: "audit.d.impor", vars: { k: kode, n: masuk, g: pra.galat } });
    return { ok: true, masuk: masuk, galat: pra.hasil.filter(function (h) { return !h.ok; }) };
  }

  // Ekspor balik untuk setiap berkas yang bisa diunggah, supaya siklusnya tertutup:
  // unduh, sunting di Excel, unggah lagi.
  function eksporData(kode, cycleId) {
    var b = NBImpor.def(kode);
    if (!b) return { kolom: [], baris: [] };
    var kolom = b.kolom.map(function (k) { return { kunci: k.k, label: k.k }; });

    if (kode === "ORGANISASI") {
      return { kolom: kolom, baris: departemenTerlihat().map(function (d) {
        var div = db.divisions.filter(function (x) { return x.division_id === d.division_id; })[0] || {};
        var dir = db.directorates.filter(function (x) { return x.directorate_id === div.directorate_id; })[0] || {};
        var ent = db.entities.filter(function (x) { return x.entity_id === div.entity_id; })[0] || {};
        var cc = db.cost_centers.filter(function (x) { return x.cost_center_id === d.cost_center_id; })[0] || {};
        return { entity_id: ent.entity_id || "", entity_name: ent.name || "",
                 country: ent.country || "", currency: ent.currency || "",
                 directorate_id: dir.directorate_id || "",
                 directorate_name: dir.name || "", division_id: div.division_id || "",
                 division_name: div.name || "", department_id: d.department_id,
                 department_name: d.name, cost_center_id: d.cost_center_id,
                 cost_center_name: cc.name || "" };
      }) };
    }

    if (kode === "KURS") return { kolom: kolom, baris: salin(db.fx_rates) };
    if (kode === "POSISI") return { kolom: kolom, baris: posisiTerlihat().map(function (p) {
      return Object.assign({}, p, { is_unique: p.is_unique ? 1 : 0 }); }) };
    if (kode === "VACANCY") return { kolom: kolom, baris: vacancyTerlihat() };
    if (kode === "PENGGUNA") return { kolom: kolom, baris: salin(db.users).filter(function (u) {
      return !u.bawaan; }).map(function (u) {
      return Object.assign({}, u, { scope_type: u.scope.type, scope_ids: (u.scope.ids || []).join("|") }); }) };
    if (kode === "KARYAWAN") {
      var peta = {};
      db.employees.forEach(function (e) { peta[e.employee_id] = e; });
      return { kolom: kolom, baris: karyawanTerlihat().map(function (e) {
        var d = _dep(e.department_id) || {};
        var div = db.divisions.filter(function (x) { return x.division_id === d.division_id; })[0] || {};
        var dir = db.directorates.filter(function (x) { return x.directorate_id === div.directorate_id; })[0] || {};
        var ent = db.entities.filter(function (x) { return x.entity_id === div.entity_id; })[0] || {};
        var a = e.direct_report_id ? peta[e.direct_report_id] : null;
        return Object.assign({}, e, {
          position_title: (_pos(e.position_id) || {}).title || "",
          legal_entity: ent.name || "", country: ent.country || "",
          directorate: dir.name || "", division: div.name || "",
          direct_report_name: a ? a.name : "",
          direct_report_position: a ? ((_pos(a.position_id) || {}).title || "") : ""
        });
      }) };
    }
    if (kode === "ASUMSI") {
      var paket = asumsiBiaya(tanggalAcuan(cycleId));
      return { kolom: kolom, baris: paket ? paket.grades : [] };
    }
    if (kode === "USULAN") {
      return { kolom: kolom, baris: barisSiklusTerlihat(cycleId) };
    }
    if (kode === "REALISASI") {
      return { kolom: kolom, baris: actualTerlihat(cycleId) };
    }
    return { kolom: kolom, baris: [] };
  }

  // Cadangan seluruh keadaan prototipe, termasuk audit, supaya bisa disimpan dan dibuka lagi.
  function cadangan() {
    return JSON.stringify({
      versi: 1, dibuat: new Date().toISOString(), oleh: sesi.user ? sesi.user.user_id : null,
      db: db, audit: NBAudit.semua()
    }, null, 2);
  }

  function pulihkanCadangan(teks) {
    if (!NBRbac.can(sesi.user, "admin")) return { ok: false, kunci: "imp.errPeran" };
    var isi;
    try { isi = JSON.parse(teks); } catch (e) { return { ok: false, kunci: "imp.errJson" }; }
    if (!isi || !isi.db || !isi.db.departments) return { ok: false, kunci: "imp.errCadangan" };
    db = isi.db;
    simpan();
    if (global.NBAudit && NBAudit.reset) NBAudit.reset();
    NBAudit.tulis(sesi.user, "DATA_RESTORE", "Prototype", "-",
      { key: "audit.d.pulih", vars: { t: isi.dibuat ? NBFormat.tanggal(isi.dibuat) : "-" } });
    return { ok: true };
  }

  // --- Matriks bulanan Januari sampai Desember ------------------------------
  // Bentuk baku laporan MPP bulanan: tiga pita baris per unit, yaitu Budget, Actual,
  // dan Selisih, dikali dua belas kolom bulan.
  //
  // Keputusan yang dipakai: angka bulanan adalah POSISI AKHIR BULAN, bukan penambahan
  // pada bulan itu. Rekrutmen efektif Maret membuat kolom Maret sampai Desember naik satu,
  // bukan hanya Maret. Ini yang lazim dipakai di lembar MPP dan yang bisa dibandingkan
  // langsung dengan payroll bulanan.

  function biayaBulananGrade(gradeId, ctx) {
    var r = NBCosting.bulanan(ctx.asumsi(gradeId), ctx.param);
    return r ? r.total : 0;
  }

  // Dampak headcount satu alokasi per unit kuota, dipakai untuk memecah realisasi parsial.
  function hcPerUnit(a) {
    return a.approved_qty ? a.hc_impact / a.approved_qty : 0;
  }

  function matriksBulanan(cycleId, opsi) {
    var o = opsi || {};
    var mode = o.mode === "RP" ? "RP" : "HC";
    var level = o.level === "POSISI" ? "POSISI" : "DEPT";
    var ctx = konteksBiaya(cycleId);
    // Mode rupiah lintas mata uang: setiap baris dikonversi ke Rupiah dengan kurs bertanggal.
    var mataUangLingkup = {};
    departemenTerlihat().forEach(function (d) { mataUangLingkup[mataUangDepartemen(d.department_id)] = true; });
    var lintasMataUang = Object.keys(mataUangLingkup).length > 1;
    function faktor(departmentId) {
      if (mode !== "RP" || !lintasMataUang) return 1;
      var k = kurs(mataUangDepartemen(departmentId), ctx.tanggal);
      return k === null ? 0 : k;
    }
    function biayaGradeDept(gradeId, departmentId) {
      var c2 = konteksBiaya(cycleId, departmentId);
      var r = NBCosting.bulanan(c2.asumsi(gradeId), c2.param);
      return (r ? r.total : 0) * faktor(departmentId);
    }
    var snap = snapshotAktif(cycleId);
    var lines = snap ? snapshotBarisTerlihat(snap.snapshot_id) : [];
    var alokasi = alokasiTerlihat(cycleId);
    var actual = actualTerlihat(cycleId).filter(function (a) { return a.status === "RECORDED"; });
    var deps = departemenTerlihat();

    // Kunci baris: departemen, atau departemen ditambah jabatan.
    function kunciDari(o2) {
      if (level === "DEPT") return o2.department_id;
      return o2.department_id + "|" + (o2.position_title || o2.new_position_title ||
        (o2.position_id ? (_pos(o2.position_id) || {}).title : null) || "-");
    }

    var peta = {};
    function ambil(kunci, contoh) {
      if (peta[kunci]) return peta[kunci];
      var d = _dep(contoh.department_id) || {};
      var div = d.division_id ? divisi(d.division_id) : null;
      var ent = div ? (db.entities.filter(function (e) {
        return e.entity_id === div.entity_id; })[0] || {}) : {};
      peta[kunci] = {
        kunci: kunci, department_id: contoh.department_id, departemen: d.name || contoh.department_id,
        cost_center_id: d.cost_center_id || "-",
        divisi: div ? div.name : "-", entitas: ent.name || "-", negara: ent.country || "-",
        jabatan: level === "POSISI" ? kunci.split("|")[1] : null,
        awal: 0, budget: [], actual: [], selisih: []
      };
      for (var i = 0; i < 12; i++) {
        peta[kunci].budget.push(0); peta[kunci].actual.push(0); peta[kunci].selisih.push(0);
      }
      return peta[kunci];
    }

    // 1. Posisi awal, yaitu keadaan pada snapshot Current.
    lines.forEach(function (l) {
      var b = ambil(kunciDari(l), l);
      b.awal += mode === "HC" ? 1 : biayaGradeDept(l.grade_id, l.department_id);
    });
    // Baris yang hanya muncul lewat usulan tetap perlu tempat.
    alokasi.forEach(function (a) { ambil(kunciDari(a), a); });
    if (level === "DEPT") deps.forEach(function (d) { ambil(d.department_id, d); });

    // 2. Budget: posisi awal ditambah kumulatif alokasi yang sudah berlaku sampai bulan itu.
    Object.keys(peta).forEach(function (kunci) {
      var b = peta[kunci];
      for (var m = 0; m < 12; m++) b.budget[m] = b.awal;
    });
    alokasi.forEach(function (a) {
      var b = peta[kunciDari(a)];
      if (!b) return;
      var mulai = Math.max(1, Math.min(12, Number(a.effective_month) || 1));
      var nilai = mode === "HC" ? a.hc_impact
        : (a.monthly_cost || 0) * faktor(a.department_id);   // biaya bulanan penuh, dikonversi bila perlu
      for (var m = mulai - 1; m < 12; m++) b.budget[m] += nilai;
      // Mutasi keluar mengurangi departemen asal, masuk menambah departemen tujuan.
      if (a.action_type === "TRANSFER" && a.target_department_id) {
        var tujuan = peta[level === "DEPT" ? a.target_department_id
          : a.target_department_id + "|" + (kunciDari(a).split("|")[1] || "-")];
        if (tujuan) {
          for (var t = mulai - 1; t < 12; t++) {
            b.budget[t] -= mode === "HC" ? 1 : (a.monthly_cost || 0);
            tujuan.budget[t] += mode === "HC" ? 1 : (a.monthly_cost || 0);
          }
        }
      }
    });

    // 3. Actual: posisi awal ditambah kumulatif realisasi menurut tanggal masuk kerja.
    Object.keys(peta).forEach(function (kunci) {
      var b = peta[kunci];
      for (var m = 0; m < 12; m++) b.actual[m] = b.awal;
    });
    actual.forEach(function (r) {
      var a = alokasi.filter(function (x) { return x.allocation_id === r.allocation_id; })[0];
      if (!a) return;
      var b = peta[kunciDari(a)];
      if (!b) return;
      var mulai = Math.max(1, Math.min(12, Number(r.effective_month) || 1));
      var nilai = mode === "HC" ? hcPerUnit(a) * r.quantity
        : (a.approved_qty ? (a.monthly_cost / a.approved_qty) * r.quantity : 0) * faktor(a.department_id);
      for (var m = mulai - 1; m < 12; m++) b.actual[m] += nilai;
    });

    // 4. Selisih selalu actual dikurangi budget, supaya kekurangan terbaca negatif.
    var baris = Object.keys(peta).map(function (kunci) {
      var b = peta[kunci];
      for (var m = 0; m < 12; m++) {
        b.budget[m] = Math.round(b.budget[m]);
        b.actual[m] = Math.round(b.actual[m]);
        b.selisih[m] = b.actual[m] - b.budget[m];
      }
      b.budgetAkhir = b.budget[11];
      b.actualAkhir = b.actual[11];
      b.selisihAkhir = b.selisih[11];
      return b;
    }).filter(function (b) {
      return b.awal !== 0 || b.budget.some(function (x) { return x !== 0; }) ||
             b.actual.some(function (x) { return x !== 0; });
    }).sort(function (x, y) { return x.kunci < y.kunci ? -1 : 1; });

    var total = { kunci: "TOTAL", departemen: null, budget: [], actual: [], selisih: [] };
    for (var m = 0; m < 12; m++) {
      total.budget.push(baris.reduce(function (t, b) { return t + b.budget[m]; }, 0));
      total.actual.push(baris.reduce(function (t, b) { return t + b.actual[m]; }, 0));
      total.selisih.push(total.actual[m] - total.budget[m]);
    }
    total.budgetAkhir = total.budget[11];
    total.actualAkhir = total.actual[11];
    total.selisihAkhir = total.selisih[11];

    return { mode: mode, level: level, baris: baris, total: total,
             assumption_id: ctx.assumption_id, punyaSnapshot: !!snap,
             lintasMataUang: lintasMataUang };
  }

  // --- Ringkasan eksekutif (F8-2) -------------------------------------------
  // Satu layar untuk orang yang tidak akan mengklik sembilan menu. Tidak ada angka yang
  // dihitung di sini; semuanya dirangkai dari fungsi yang sudah diuji.
  function ringkasanEksekutif(cycleId) {
    var c = _sik(cycleId);
    if (!c) return null;
    var snap = snapshotAktif(cycleId);
    var k = konsolidasi(cycleId);
    var r = ringkasKeputusan(cycleId);
    var apr = approvalSiklus(cycleId);
    var h = biayaSiklus(cycleId);
    var m = ringkasMonitoring(cycleId);
    var deps = departemenTerlihat();

    // Rantai empat state dalam headcount
    var current = snap ? snapshotBarisTerlihat(snap.snapshot_id).length : k.total.current;
    var rantai = {
      current: current,
      proposed: current + k.total.netto,
      approved: apr.length ? current + apr[0].netto_disetujui : null,
      actual: m.total.kuota ? current + m.total.hcRealisasi : null
    };

    // Pergerakan terbesar per departemen, dari alokasi bila sudah ada, dari usulan bila belum
    var alok = alokasiTerlihat(cycleId);
    var gerak = deps.map(function (d) {
      var dariAlok = alok.filter(function (a) { return a.department_id === d.department_id; })
                         .reduce(function (t, a) { return t + a.hc_impact; }, 0);
      var pd = k.perDept.filter(function (x) { return x.department_id === d.department_id; })[0];
      return { department_id: d.department_id, name: d.name,
               netto: alok.length ? dariAlok : (pd ? pd.netto : 0),
               sumber: alok.length ? "alokasi" : "usulan" };
    }).filter(function (x) { return x.netto !== 0; })
      .sort(function (a, b) { return Math.abs(b.netto) - Math.abs(a.netto); }).slice(0, 5);

    // Apa yang sedang menunggu siapa
    var subs = db.submissions.filter(function (s) { return s.cycle_id === cycleId; });
    var menunggu = {
      belumKirim: deps.filter(function (d) {
        return !subs.some(function (s) { return s.department_id === d.department_id && s.status !== "DRAFT"; }); }).length,
      reviewOd: subs.filter(function (s) { return s.status === "SUBMITTED"; }).length,
      keputusan: barisReview(cycleId).filter(function (l) { return !l.decision; }).length,
      distribusi: apr.length && !alok.some(function (a) { return a.approval_id === apr[0].approval_id; }) ? 1 : 0,
      exception: m.menunggu,
      persetujuanHc: realisasiMenunggu(cycleId).length,
      luarSiklus: subs.filter(function (s) { return s.off_cycle && ["DISTRIBUTED"].indexOf(s.status) === -1; }).length
    };

    return {
      siklus: salin(c), rantai: rantai,
      biaya: h ? { usulan: h.total.annualized, disetujui: r.disetujuiBiaya, realisasi: m.total.biayaActual,
                   tanpaKurs: h.total.tanpaKurs || [] } : null,
      utilisasi: m.total.utilisasi, kuota: m.total.kuota, terpakai: m.total.terpakai, sisa: m.total.sisa,
      gerak: gerak, menunggu: menunggu, perEntitas: k.perEntitas,
      approval: apr[0] || null, exceptions: m.exceptions.length
    };
  }

  // --- Reorganisasi terkendali (F7-3) ---------------------------------------
  // Memindahkan departemen ke divisi atau direktorat lain adalah keputusan organisasi, bukan
  // efek samping unggahan berkas. Karena itu jalurnya sendiri: OD, dengan alasan, tercatat di
  // riwayat revisi. Snapshot lama tidak pernah berubah; snapshot berikutnya membaca yang baru.
  function pindahkanDepartemen(departmentId, divisionIdBaru, alasan) {
    if (!NBRbac.can(sesi.user, "admin")) return { ok: false, kunci: "reorg.errPeran" };
    var d = _dep(departmentId);
    if (!d) return { ok: false, kunci: "imp.vDept", vars: { v: departmentId } };
    var div = db.divisions.filter(function (x) { return x.division_id === divisionIdBaru; })[0];
    if (!div) return { ok: false, kunci: "reorg.errDivisi" };
    if (div.division_id === d.division_id) return { ok: false, kunci: "reorg.errSama" };
    if (!alasan || alasan.trim().length < 10) return { ok: false, kunci: "review.errAlasan" };
    var divLama = db.divisions.filter(function (x) { return x.division_id === d.division_id; })[0] || {};
    // Lintas entitas tetap dilarang, karena itu bukan reorganisasi melainkan pemindahan badan hukum.
    if (div.entity_id !== divLama.entity_id) return { ok: false, kunci: "reorg.errLintasEntitas" };

    var sebelum = d.division_id;
    d.division_id = div.division_id;
    d.directorate_id = div.directorate_id;
    db.employees.forEach(function (e) {
      if (e.department_id === departmentId) { e.division_id = div.division_id; e.directorate_id = div.directorate_id; }
    });
    catatRevisi("Department", departmentId, "division_id", sebelum, div.division_id, alasan, 1);
    simpan();
    NBAudit.tulis(sesi.user, "REORG", "Department", departmentId,
      { key: "audit.d.reorg", vars: { d: d.name, a: divLama.name || sebelum, b: div.name }, reason: alasan },
      sebelum, div.division_id);
    return { ok: true };
  }

  function riwayatReorganisasi() {
    return salin(db.revisions.filter(function (r) { return r.object_type === "Department"; })).reverse();
  }

  // --- Perubahan data master ---------------------------------------------
  // Tidak ada jalur tulis lain. Setiap perubahan wajib lewat sini supaya
  // audit tidak bisa dilewati (BR-08).
  function ubah(objectType, objectId, field, nilaiBaru, opsi) {
    var o = opsi || {};
    var target = null;
    if (objectType === "Department") target = _dep(objectId);
    if (objectType === "Employee") target = _kar(objectId);
    if (!target) return { ok: false, alasan: "Objek tidak ditemukan" };

    var deptTarget = objectType === "Department" ? objectId : target.department_id;
    if (!NBRbac.inScope(sesi.user, semuaDepartemen(), deptTarget)) {
      NBAudit.tulis(sesi.user, "SCOPE_DENIED", objectType, objectId, { key: "audit.d.denyScope" });
      return { ok: false, alasan: "Di luar lingkup akses Anda" };
    }
    if (!NBRbac.can(sesi.user, o.capability || "dept.note.edit")) {
      NBAudit.tulis(sesi.user, "SCOPE_DENIED", objectType, objectId,
        { key: "audit.d.denyCap", vars: { cap: o.capability || "dept.note.edit" } });
      return { ok: false, alasan: "Peran Anda tidak berhak melakukan ini" };
    }

    var sebelum = target[field];
    if (sebelum === nilaiBaru) return { ok: true, tidakBerubah: true };
    target[field] = nilaiBaru;
    simpan();
    NBAudit.tulis(sesi.user, "DATA_EDIT", objectType, objectId,
      { key: o.key || "audit.d.editField",
        vars: Object.assign({ field: field }, o.vars || {}),
        reason: o.reason || null },
      sebelum, nilaiBaru);
    return { ok: true, sebelum: sebelum, sesudah: nilaiBaru };
  }

  function departemenDariAudit(entri) {
    if (entri.object_type === "Department") return entri.object_id;
    if (entri.object_type === "MPPLineItem") {
      var l = _baris(entri.object_id);
      return l ? l.department_id : null;
    }
    if (entri.object_type === "Employee") {
      var e = _kar(entri.object_id);
      return e ? e.department_id : null;
    }
    return null;
  }

  muat();

  global.NBStore = {
    masuk: masuk, keluar: keluar, user: user, pulihkanSesi: pulihkanSesi, reset: reset,
    semuaDepartemen: semuaDepartemen, departemenTerlihat: departemenTerlihat,
    departemen: departemen, divisi: divisi, grade: grade, semuaGrade: semuaGrade,
    posisi: posisi, costCenter: costCenter, karyawan: karyawan, pengguna: pengguna, semuaPengguna: semuaPengguna,
    jumlahData: jumlahData,
    semuaEntitas: function () { return salin(db.entities); },
    karyawanTerlihat: karyawanTerlihat, posisiTerlihat: posisiTerlihat, vacancyTerlihat: vacancyTerlihat,
    semuaSiklus: semuaSiklus, siklus: siklus, siklusAktif: siklusAktif, bolehUbahSiklus: bolehUbahSiklus,
    buatSiklus: buatSiklus, ubahStatusSiklus: ubahStatusSiklus,
    snapshotSiklus: snapshotSiklus, snapshot: snapshot, snapshotAktif: snapshotAktif,
    rilisSnapshot: rilisSnapshot, bandingkanSnapshot: bandingkanSnapshot,
    snapshotBarisTerlihat: snapshotBarisTerlihat,
    submissionDepartemen: submissionDepartemen, barisSubmission: barisSubmission,
    barisSiklusTerlihat: barisSiklusTerlihat, bolehRencana: bolehRencana,
    tambahBaris: tambahBaris, ubahBaris: ubahBaris, hapusBaris: hapusBaris,
    currentHc: currentHc, periksaBaris: periksaBaris,
    daftarSubmission: daftarSubmission, ringkasSubmission: ringkasSubmission,
    konsolidasi: konsolidasi, kunciKonsolidasi: kunciKonsolidasi,
    parameterBiaya: parameterBiaya, asumsiBiaya: asumsiBiaya, semuaAsumsi: semuaAsumsi,
    semuaParameter: semuaParameter, konteksBiaya: konteksBiaya, biayaGrade: biayaGrade,
    biayaBaris: biayaBaris, biayaSiklus: biayaSiklus, gradeBaris: gradeBaris,
    barisReview: barisReview, putuskanBaris: putuskanBaris, setujuiMpp: setujuiMpp,
    kembalikanKeDepartemen: kembalikanKeDepartemen, approvalSiklus: approvalSiklus,
    ringkasKeputusan: ringkasKeputusan, revisiSiklus: revisiSiklus, revisiObjek: revisiObjek,
    kuantitasUsulan: kuantitasUsulan, kuantitasDisetujui: kuantitasDisetujui,
    distribusikanAlokasi: distribusikanAlokasi, alokasiTerlihat: alokasiTerlihat,
    catatActual: catatActual, batalkanActual: batalkanActual, putuskanException: putuskanException,
    setujuiRealisasi: setujuiRealisasi, realisasiMenunggu: realisasiMenunggu,
    tetapkanAtasanMutasi: tetapkanAtasanMutasi, bukaPermintaanLuarSiklus: bukaPermintaanLuarSiklus,
    konfirmasiPindahEntitas: konfirmasiPindahEntitas,
    pindahkanDepartemen: pindahkanDepartemen, riwayatReorganisasi: riwayatReorganisasi,
    ringkasanEksekutif: ringkasanEksekutif,
    semuaDivisi: function () { return salin(db.divisions); },
    ringkasMonitoring: ringkasMonitoring, actualTerlihat: actualTerlihat,
    dataLaporan: dataLaporan, notifikasi: notifikasi, periksaPenutupan: periksaPenutupan,
    pohonOrganisasi: pohonOrganisasi, levelGrade: levelGrade, hodDari: hodDari,
    entitasDepartemen: entitasDepartemen, kurs: kurs, mataUangDepartemen: mataUangDepartemen,
    direktorat: function (id) { var x = db.directorates.filter(function (d) { return d.directorate_id === id; })[0]; return x ? salin(x) : null; },
    matriksBulanan: matriksBulanan,
    bolehImpor: bolehImpor, pratinjauImpor: pratinjauImpor, terapkanImpor: terapkanImpor,
    eksporData: eksporData, cadangan: cadangan, pulihkanCadangan: pulihkanCadangan,
    exceptionTerlihat: exceptionTerlihat,
    alokasiBaris: alokasiBaris, ringkasAlokasi: ringkasAlokasi,
    kirimSubmission: kirimSubmission, reviewSubmission: reviewSubmission,
    mutasiMasuk: mutasiMasuk, konfirmasiMutasi: konfirmasiMutasi,
    ubah: ubah, departemenDariAudit: departemenDariAudit
  };
})(window);
