// Audit log. Append only, tidak pernah diubah dan tidak pernah dihapus (BR-08).
// Perbedaan dengan Revision History (bab 47): audit mencatat siapa melakukan apa,
// revision mencatat data bergerak dari nilai apa ke nilai apa. Revision History
// dibangun di Modul 6 saat versioning masuk. Modul 0 sudah menyiapkan kolom before/after
// supaya tidak ada jalur perubahan data yang lolos tanpa jejak.
(function (global) {
  "use strict";

  var KUNCI = "nb_mpp_audit";
  var log = [];
  var seq = 0;

  // Audit prototipe bertahan antar halaman lewat penyimpanan sesi.
  // Kalau penyimpanan tidak tersedia, log hanya hidup selama satu halaman.
  (function muat() {
    try {
      var mentah = global.NBSimpanan ? NBSimpanan.get(KUNCI) : null;
      if (mentah) { log = JSON.parse(mentah); seq = log.length; }
    } catch (e) { log = []; seq = 0; }
  })();

  function simpan() {
    if (!global.NBSimpanan) return;
    try { NBSimpanan.set(KUNCI, JSON.stringify(log)); } catch (e) { /* abaikan */ }
  }

  var TIPE = {
    "USER_LOGIN":     { label: "User Login",     badge: "is-plain" },
    "USER_LOGOUT":    { label: "User Logout",    badge: "is-plain" },
    "DATA_VIEW":      { label: "Data View",      badge: "is-blue" },
    "DATA_EDIT":      { label: "Data Edit",      badge: "is-indigo" },
    "SCOPE_DENIED":   { label: "Access Denied",  badge: "is-red" },
    "SNAPSHOT_RELEASE": { label: "Snapshot Release", badge: "is-teal" },
    "CYCLE_CREATE":   { label: "Cycle Created", badge: "is-violet" },
    "CYCLE_STATUS":   { label: "Cycle Status",  badge: "is-amber" },
    "DATA_RESET":     { label: "Data Reset",    badge: "is-red" },
    "MGMT_DECISION":  { label: "Mgmt Decision", badge: "is-indigo" },
    "MGMT_APPROVE":   { label: "MPP Approved",  badge: "is-emerald" },
    "MGMT_RETURN":    { label: "Mgmt Return",   badge: "is-amber" },
    "CONSOLIDATE":    { label: "Consolidate",   badge: "is-teal" },
    "PLAN_SUBMIT":    { label: "Plan Submit",   badge: "is-blue" },
    "PLAN_ACCEPT":    { label: "Plan Accept",   badge: "is-emerald" },
    "PLAN_RETURN":    { label: "Plan Return",   badge: "is-amber" },
    "ALLOC_DISTRIBUTE": { label: "Allocation",  badge: "is-violet" },
    "ACTUAL_RECORD":    { label: "Actual",      badge: "is-emerald" },
    "ACTUAL_CANCEL":    { label: "Actual Cancel", badge: "is-plain" },
    "ACTUAL_BLOCKED":   { label: "Actual Blocked", badge: "is-red" },
    "ACTUAL_EXCEPTION": { label: "Exception",   badge: "is-amber" },
    "EXCEPTION_DECISION": { label: "Exc Decision", badge: "is-indigo" },
    "REPORT_EXPORT":  { label: "Report Export", badge: "is-teal" },
    "ACTUAL_APPROVE": { label: "Actual Approved", badge: "is-emerald" },
    "REORG":          { label: "Reorganisasi", badge: "is-violet" },
    "ACTUAL_REJECT":  { label: "Actual Rejected", badge: "is-red" },
    "DATA_IMPORT":    { label: "Data Import", badge: "is-violet" },
    "DATA_RESTORE":   { label: "Data Restore", badge: "is-red" }
  };

  // detail boleh berupa string, atau objek { key, vars, reason } supaya pesan log
  // bisa ditampilkan dalam bahasa apa pun tanpa menerjemahkan ulang isi log lama.
  function tulis(actor, tipe, objectType, objectId, detail, before, after) {
    var key = null, vars = null, reason = null, teks = detail;
    if (detail && typeof detail === "object") {
      key = detail.key; vars = detail.vars || null; reason = detail.reason || null;
      teks = detail.key;
    }
    seq += 1;
    var entri = {
      audit_id: "AUD-" + String(seq).padStart(5, "0"),
      timestamp: new Date().toISOString(),
      actor_id: actor ? actor.user_id : "-",
      actor_email: actor ? actor.email : "-",
      actor_role: actor ? actor.role : "-",
      event_type: tipe,
      object_type: objectType || "-",
      object_id: objectId || "-",
      detail: teks || "",
      detail_key: key,
      detail_vars: vars,
      reason: reason,
      before: before === undefined ? null : before,
      after: after === undefined ? null : after,
      // Prototipe tidak punya IP nyata. Ditandai jelas supaya tidak dikira data riil.
      source: "prototipe-lokal"
    };
    log.push(entri);
    simpan();
    document.dispatchEvent(new CustomEvent("nb:audit", { detail: entri }));
    return entri;
  }

  // Temuan uji keamanan: slice hanya menyalin daftarnya, entrinya tetap objek yang sama,
  // sehingga isi audit bisa diubah lewat hasil pembacaan. Audit bersifat append only,
  // jadi yang keluar harus salinan dalam.
  function semua() {
    try { return JSON.parse(JSON.stringify(log)).reverse(); }
    catch (e) { return log.slice().reverse(); }
  }

  // Penyaringan audit mengikuti lingkup pengguna (bab 23: HOD hanya "own relevant").
  function untuk(user, departmentResolver) {
    if (!user) return [];
    if (user.role === "HOD" || user.role === "MANAGER") {
      // Lingkup pohon menyimpan satu departemen, lingkup lama menyimpan daftar.
      var izin = user.scope.type === "TREE"
        ? [user.scope.department_id] : (user.scope.ids || []);
      return semua().filter(function (e) {
        if (e.actor_id === user.user_id) return true;
        var dep = departmentResolver ? departmentResolver(e) : null;
        return dep && izin.indexOf(dep) !== -1;
      });
    }
    return semua();
  }

  function reset() {
    log = []; seq = 0;
    if (global.NBSimpanan) NBSimpanan.hapus(KUNCI);
  }

  global.NBAudit = { tulis: tulis, semua: semua, untuk: untuk, reset: reset, TIPE: TIPE };
})(window);
