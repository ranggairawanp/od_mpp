// Layar 1 dari inventaris bab 25. Modul 0 dan 1 hanya menampilkan yang benar-benar ada datanya.
// Angka Proposed, Approved, dan Actual sengaja kosong sampai modulnya dibangun (prinsip 5).
(function (global) {
  "use strict";

  var T = function (k, v) { return NBi18n.t(k, v); };

  var STATUS = {
    DRAFT:  ["siklus.stDraft", "is-plain"],
    OPEN:   ["siklus.stOpen", "is-blue"],
    LOCKED: ["siklus.stLocked", "is-amber"],
    CLOSED: ["siklus.stClosed", "is-emerald"]
  };

  // Proposed dihitung dari baris usulan dalam lingkup pengguna, bukan angka tetap.
  function proposed(c) {
    var baris = NBStore.barisSiklusTerlihat(c.cycle_id);
    if (!baris.length) return ["Proposed", NBi18n.t("umum.belumAda"), NBi18n.t("dash.noteProposed")];
    var deps = NBStore.departemenTerlihat();
    var netto = 0;
    deps.forEach(function (d) {
      var b = baris.filter(function (x) {
        return x.department_id === d.department_id || x.target_department_id === d.department_id;
      });
      netto += NBActions.rekap(b, d.department_id).netto;
    });
    return ["Proposed", NBi18n.t("dash.hc", { n: NBFormat.delta(netto) }),
            NBi18n.t("dash.noteProposedAda", { n: baris.length, d: deps.length })];
  }

  // Approved terisi hanya kalau manajemen sudah menyetujui paketnya.
  function approved(c) {
    var apr = NBStore.approvalSiklus(c.cycle_id);
    if (!apr.length) return ["Approved", NBi18n.t("umum.belumAda"), NBi18n.t("dash.noteApproved")];
    var a = apr[0];
    return ["Approved", NBi18n.t("dash.hc", { n: NBFormat.delta(a.netto_disetujui) }),
            NBi18n.t("dash.noteApprovedAda", { id: a.approval_id, t: NBFormat.tanggalPendek(a.approved_at) })];
  }

  // Actual terisi begitu ada realisasi yang dicatat.
  function actual(c) {
    var m = NBStore.ringkasMonitoring(c.cycle_id);
    if (!m.total.kuota) return ["Actual", NBi18n.t("umum.belumAda"), NBi18n.t("dash.noteActual")];
    return ["Actual", NBi18n.t("dash.hc", { n: NBFormat.delta(m.total.hcRealisasi) }),
            NBi18n.t("dash.noteActualAda", { u: m.total.utilisasi, s: m.total.sisa })];
  }

  function kartuSiklus() {
    var c = NBStore.siklusAktif();
    if (!c) {
      return "<div class='nb-card'>" +
        NBUi.kosong(T("dash.siklusKosong"), T("dash.siklusKosongSub")) + "</div>";
    }
    var snap = NBStore.snapshotAktif(c.cycle_id);
    var st = STATUS[c.status] || ["", ""];

    var terlihat = snap ? NBStore.snapshotBarisTerlihat(snap.snapshot_id).length : 0;
    var catatanCurrent = !snap
      ? T("dash.noteCurrentNone")
      : (terlihat < snap.line_count
          ? T("dash.noteCurrentScoped", { id: snap.snapshot_id })
          : T("dash.noteCurrent", { id: snap.snapshot_id }));

    var rantai = [
      ["Current",  snap ? T("dash.hc", { n: NBFormat.angka(terlihat) }) : T("umum.belumAda"), catatanCurrent],
      proposed(c),
      approved(c),
      actual(c)
    ];

    return "<div class='nb-card nb-card-pad'>" +
      "<div class='nb-card-head'>" + NBUi.svg("layers") + "<div>" +
        "<h3>" + NBUi.esc(T("dash.rantaiJudul", { name: c.name })) + " " +
          NBUi.badge(T(st[0]), st[1]) + "</h3>" +
        "<p>" + NBUi.esc(T("dash.rantaiSub")) + "</p>" +
      "</div></div>" +
      "<div style='display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px'>" +
      rantai.map(function (r) {
        return "<div class='nb-setting' style='display:block;margin:0'>" +
          "<div class='nb-kpi-label'>" + NBUi.esc(r[0]) + "</div>" +
          "<div style='font-weight:600;margin:6px 0'>" + NBUi.esc(r[1]) + "</div>" +
          "<div class='nb-setting-desc'>" + NBUi.esc(r[2]) + "</div></div>";
      }).join("") + "</div></div>";
  }

  // Daftar pekerjaan yang menunggu pengguna. Menggantikan notifikasi surel yang belum ada,
  // dan dihitung dari keadaan data, bukan dari catatan notifikasi yang bisa basi.
  function panelNotifikasi() {
    var c = NBStore.siklusAktif();
    if (!c) return "";
    var n = NBStore.notifikasi(c.cycle_id);
    if (!n.length) return "";
    return "<div class='nb-card nb-card-pad' style='margin-bottom:24px'>" +
      "<div class='nb-card-head'>" + NBUi.svg("shield") + "<div>" +
      "<h3>" + NBUi.esc(NBi18n.t("notif.judul", { n: n.length })) + "</h3>" +
      "<p>" + NBUi.esc(NBi18n.t("notif.sub")) + "</p></div></div>" +
      n.map(function (x) {
        return "<a class='nb-setting' href='#" + x.rute + "' style='margin-bottom:8px;text-decoration:none;color:inherit'>" +
          NBUi.badge(NBi18n.t("notif.j" + x.jenis), "is-blue") +
          "<div style='flex:1'>" + NBUi.esc(NBi18n.t(x.kunci, x.vars)) + "</div>" +
          "<span class='nb-cell-sub'>" + NBUi.esc(NBi18n.t("notif.buka")) + "</span></a>";
      }).join("") + "</div>";
  }

  function render() {
    var u = NBStore.user();
    var karyawan = NBStore.karyawanTerlihat();
    var deps = NBStore.departemenTerlihat();
    var pos = NBStore.posisiTerlihat();
    var tetap = karyawan.filter(function (e) { return e.employment_status === "Tetap"; }).length;

    var kpi =
      NBUi.kpi(T("dash.kpiKaryawan"), NBFormat.angka(karyawan.length), "users", "") +
      NBUi.kpi(T("dash.kpiDepartemen"), NBFormat.angka(deps.length), "building", "is-blue") +
      NBUi.kpi(T("dash.kpiPosisi"), NBFormat.angka(pos.length), "briefcase", "is-teal") +
      NBUi.kpi(T("dash.kpiTetap"), NBFormat.angka(tetap), "check", "is-emerald",
               karyawan.length ? T("dash.kpiTetapNote", { p: Math.round(tetap / karyawan.length * 100) }) : "");

    // Kolom biaya belum terisi karena Cost Assumption baru masuk di Modul 5 (BR-11).
    var baris = deps.map(function (d) {
      var isi = karyawan.filter(function (e) { return e.department_id === d.department_id; });
      var div = NBStore.divisi(d.division_id);
      var bolehBiaya = NBRbac.canSeeCost(u, d.department_id);
      return "<tr><td><div class='nb-cell-title'>" + NBUi.esc(d.name) + "</div>" +
             "<div class='nb-cell-sub'>" + NBUi.esc(div ? div.name : "-") + "</div></td>" +
             "<td class='nb-mono'>" + NBUi.esc(d.cost_center_id) + "</td>" +
             "<td class='nb-num'>" + NBFormat.angka(isi.length) + "</td>" +
             "<td class='nb-num nb-muted'>" +
               (bolehBiaya ? NBUi.esc(T("umum.belumDihitung")) : NBUi.svg("lock")) + "</td></tr>";
    }).join("");

    return "" +
    "<div class='nb-pagehead'><div>" +
      "<h1>" + NBUi.esc(T("dash.judul")) + "</h1>" +
      "<p>" + NBUi.esc(T("dash.sub")) + "</p>" +
    "</div>" +
      NBUi.badge(NBRbac.roleLabel(u.role), "is-plain") +
    "</div>" +

    "<div class='nb-kpigrid'>" + kpi + "</div>" +

    panelNotifikasi() +

    "<div class='nb-card' style='margin-bottom:24px'>" +
      "<div class='nb-toolbar'><div><div style='font-weight:600'>" + NBUi.esc(T("dash.tabelJudul")) + "</div>" +
      "<div class='nb-cell-sub'>" + NBUi.esc(T("dash.tabelSub")) + "</div></div></div>" +
      "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
        "<th>" + NBUi.esc(T("umum.departemen")) + "</th>" +
        "<th>" + NBUi.esc(T("dash.thCostCenter")) + "</th>" +
        "<th class='nb-num'>" + NBUi.esc(T("dash.thHc")) + "</th>" +
        "<th class='nb-num'>" + NBUi.esc(T("dash.thCost")) + "</th>" +
      "</tr></thead><tbody>" + baris + "</tbody></table></div>" +
    "</div>" +

    kartuSiklus();
  }

  global.NBPages = global.NBPages || {};
  global.NBPages.dashboard = { render: render };
})(window);
