// Layar Approved MPP (bab 20 dan 21).
// Menampilkan baseline kendali: Requested, Approved, Variance per departemen, dan daftar
// alokasi yang bisa dikurangi sepanjang tahun. Kolom biaya mengikuti hak akses kolom.
(function (global) {
  "use strict";

  var T = function (k, v) { return NBi18n.t(k, v); };
  var state = { tab: "varians" };

  function tabelVarians(r, bolehBiaya) {
    if (!r.perDept.length) {
      return NBUi.kosong(T("alok.kosong"), T("alok.kosongSub"), NBUi.svg("layers"));
    }
    return "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
      "<th>" + NBUi.esc(T("umum.departemen")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("alok.thRequested")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("alok.thApproved")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("alok.thVariance")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("alok.thKuota")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("alok.thSisa")) + "</th>" +
      (bolehBiaya ? "<th class='nb-num'>" + NBUi.esc(T("biaya.thTahunan")) + "</th>" : "") +
      "</tr></thead><tbody>" + r.perDept.map(function (d) {
        var v = d.variance;
        return "<tr><td><div class='nb-cell-title'>" + NBUi.esc(d.name) + "</div>" +
          "<div class='nb-cell-sub nb-mono'>" + NBUi.esc(d.cost_center_id) + "</div></td>" +
          "<td class='nb-num'>" + NBFormat.delta(d.requested) + "</td>" +
          "<td class='nb-num'><b>" + NBFormat.delta(d.approved) + "</b></td>" +
          "<td class='nb-num'>" + (v === 0
            ? "<span class='nb-muted'>0</span>"
            : NBUi.badge(NBFormat.delta(v), v < 0 ? "is-amber" : "is-emerald")) + "</td>" +
          "<td class='nb-num'>" + NBFormat.angka(d.approvedQty) + "</td>" +
          "<td class='nb-num'><b>" + NBFormat.angka(d.sisa) + "</b></td>" +
          (bolehBiaya ? "<td class='nb-num nb-mono'>" + NBFormat.rupiahRingkas(d.biaya) + "</td>" : "") +
        "</tr>";
      }).join("") +
      "<tr><td><b>" + NBUi.esc(T("kons.totalPerusahaan")) + "</b></td>" +
        "<td class='nb-num'><b>" + NBFormat.delta(r.total.requested) + "</b></td>" +
        "<td class='nb-num'><b>" + NBFormat.delta(r.total.approved) + "</b></td>" +
        "<td class='nb-num'><b>" + NBFormat.delta(r.total.variance) + "</b></td>" +
        "<td class='nb-num'><b>" + NBFormat.angka(r.total.approvedQty) + "</b></td>" +
        "<td class='nb-num'><b>" + NBFormat.angka(r.total.sisa) + "</b></td>" +
        (bolehBiaya ? "<td class='nb-num'><b>" + NBFormat.rupiahRingkas(r.total.biaya) + "</b></td>" : "") +
      "</tr></tbody></table></div>";
  }

  function namaSasaran(a) {
    if (a.employee_id) return (NBStore.karyawan(a.employee_id) || {}).name || a.employee_id;
    if (a.new_position_title) return a.new_position_title;
    if (a.position_id) return (NBStore.posisi(a.position_id) || {}).title || a.position_id;
    if (a.vacancy_id) return a.vacancy_id;
    return "-";
  }

  function tabelAlokasi(r, bolehBiaya) {
    if (!r.alokasi.length) {
      return NBUi.kosong(T("alok.kosong"), T("alok.kosongSub"), NBUi.svg("layers"));
    }
    return "<div class='nb-tablewrap'><table class='nb-table' style='min-width:980px'><thead><tr>" +
      "<th>" + NBUi.esc(T("alok.thId")) + "</th>" +
      "<th>" + NBUi.esc(T("plan.thAction")) + "</th>" +
      "<th>" + NBUi.esc(T("plan.thSasaran")) + "</th>" +
      "<th>" + NBUi.esc(T("plan.thBulan")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("alok.thKuota")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("alok.thTerpakai")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("alok.thSisa")) + "</th>" +
      (bolehBiaya ? "<th class='nb-num'>" + NBUi.esc(T("biaya.thTahunan")) + "</th>" : "") +
      "</tr></thead><tbody>" + r.alokasi.map(function (a) {
        var d = NBStore.departemen(a.department_id);
        return "<tr><td><span class='nb-code'>" + NBUi.esc(a.allocation_id) + "</span>" +
            "<div class='nb-cell-sub nb-mono'>" + NBUi.esc(a.line_item_id) + "</div></td>" +
          "<td>" + NBUi.badge(T("act." + a.action_type), (NBActions.def(a.action_type) || {}).badge) + "</td>" +
          "<td><div class='nb-cell-title' style='white-space:nowrap'>" + NBUi.esc(namaSasaran(a)) + "</div>" +
            "<div class='nb-cell-sub'>" + NBUi.esc(d ? d.name : a.department_id) +
            " &middot; " + NBUi.esc(a.grade_id || "-") + "</div></td>" +
          "<td>" + NBUi.esc(a.effective_month ? NBFormat.bulanPendek(a.effective_month) : "-") + "</td>" +
          "<td class='nb-num'>" + a.approved_qty + "</td>" +
          "<td class='nb-num'>" + a.consumed_qty + "</td>" +
          "<td class='nb-num'><b>" + a.remaining_qty + "</b></td>" +
          (bolehBiaya ? "<td class='nb-num nb-mono'>" + NBFormat.rupiahRingkas(a.annualized_cost) + "</td>" : "") +
        "</tr>";
      }).join("") + "</tbody></table></div>";
  }

  function render() {
    var u = NBStore.user();
    var c = NBStore.siklusAktif();
    if (!c) return "<div class='nb-card'>" + NBUi.kosong(T("dash.siklusKosong"), T("dash.siklusKosongSub")) + "</div>";

    var r = NBStore.ringkasAlokasi(c.cycle_id);
    var apr = NBStore.approvalSiklus(c.cycle_id);
    var deps = NBStore.departemenTerlihat();
    // Kolom biaya hanya tampil kalau seluruh departemen dalam lingkup boleh dilihat biayanya.
    var bolehBiaya = deps.every(function (d) { return NBRbac.canSeeCost(u, d.department_id); });
    var bolehDistribusi = NBRbac.can(u, "approved.distribute") && apr.length && !r.terdistribusi;

    var aksi = bolehDistribusi
      ? "<button class='nb-btn nb-btn-primary' id='aDistribusi'>" + NBUi.esc(T("alok.distribusi")) + "</button>"
      : (r.terdistribusi
          ? NBUi.badge(T("alok.sudah", { n: r.alokasi.length }), "is-emerald")
          : NBUi.badge(T("alok.belum"), "is-amber"));

    var tabs = [["varians", "alok.tabVarians"], ["alokasi", "alok.tabAlokasi"]];

    return "" +
    "<div class='nb-pagehead'><div>" +
      "<h1>" + NBUi.esc(T("alok.judul")) + "</h1>" +
      "<p>" + NBUi.esc(T("alok.sub", { name: c.name })) + "</p></div>" + aksi + "</div>" +

    "<div class='nb-kpigrid'>" +
      NBUi.kpi(T("alok.kpiApproved"), NBFormat.delta(r.total.approved), "check", "is-emerald",
               apr.length ? T("alok.kpiApprovedKet", { id: apr[0].approval_id }) : T("alok.belum")) +
      NBUi.kpi(T("alok.kpiVariance"), NBFormat.delta(r.total.variance), "shield",
               r.total.variance < 0 ? "is-amber" : "", T("alok.kpiVarianceKet")) +
      NBUi.kpi(T("alok.kpiKuota"), NBFormat.angka(r.total.approvedQty), "layers", "is-blue",
               T("alok.kpiKuotaKet", { n: r.alokasi.length })) +
      NBUi.kpi(T("alok.kpiSisa"), NBFormat.angka(r.total.sisa), "chart", "",
               T("alok.kpiSisaKet")) +
    "</div>" +

    "<div class='nb-card nb-card-pad' style='margin-bottom:24px;background:var(--nb-gray-50)'>" +
      "<div class='nb-note'>" + NBUi.svg("shield") + "<div>" +
      "<div style='font-weight:600'>" + NBUi.esc(T("alok.aturanJudul")) + "</div>" +
      "<div class='nb-cell-sub'>" + NBUi.esc(T("alok.aturanIsi")) + "</div></div></div></div>" +

    "<div class='nb-card'>" +
      "<div class='nb-toolbar'><div class='nb-tabs'>" + tabs.map(function (t) {
        return "<button class='nb-tab" + (state.tab === t[0] ? " is-active" : "") +
               "' data-tab='" + t[0] + "'>" + NBUi.esc(T(t[1])) + "</button>";
      }).join("") + "</div>" +
      "<div class='nb-cell-sub'>" + NBUi.esc(T("alok.dasar")) + "</div></div>" +
      (state.tab === "alokasi" ? tabelAlokasi(r, bolehBiaya) : tabelVarians(r, bolehBiaya)) +
    "</div>";
  }

  function mount() {
    document.querySelectorAll("button[data-tab]").forEach(function (b) {
      b.onclick = function () { state.tab = b.dataset.tab; NBApp.ulang(); };
    });

    var dist = document.getElementById("aDistribusi");
    if (dist) dist.onclick = function () {
      var c = NBStore.siklusAktif();
      NBUi.konfirmasi({
        judul: T("alok.distribusiJudul"), pesan: T("alok.distribusiPesan"),
        ok: T("alok.distribusi"), batal: T("umum.batal")
      }, function () {
        var res = NBStore.distribusikanAlokasi(c.cycle_id);
        NBUi.toast(res.ok ? T("alok.terdistribusi", { n: res.jumlah })
                          : T(res.kunci, res.vars || {}), res.ok ? "ok" : "error");
        if (res.ok) NBApp.ulang();
      });
    };
  }

  global.NBPages = global.NBPages || {};
  global.NBPages.approved = { render: render, mount: mount };
})(window);
