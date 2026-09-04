// Layar Konsolidasi (FR-05). Milik OD.
// Angka di layar ini tidak pernah dihitung di sini. Semuanya berasal dari NBStore.konsolidasi,
// supaya aturan anti double counting hanya hidup di satu tempat dan bisa diuji sendiri.
(function (global) {
  "use strict";

  var T = function (k, v) { return NBi18n.t(k, v); };
  var state = { tab: "dept" };

  function tabelDept(k) {
    return "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
      "<th>" + NBUi.esc(T("umum.departemen")) + "</th>" +
      "<th>" + NBUi.esc(T("umum.status")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("kons.thCurrent")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("kons.thTambah")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("kons.thKurang")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("kons.thNetto")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("kons.thProposed")) + "</th>" +
      "</tr></thead><tbody>" +
      k.perDept.map(function (d) {
        var st = d.status === "NONE" ? T("kons.stNONE") : T("plan.status" + d.status);
        var badge = d.ikut ? "is-emerald" : (d.status === "NONE" ? "is-plain" : "is-amber");
        return "<tr" + (d.ikut ? "" : " style='opacity:.65'") + ">" +
          "<td><div class='nb-cell-title'>" + NBUi.esc(d.name) + "</div>" +
            "<div class='nb-cell-sub nb-mono'>" + NBUi.esc(d.cost_center_id) + "</div></td>" +
          "<td>" + NBUi.badge(st, badge) + "</td>" +
          "<td class='nb-num'>" + NBFormat.angka(d.current) + "</td>" +
          "<td class='nb-num'>" + (d.tambah ? NBFormat.delta(d.tambah) : "<span class='nb-muted'>0</span>") + "</td>" +
          "<td class='nb-num'>" + (d.kurang ? NBFormat.delta(-d.kurang) : "<span class='nb-muted'>0</span>") + "</td>" +
          "<td class='nb-num'><b>" + NBFormat.delta(d.netto) + "</b></td>" +
          "<td class='nb-num'>" + NBFormat.angka(d.proposed) + "</td></tr>";
      }).join("") +
      "<tr><td colspan='2'><b>" + NBUi.esc(T("kons.totalPerusahaan")) + "</b></td>" +
        "<td class='nb-num'><b>" + NBFormat.angka(k.total.current) + "</b></td>" +
        "<td class='nb-num'><b>" + NBFormat.delta(k.total.tambah) + "</b></td>" +
        "<td class='nb-num'><b>" + NBFormat.delta(-k.total.kurang) + "</b></td>" +
        "<td class='nb-num'><b>" + NBFormat.delta(k.total.netto) + "</b></td>" +
        "<td class='nb-num'><b>" + NBFormat.angka(k.total.proposed) + "</b></td></tr>" +
      "</tbody></table></div>";
  }

  // Tingkat legal entity, hanya tampil bila entitasnya lebih dari satu.
  function tabelEntitas(k) {
    return "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
      "<th>" + NBUi.esc(T("umum.entitas")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("kons.thDepartemen")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("kons.thCurrent")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("kons.thNetto")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("kons.thProposed")) + "</th>" +
      "</tr></thead><tbody>" + k.perEntitas.map(function (e) {
        return "<tr><td><div class='nb-cell-title'>" + NBUi.esc(e.name) + "</div>" +
          "<div class='nb-cell-sub nb-mono'>" + NBUi.esc(e.entity_id) + "</div></td>" +
          "<td class='nb-num'>" + e.departemen + "</td>" +
          "<td class='nb-num'>" + NBFormat.angka(e.current) + "</td>" +
          "<td class='nb-num'><b>" + NBFormat.delta(e.netto) + "</b></td>" +
          "<td class='nb-num'>" + NBFormat.angka(e.proposed) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  function tabelAction(k) {
    var isi = k.perAction.filter(function (a) { return a.baris > 0; });
    if (!isi.length) return NBUi.kosong(T("kons.kosong"), T("kons.kosongSub"));
    return "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
      "<th>" + NBUi.esc(T("plan.thAction")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("review.thBaris")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("plan.thQty")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("kons.thDampak")) + "</th>" +
      "<th>" + NBUi.esc(T("kons.thCatatan")) + "</th>" +
      "</tr></thead><tbody>" + isi.map(function (a) {
        return "<tr><td>" + NBUi.badge(T("act." + a.action), (NBActions.def(a.action) || {}).badge) + "</td>" +
          "<td class='nb-num'>" + NBFormat.angka(a.baris) + "</td>" +
          "<td class='nb-num'>" + NBFormat.angka(a.qty) + "</td>" +
          "<td class='nb-num'>" + (a.hc ? "<b>" + NBFormat.delta(a.hc) + "</b>"
                                        : "<span class='nb-muted'>0</span>") + "</td>" +
          "<td class='nb-cell-sub'>" + NBUi.esc(T("kons.ket" + a.action)) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  function tabelBulan(k) {
    var maks = k.perBulan.reduce(function (m, b) { return Math.max(m, b.tambah, b.kurang); }, 1);
    return "<div style='padding:4px 20px 20px;display:grid;" +
      "grid-template-columns:repeat(12,1fr);gap:6px;align-items:end'>" +
      k.perBulan.map(function (b) {
        var t = Math.round(b.tambah / maks * 70), g = Math.round(b.kurang / maks * 70);
        return "<div style='text-align:center'>" +
          "<div style='height:76px;display:flex;flex-direction:column;justify-content:flex-end;gap:2px'>" +
            (b.tambah ? "<div style='height:" + t + "px;background:var(--nb-emerald-bd);" +
              "border-radius:4px 4px 0 0'></div>" : "") +
            (b.kurang ? "<div style='height:" + g + "px;background:var(--nb-red-200);" +
              "border-radius:0 0 4px 4px'></div>" : "") +
          "</div>" +
          "<div class='nb-kpi-label' style='margin:6px 0 2px'>" + NBUi.esc(NBFormat.bulanPendek(b.bulan)) + "</div>" +
          "<div class='nb-cell-sub'>" + (b.tambah ? "+" + b.tambah : "") +
            (b.kurang ? " -" + b.kurang : "") + (!b.tambah && !b.kurang ? "-" : "") + "</div>" +
        "</div>";
      }).join("") + "</div>" +
      "<p class='nb-cell-sub' style='padding:0 20px 20px;margin:0'>" + NBUi.esc(T("kons.bulanKet")) + "</p>";
  }

  function render() {
    var c = NBStore.siklusAktif();
    if (!c) return "<div class='nb-card'>" + NBUi.kosong(T("dash.siklusKosong"), T("dash.siklusKosongSub")) + "</div>";
    var k = NBStore.konsolidasi(c.cycle_id);
    var bolehKunci = k.kelengkapan.ikut > 0 && c.status !== "CLOSED" &&
      k.perDept.some(function (d) { return d.status === "OD_ACCEPTED"; });

    var tabs = [["dept", "kons.tabDept"], ["action", "kons.tabAction"], ["bulan", "kons.tabBulan"]];
    if (k.perEntitas.length > 1) tabs.splice(1, 0, ["entitas", "kons.tabEntitas"]);
    var isiTab = state.tab === "dept" ? tabelDept(k)
               : (state.tab === "entitas" ? tabelEntitas(k)
               : (state.tab === "action" ? tabelAction(k) : tabelBulan(k)));

    var pengecualian = k.exceptions.length
      ? "<div class='nb-card nb-card-pad' style='margin-bottom:24px'>" +
        "<div class='nb-card-head'>" + NBUi.svg("shield") + "<div>" +
        "<h3>" + NBUi.esc(T("kons.exJudul", { n: k.exceptions.length })) + "</h3>" +
        "<p>" + NBUi.esc(T("kons.exSubJudul")) + "</p></div></div>" +
        k.exceptions.map(function (e) {
          return "<div class='nb-setting' style='margin-bottom:8px'>" +
            NBUi.badge(T("kons.jenis" + e.jenis), e.jenis === "MUTASI" ? "is-violet" : "is-amber") +
            "<div style='flex:1'>" + NBUi.esc(T(e.kunci, Object.assign({}, e.vars, {
              s: e.vars.s ? (T("plan.status" + e.vars.s) !== "plan.status" + e.vars.s
                    ? T("plan.status" + e.vars.s) : T("mutasi.st" + e.vars.s)) : "" }))) + "</div></div>";
        }).join("") + "</div>"
      : "";

    var riwayat = k.terkunci.length
      ? "<div class='nb-card' style='margin-top:24px'>" +
        "<div class='nb-toolbar'><div><div style='font-weight:600'>" +
        NBUi.esc(T("kons.riwayat")) + "</div><div class='nb-cell-sub'>" +
        NBUi.esc(T("kons.riwayatSub")) + "</div></div></div>" +
        "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
        "<th>" + NBUi.esc(T("kons.thVersi")) + "</th>" +
        "<th>" + NBUi.esc(T("snap.thDirilis")) + "</th>" +
        "<th class='nb-num'>" + NBUi.esc(T("umum.departemen")) + "</th>" +
        "<th class='nb-num'>" + NBUi.esc(T("review.thBaris")) + "</th>" +
        "<th class='nb-num'>" + NBUi.esc(T("kons.thProposed")) + "</th>" +
        "</tr></thead><tbody>" + k.terkunci.map(function (r) {
          var oleh = (NBStore.pengguna(r.locked_by) || {}).name || r.locked_by;
          return "<tr><td><span class='nb-code'>" + NBUi.esc(r.consolidation_id) + "</span></td>" +
            "<td>" + NBFormat.tanggalPendek(r.locked_at) +
              "<div class='nb-cell-sub'>" + NBUi.esc(oleh) + "</div></td>" +
            "<td class='nb-num'>" + NBFormat.angka(r.departemen) + "</td>" +
            "<td class='nb-num'>" + NBFormat.angka(r.baris) + "</td>" +
            "<td class='nb-num'>" + NBFormat.angka(r.proposed) + "</td></tr>";
        }).join("") + "</tbody></table></div></div>"
      : "";

    return "" +
    "<div class='nb-pagehead'><div>" +
      "<h1>" + NBUi.esc(T("kons.judul")) + "</h1>" +
      "<p>" + NBUi.esc(T("kons.sub", { name: c.name })) + "</p></div>" +
      (bolehKunci
        ? "<button class='nb-btn nb-btn-primary' id='kKunci'>" + NBUi.esc(T("kons.kunci")) + "</button>"
        : NBUi.badge(T("kons.belumSiap"), "is-amber")) +
    "</div>" +

    "<div class='nb-kpigrid'>" +
      NBUi.kpi(T("kons.kpiCurrent"), NBFormat.angka(k.total.current), "users", "",
               T("kons.kpiCurrentKet", { n: k.kelengkapan.departemen })) +
      NBUi.kpi(T("kons.kpiTambah"), NBFormat.delta(k.total.tambah), "chart", "is-emerald",
               T("kons.kpiTambahKet", { n: k.total.mutasi })) +
      NBUi.kpi(T("kons.kpiKurang"), NBFormat.delta(-k.total.kurang), "chart", "is-red", "") +
      NBUi.kpi(T("kons.kpiProposed"), NBFormat.angka(k.total.proposed), "layers", "is-blue",
               T("kons.kpiProposedKet", { a: k.kelengkapan.ikut, b: k.kelengkapan.departemen })) +
    "</div>" +

    pengecualian +

    "<div class='nb-card'>" +
      "<div class='nb-toolbar'><div class='nb-tabs'>" +
        tabs.map(function (t) {
          return "<button class='nb-tab" + (state.tab === t[0] ? " is-active" : "") +
                 "' data-tab='" + t[0] + "'>" + NBUi.esc(T(t[1])) + "</button>";
        }).join("") +
      "</div><div class='nb-cell-sub'>" + NBUi.esc(T("kons.barisIkut", { n: k.total.baris })) + "</div></div>" +
      isiTab +
    "</div>" + riwayat;
  }

  function mount() {
    document.querySelectorAll("button[data-tab]").forEach(function (b) {
      b.onclick = function () { state.tab = b.dataset.tab; NBApp.ulang(); };
    });

    var kunci = document.getElementById("kKunci");
    if (kunci) kunci.onclick = function () {
      var c = NBStore.siklusAktif();
      NBUi.konfirmasi({
        judul: T("kons.kunciJudul"), pesan: T("kons.kunciPesan"),
        ok: T("kons.kunci"), batal: T("umum.batal")
      }, function () {
        var res = NBStore.kunciKonsolidasi(c.cycle_id);
        NBUi.toast(res.ok ? T("kons.terkunci", { id: res.konsolidasi.consolidation_id })
                          : T(res.kunci, res.vars || {}), res.ok ? "ok" : "error");
        if (res.ok) NBApp.ulang();
      });
    };
  }

  global.NBPages = global.NBPages || {};
  global.NBPages.konsolidasi = { render: render, mount: mount };
})(window);
