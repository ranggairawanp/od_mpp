// Layar Ringkasan Eksekutif (F8-2). Untuk manajemen, OD, C&B, dan HC Business Partner.
// Satu halaman: rantai empat state, biaya, utilisasi, pergerakan terbesar, dan apa yang
// sedang menunggu siapa. Tidak ada angka yang dihitung di sini.
(function (global) {
  "use strict";
  var T = function (k, v) { return NBi18n.t(k, v); };

  function kartuState(label, nilai, ket, varian) {
    return "<div class='nb-kpi'><div><div class='nb-kpi-label'>" + NBUi.esc(label) + "</div>" +
      "<div class='nb-kpi-value'>" + (nilai === null ? "<span class='nb-muted'>-</span>" : NBFormat.angka(nilai)) + "</div>" +
      "<div class='nb-cell-sub'>" + NBUi.esc(ket) + "</div></div>" +
      "<div class='nb-tile " + (varian || "") + "'>" + NBUi.svg("layers") + "</div></div>";
  }

  function render() {
    var u = NBStore.user();
    var c = NBStore.siklusAktif();
    if (!c) return "<div class='nb-card'>" + NBUi.kosong(T("dash.siklusKosong"), T("dash.siklusKosongSub")) + "</div>";
    var e = NBStore.ringkasanEksekutif(c.cycle_id);
    var bolehBiaya = NBStore.departemenTerlihat().every(function (d) { return NBRbac.canSeeCost(u, d.department_id); });
    var r = e.rantai;

    var tunggu = [
      ["exec.tBelumKirim", e.menunggu.belumKirim, "planning"], ["exec.tReviewOd", e.menunggu.reviewOd, "usulan"],
      ["exec.tKeputusan", e.menunggu.keputusan, "review"], ["exec.tDistribusi", e.menunggu.distribusi, "approved"],
      ["exec.tException", e.menunggu.exception, "monitoring"], ["exec.tHc", e.menunggu.persetujuanHc, "monitoring"],
      ["exec.tLuar", e.menunggu.luarSiklus, "usulan"]
    ].filter(function (x) { return x[1] > 0; });

    return "" +
    "<div class='nb-pagehead'><div>" +
      "<h1>" + NBUi.esc(T("exec.judul")) + "</h1>" +
      "<p>" + NBUi.esc(T("exec.sub", { name: c.name })) + "</p></div>" +
      NBUi.badge(e.approval ? T("exec.disetujui", { id: e.approval.approval_id, t: NBFormat.tanggalPendek(e.approval.approved_at) })
                            : T("exec.belumDisetujui"), e.approval ? "is-emerald" : "is-amber") +
    "</div>" +

    "<div class='nb-kpigrid'>" +
      kartuState(T("exec.current"), r.current, T("exec.currentKet"), "") +
      kartuState(T("exec.proposed"), r.proposed, T("exec.proposedKet", { n: NBFormat.delta(r.proposed - r.current) }), "is-blue") +
      kartuState(T("exec.approved"), r.approved, r.approved === null ? T("exec.belumAda") : T("exec.approvedKet", { n: NBFormat.delta(r.approved - r.current) }), "is-emerald") +
      kartuState(T("exec.actual"), r.actual, r.actual === null ? T("exec.belumAda") : T("exec.actualKet", { u: e.utilisasi }), "is-amber") +
    "</div>" +

    (bolehBiaya && e.biaya
      ? "<div class='nb-kpigrid'>" +
        NBUi.kpi(T("exec.biayaUsulan"), NBFormat.rupiahRingkas(e.biaya.usulan), "chart", "", T("exec.biayaKet"), true) +
        NBUi.kpi(T("exec.biayaSetuju"), NBFormat.rupiahRingkas(e.biaya.disetujui), "check", "is-emerald",
                 T("exec.hemat", { n: NBFormat.rupiahRingkas(e.biaya.usulan - e.biaya.disetujui) }), true) +
        NBUi.kpi(T("exec.biayaRealisasi"), NBFormat.rupiahRingkas(e.biaya.realisasi), "layers", "is-amber",
                 T("exec.sisaKuota", { n: e.sisa }), true) +
        NBUi.kpi(T("exec.utilisasi"), e.utilisasi + " persen", "shield", "",
                 T("exec.utilisasiKet", { a: e.terpakai, b: e.kuota })) +
        "</div>" +
        (e.biaya.tanpaKurs.length ? "<div class='nb-card nb-card-pad' style='margin-bottom:24px;border-color:var(--nb-amber-bd);background:var(--nb-amber-bg)'>" +
          NBUi.esc(T("biaya.tanpaKurs", { n: e.biaya.tanpaKurs.join(", ") })) + "</div>" : "")
      : "") +

    "<div class='nb-grid-2'>" +
      "<div class='nb-card nb-card-pad'>" +
        "<div class='nb-card-head'>" + NBUi.svg("chart") + "<div><h3>" + NBUi.esc(T("exec.gerakJudul")) + "</h3>" +
        "<p>" + NBUi.esc(T("exec.gerakSub")) + "</p></div></div>" +
        (e.gerak.length ? e.gerak.map(function (g) {
          return "<div class='nb-setting' style='margin-bottom:8px'>" +
            NBUi.badge(NBFormat.delta(g.netto), g.netto > 0 ? "is-emerald" : "is-red") +
            "<div style='flex:1'>" + NBUi.esc(g.name) + "</div>" +
            "<span class='nb-cell-sub'>" + NBUi.esc(T("exec.sumber" + g.sumber)) + "</span></div>";
        }).join("") : NBUi.kosong(T("exec.gerakKosong"), "")) +
      "</div>" +
      "<div class='nb-card nb-card-pad'>" +
        "<div class='nb-card-head'>" + NBUi.svg("shield") + "<div><h3>" + NBUi.esc(T("exec.tungguJudul")) + "</h3>" +
        "<p>" + NBUi.esc(T("exec.tungguSub")) + "</p></div></div>" +
        (tunggu.length ? tunggu.map(function (t) {
          return "<a class='nb-setting' href='#" + t[2] + "' style='margin-bottom:8px;text-decoration:none;color:inherit'>" +
            NBUi.badge(String(t[1]), "is-amber") + "<div style='flex:1'>" + NBUi.esc(T(t[0])) + "</div>" +
            "<span class='nb-cell-sub'>" + NBUi.esc(T("notif.buka")) + "</span></a>";
        }).join("") : "<div class='nb-setting'>" + NBUi.badge(T("adm.siap"), "is-emerald") + "<div style='flex:1'>" + NBUi.esc(T("exec.tungguKosong")) + "</div></div>") +
      "</div>" +
    "</div>" +

    (e.perEntitas.length > 1
      ? "<div class='nb-card' style='margin-top:24px'><div class='nb-toolbar'><div style='font-weight:600'>" +
        NBUi.esc(T("kons.tabEntitas")) + "</div></div><div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
        "<th>" + NBUi.esc(T("umum.entitas")) + "</th><th class='nb-num'>" + NBUi.esc(T("kons.thCurrent")) + "</th>" +
        "<th class='nb-num'>" + NBUi.esc(T("kons.thNetto")) + "</th><th class='nb-num'>" + NBUi.esc(T("kons.thProposed")) + "</th></tr></thead><tbody>" +
        e.perEntitas.map(function (x) {
          return "<tr><td>" + NBUi.esc(x.name) + "</td><td class='nb-num'>" + NBFormat.angka(x.current) + "</td>" +
            "<td class='nb-num'><b>" + NBFormat.delta(x.netto) + "</b></td><td class='nb-num'>" + NBFormat.angka(x.proposed) + "</td></tr>";
        }).join("") + "</tbody></table></div></div>"
      : "");
  }

  global.NBPages = global.NBPages || {};
  global.NBPages.eksekutif = { render: render, mount: function () {} };
})(window);
