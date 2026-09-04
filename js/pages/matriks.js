// Layar Matriks Jan sampai Des. Bentuk baku lembar MPP bulanan.
//
// Tiga pita baris per unit: Budget, Actual, Selisih, dikali dua belas kolom bulan.
// Angka bulanan adalah posisi akhir bulan, bukan penambahan pada bulan itu, sehingga
// bisa dibandingkan langsung dengan headcount payroll bulan berjalan.
(function (global) {
  "use strict";

  var T = function (k, v) { return NBi18n.t(k, v); };
  var state = { mode: "HC", level: "DEPT" };

  function nilai(v, mode) {
    if (mode === "RP") return NBFormat.rupiahRingkas(v);
    return NBFormat.angka(v);
  }

  function selSelisih(v, mode) {
    if (v === 0) return "<span class='nb-muted'>0</span>";
    var warna = v < 0 ? "var(--nb-red-700)" : "var(--nb-emerald-fg)";
    return "<span style='color:" + warna + ";font-weight:600'>" +
           (v > 0 ? "+" : "") + nilai(v, mode) + "</span>";
  }

  function pita(b, kunciPita, label, mode, gaya) {
    var sel = "";
    for (var m = 0; m < 12; m++) {
      sel += "<td class='nb-num nb-mono'>" +
        (kunciPita === "selisih" ? selSelisih(b.selisih[m], mode) : nilai(b[kunciPita][m], mode)) +
        "</td>";
    }
    return "<tr" + (gaya || "") + ">" +
      "<td class='nb-matriks-label'>" + NBUi.esc(label) + "</td>" + sel +
      "<td class='nb-num nb-mono'><b>" +
        (kunciPita === "selisih" ? selSelisih(b.selisih[11], mode) : nilai(b[kunciPita][11], mode)) +
      "</b></td></tr>";
  }

  function tabel(mx) {
    if (!mx.baris.length) {
      return NBUi.kosong(T("mx.kosong"), T("mx.kosongSub"), NBUi.svg("layers"));
    }
    var kepala = "<tr><th class='nb-matriks-label'>" + NBUi.esc(T("mx.thUnit")) + "</th>";
    for (var m = 1; m <= 12; m++) {
      kepala += "<th class='nb-num'>" + NBUi.esc(NBFormat.bulanPendek(m)) + "</th>";
    }
    kepala += "<th class='nb-num'>" + NBUi.esc(T("mx.thDesember")) + "</th></tr>";

    var isi = mx.baris.map(function (b) {
      var judul = "<tr class='is-active'><td class='nb-matriks-label' colspan='14'>" +
        "<div class='nb-cell-title'>" + NBUi.esc(b.jabatan || b.departemen) + "</div>" +
        "<div class='nb-cell-sub'>" + NBUi.esc(
          (b.jabatan ? b.departemen + " &middot; " : "") + b.divisi + " &middot; " +
          b.entitas + " &middot; " + b.negara + " &middot; " + b.cost_center_id
        ).replace(/&amp;middot;/g, "&middot;") + "</div></td></tr>";
      return judul +
        pita(b, "budget", T("mx.budget"), mx.mode) +
        pita(b, "actual", T("mx.actual"), mx.mode) +
        pita(b, "selisih", T("mx.selisih"), mx.mode);
    }).join("");

    var total = "<tr class='is-active'><td class='nb-matriks-label' colspan='14'>" +
      "<div class='nb-cell-title'>" + NBUi.esc(T("kons.totalPerusahaan")) + "</div></td></tr>" +
      pita(mx.total, "budget", T("mx.budget"), mx.mode, " style='font-weight:600'") +
      pita(mx.total, "actual", T("mx.actual"), mx.mode, " style='font-weight:600'") +
      pita(mx.total, "selisih", T("mx.selisih"), mx.mode, " style='font-weight:600'");

    return "<div class='nb-tablewrap'><table class='nb-table nb-matriks'>" +
      "<thead>" + kepala + "</thead><tbody>" + isi + total + "</tbody></table></div>";
  }

  function render() {
    var u = NBStore.user();
    var c = NBStore.siklusAktif();
    if (!c) return "<div class='nb-card'>" + NBUi.kosong(T("dash.siklusKosong"), T("dash.siklusKosongSub")) + "</div>";

    var deps = NBStore.departemenTerlihat();
    var bolehBiaya = deps.every(function (d) { return NBRbac.canSeeCost(u, d.department_id); });
    if (!bolehBiaya && state.mode === "RP") state.mode = "HC";

    var mx = NBStore.matriksBulanan(c.cycle_id, state);

    var tombolMode = bolehBiaya
      ? "<div class='nb-tabs'>" +
        [["HC", "mx.modeHc"], ["RP", "mx.modeRp"]].map(function (t) {
          return "<button class='nb-tab" + (state.mode === t[0] ? " is-active" : "") +
                 "' data-mode='" + t[0] + "'>" + NBUi.esc(T(t[1])) + "</button>";
        }).join("") + "</div>"
      : NBUi.badge(T("mx.modeHc"), "is-plain");

    var tombolLevel = "<div class='nb-tabs'>" +
      [["DEPT", "mx.levelDept"], ["POSISI", "mx.levelPosisi"]].map(function (t) {
        return "<button class='nb-tab" + (state.level === t[0] ? " is-active" : "") +
               "' data-level='" + t[0] + "'>" + NBUi.esc(T(t[1])) + "</button>";
      }).join("") + "</div>";

    return "" +
    "<div class='nb-pagehead'><div>" +
      "<h1>" + NBUi.esc(T("mx.judul")) + "</h1>" +
      "<p>" + NBUi.esc(T("mx.sub", { name: c.name })) + "</p></div>" +
      "<button class='nb-btn nb-btn-primary' id='mxEkspor'>" + NBUi.esc(T("lap.ekspor")) + "</button>" +
    "</div>" +

    "<div class='nb-card nb-card-pad' style='margin-bottom:24px;background:var(--nb-gray-50)'>" +
      "<div class='nb-note'>" + NBUi.svg("shield") + "<div>" +
      "<div style='font-weight:600'>" + NBUi.esc(T("mx.aturanJudul")) + "</div>" +
      "<div class='nb-cell-sub'>" + NBUi.esc(T("mx.aturanIsi")) + "</div></div></div></div>" +

    (mx.lintasMataUang && mx.mode === "RP"
      ? "<div class='nb-card nb-card-pad' style='margin-bottom:24px;background:var(--nb-gray-50)'>" +
        NBUi.esc(T("mx.lintasMataUang")) + "</div>" : "") +
    (mx.punyaSnapshot ? "" :
      "<div class='nb-card nb-card-pad' style='margin-bottom:24px;border-color:var(--nb-amber-bd);" +
      "background:var(--nb-amber-bg)'><b>" + NBUi.esc(T("mx.tanpaSnapshot")) + "</b> " +
      NBUi.esc(T("mx.tanpaSnapshotSub")) + "</div>") +

    "<div class='nb-card'>" +
      "<div class='nb-toolbar'>" +
        "<div style='display:flex;gap:16px;align-items:center;flex-wrap:wrap'>" +
          tombolMode + tombolLevel + "</div>" +
        "<div class='nb-cell-sub'>" + NBUi.esc(T("mx.dasar")) + "</div>" +
      "</div>" + tabel(mx) +
    "</div>";
  }

  function mount() {
    document.querySelectorAll("button[data-mode]").forEach(function (b) {
      b.onclick = function () { state.mode = b.dataset.mode; NBApp.ulang(); };
    });
    document.querySelectorAll("button[data-level]").forEach(function (b) {
      b.onclick = function () { state.level = b.dataset.level; NBApp.ulang(); };
    });
    var ek = document.getElementById("mxEkspor");
    if (ek) ek.onclick = function () {
      var c = NBStore.siklusAktif();
      var data = NBStore.dataLaporan("R10", c.cycle_id);
      var nama = "matriks-bulanan-" + c.cycle_id + ".csv";
      var ok = NBReport.unduh(nama, NBReport.keCsv(data.kolom, data.baris));
      NBUi.toast(ok ? T("lap.terunduh", { n: nama }) : T("lap.gagalUnduh"), ok ? "ok" : "error");
      NBAudit.tulis(NBStore.user(), "REPORT_EXPORT", "Report", "R10",
        { key: "audit.d.ekspor", vars: { id: "R10", n: data.baris.length } });
    };
  }

  global.NBPages = global.NBPages || {};
  global.NBPages.matriks = { render: render, mount: mount };
})(window);
