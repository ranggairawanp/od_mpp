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
    var tersimpan = null;
    try {
      var mentah = simpanan.get(KUNCI_DB);
      if (mentah) tersimpan = JSON.parse(mentah);
    } catch (e) { tersimpan = null; }

    if (tersimpan) { db = tersimpan; return; }

    var D = global.NB_DATA || {};
    db = {
      entities: salin(D.entities || []),
      divisions: salin(D.divisions || []),
      departments: salin(D.departments || []),
      cost_centers: salin(D.cost_centers || []),
      grades: salin(D.grades || []),
      positions: salin(D.positions || []),
      employees: salin(D.employees || []),
      users: salin(D.users || []),
      vacancies: salin(D.vacancies || []),
      cycles: salin(D.cycles || []),
      snapshots: salin(D.snapshots || [])
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
    try { simpanan.set(KUNCI_DB, JSON.stringify(db)); } catch (e) { /* memori saja */ }
  }

  function reset() {
    simpanan.hapus(KUNCI_DB);
    simpanan.hapus("nb_mpp_audit");
    muat();
  }

  // --- Sesi ---------------------------------------------------------------
  function masuk(userId) {
    var u = (db.users || []).filter(function (x) { return x.user_id === userId; })[0];
    if (!u) return null;
    sesi.user = u;
    sesi.mulai = new Date().toISOString();
    simpanan.set("nb_mpp_user", userId);
    NBAudit.tulis(u, "USER_LOGIN", "Session", u.user_id,
      "Sesi simulasi dimulai sebagai " + NBRbac.roleLabel(u.role));
    return u;
  }

  function pulihkanSesi() {
    var id = simpanan.get("nb_mpp_user");
    if (!id) return null;
    var u = (db.users || []).filter(function (x) { return x.user_id === id; })[0];
    if (u) { sesi.user = u; sesi.mulai = new Date().toISOString(); }
    return u || null;
  }

  function keluar() {
    if (sesi.user) NBAudit.tulis(sesi.user, "USER_LOGOUT", "Session", sesi.user.user_id, "Sesi diakhiri");
    sesi.user = null;
    simpanan.hapus("nb_mpp_user");
  }

  function user() { return sesi.user; }

  // --- Master data --------------------------------------------------------
  function semuaDepartemen() { return db.departments.slice(); }
  function departemen(id) { return db.departments.filter(function (d) { return d.department_id === id; })[0] || null; }
  function divisi(id) { return db.divisions.filter(function (d) { return d.division_id === id; })[0] || null; }
  function grade(id) { return db.grades.filter(function (g) { return g.grade_id === id; })[0] || null; }
  function semuaGrade() { return db.grades.slice(); }
  function posisi(id) { return db.positions.filter(function (p) { return p.position_id === id; })[0] || null; }
  function costCenter(id) { return db.cost_centers.filter(function (c) { return c.cost_center_id === id; })[0] || null; }
  function karyawan(id) { return db.employees.filter(function (e) { return e.employee_id === id; })[0] || null; }

  // --- Data terikat lingkup pengguna --------------------------------------
  function departemenTerlihat() {
    var izin = NBRbac.scopeDepartments(sesi.user, semuaDepartemen());
    return semuaDepartemen().filter(function (d) { return izin.indexOf(d.department_id) !== -1; });
  }

  function karyawanTerlihat(filter) {
    var f = filter || {};
    var baris = NBRbac.filterRows(sesi.user, semuaDepartemen(), db.employees, "department_id");
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
    return NBRbac.filterRows(sesi.user, semuaDepartemen(), db.positions, "department_id");
  }

  function vacancyTerlihat() {
    return NBRbac.filterRows(sesi.user, semuaDepartemen(), db.vacancies, "department_id");
  }

  // --- Siklus MPP (FR-01) -------------------------------------------------
  function semuaSiklus() {
    return db.cycles.slice().sort(function (a, b) { return b.year - a.year; });
  }
  function siklus(id) { return db.cycles.filter(function (c) { return c.cycle_id === id; })[0] || null; }

  // Siklus perencanaan aktif: yang berstatus OPEN, kalau tidak ada ambil yang belum ditutup.
  function siklusAktif() {
    var buka = db.cycles.filter(function (c) { return c.status === "OPEN"; })[0];
    if (buka) return buka;
    var belumTutup = db.cycles.filter(function (c) { return c.status !== "CLOSED"; })
                              .sort(function (a, b) { return b.year - a.year; })[0];
    return belumTutup || semuaSiklus()[0] || null;
  }

  function bolehUbahSiklus(c) {
    // BR-09: siklus tertutup hanya bisa dibaca.
    if (!c) return { ok: false, alasan: "Siklus tidak ditemukan" };
    if (c.status === "CLOSED") return { ok: false, alasan: "Siklus sudah ditutup dan bersifat read only (BR-09)" };
    return { ok: true };
  }

  function buatSiklus(data) {
    if (!NBRbac.can(sesi.user, "cycle.create")) {
      NBAudit.tulis(sesi.user, "SCOPE_DENIED", "MPPCycle", data.year, "Peran tidak berhak membuat siklus");
      return { ok: false, alasan: "Hanya OD yang boleh membuat siklus" };
    }
    if (db.cycles.filter(function (c) { return c.year === Number(data.year); }).length) {
      return { ok: false, alasan: "Siklus tahun " + data.year + " sudah ada" };
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
      "Membuat siklus " + c.name + ", batas pengumpulan " + NBFormat.tanggal(c.submission_deadline));
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
    var c = siklus(cycleId);
    if (!c) return { ok: false, alasan: "Siklus tidak ditemukan" };
    if (!NBRbac.can(sesi.user, "cycle.create")) {
      NBAudit.tulis(sesi.user, "SCOPE_DENIED", "MPPCycle", cycleId, "Peran tidak berhak mengubah status siklus");
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
      c.closed_by = sesi.user.user_id;
      c.closed_at = new Date().toISOString();
    }
    var sebelum = c.status;
    c.status = statusBaru;
    simpan();
    NBAudit.tulis(sesi.user, "CYCLE_STATUS", "MPPCycle", c.cycle_id,
      "Status siklus " + c.name + " berubah" + (alasan ? ". Alasan: " + alasan : ""), sebelum, statusBaru);
    return { ok: true, siklus: c };
  }

  // --- Snapshot struktur organisasi (FR-02) -------------------------------
  function snapshotSiklus(cycleId) {
    return db.snapshots.filter(function (s) { return s.cycle_id === cycleId; })
                       .sort(function (a, b) { return b.version - a.version; });
  }
  function snapshot(id) { return db.snapshots.filter(function (s) { return s.snapshot_id === id; })[0] || null; }

  function snapshotAktif(cycleId) {
    return snapshotSiklus(cycleId).filter(function (s) { return s.status === "RELEASED"; })[0] || null;
  }

  // Rilis snapshot menyalin keadaan master saat ini menjadi baris beku.
  // Setelah dirilis, baris ini tidak pernah diubah lagi walaupun master berubah.
  // Inilah state Current dalam rantai Current, Proposed, Approved, Actual.
  function rilisSnapshot(cycleId, effectiveDate) {
    var c = siklus(cycleId);
    var jaga = bolehUbahSiklus(c);
    if (!jaga.ok) return jaga;
    if (!NBRbac.can(sesi.user, "snapshot.upload")) {
      NBAudit.tulis(sesi.user, "SCOPE_DENIED", "OrgSnapshot", cycleId, "Peran tidak berhak merilis snapshot");
      return { ok: false, alasan: "Hanya OD yang boleh merilis snapshot" };
    }
    if (!effectiveDate) return { ok: false, alasan: "Tanggal berlaku snapshot wajib diisi" };

    var versi = snapshotSiklus(cycleId).length + 1;
    var lines = db.employees.map(function (e) {
      var p = posisi(e.position_id);
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
      "Merilis snapshot " + s.snapshot_id + " berisi " + lines.length + " baris karyawan dan " +
      s.vacancy_ids.length + " vacancy, berlaku " + NBFormat.tanggal(effectiveDate));
    return { ok: true, snapshot: s };
  }

  // Perbandingan snapshot terhadap master hari ini. Dipakai untuk membuktikan
  // snapshot benar-benar beku, dan nanti menjadi dasar analisis Current versus Actual.
  function bandingkanSnapshot(snapshotId) {
    var s = snapshot(snapshotId);
    if (!s || !s.lines) return [];
    var beda = [];
    s.lines.forEach(function (l) {
      var e = karyawan(l.employee_id);
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
    var idSnap = s.lines.map(function (l) { return l.employee_id; });
    db.employees.forEach(function (e) {
      if (idSnap.indexOf(e.employee_id) === -1) {
        beda.push({ employee_id: e.employee_id, nama: e.name, field: "keberadaan",
                    snapshot: "tidak ada", master: "ada" });
      }
    });
    return beda;
  }

  // --- Perubahan data master ---------------------------------------------
  // Tidak ada jalur tulis lain. Setiap perubahan wajib lewat sini supaya
  // audit tidak bisa dilewati (BR-08).
  function ubah(objectType, objectId, field, nilaiBaru, opsi) {
    var o = opsi || {};
    var target = null;
    if (objectType === "Department") target = departemen(objectId);
    if (objectType === "Employee") target = karyawan(objectId);
    if (!target) return { ok: false, alasan: "Objek tidak ditemukan" };

    var deptTarget = objectType === "Department" ? objectId : target.department_id;
    if (!NBRbac.inScope(sesi.user, semuaDepartemen(), deptTarget)) {
      NBAudit.tulis(sesi.user, "SCOPE_DENIED", objectType, objectId,
        "Percobaan mengubah data di luar lingkup akses");
      return { ok: false, alasan: "Di luar lingkup akses Anda" };
    }
    if (!NBRbac.can(sesi.user, o.capability || "dept.note.edit")) {
      NBAudit.tulis(sesi.user, "SCOPE_DENIED", objectType, objectId,
        "Peran tidak memiliki kapabilitas " + (o.capability || "dept.note.edit"));
      return { ok: false, alasan: "Peran Anda tidak berhak melakukan ini" };
    }

    var sebelum = target[field];
    if (sebelum === nilaiBaru) return { ok: true, tidakBerubah: true };
    target[field] = nilaiBaru;
    simpan();
    NBAudit.tulis(sesi.user, "DATA_EDIT", objectType, objectId,
      (o.detail || ("Mengubah " + field)) + (o.reason ? ". Alasan: " + o.reason : ""),
      sebelum, nilaiBaru);
    return { ok: true, sebelum: sebelum, sesudah: nilaiBaru };
  }

  function departemenDariAudit(entri) {
    if (entri.object_type === "Department") return entri.object_id;
    if (entri.object_type === "Employee") {
      var e = karyawan(entri.object_id);
      return e ? e.department_id : null;
    }
    return null;
  }

  muat();

  global.NBStore = {
    masuk: masuk, keluar: keluar, user: user, pulihkanSesi: pulihkanSesi, reset: reset,
    semuaDepartemen: semuaDepartemen, departemenTerlihat: departemenTerlihat,
    departemen: departemen, divisi: divisi, grade: grade, semuaGrade: semuaGrade,
    posisi: posisi, costCenter: costCenter, karyawan: karyawan,
    karyawanTerlihat: karyawanTerlihat, posisiTerlihat: posisiTerlihat, vacancyTerlihat: vacancyTerlihat,
    semuaSiklus: semuaSiklus, siklus: siklus, siklusAktif: siklusAktif, bolehUbahSiklus: bolehUbahSiklus,
    buatSiklus: buatSiklus, ubahStatusSiklus: ubahStatusSiklus,
    snapshotSiklus: snapshotSiklus, snapshot: snapshot, snapshotAktif: snapshotAktif,
    rilisSnapshot: rilisSnapshot, bandingkanSnapshot: bandingkanSnapshot,
    ubah: ubah, departemenDariAudit: departemenDariAudit
  };
})(window);
