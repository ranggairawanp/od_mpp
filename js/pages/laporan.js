// Layar Laporan (bab 30). Sembilan laporan, semuanya memakai fungsi yang sama dengan
// yang dipakai layar lain, sehingga angka di laporan tidak mungkin berbeda dari angka
// di aplikasi. Lingkup baris dan hak kolom biaya tetap berlaku.
(function (global) {
  "use strict";

  var T = function (k, v) { return NBi18n.t(k, v); };
  var state = { laporan: "R3" };

  // cap: kapabilitas minimal. biaya: laporan memuat nominal.
  var DAFTAR = [
    { kode: "R1", i18n: "lap.R1", biaya: false },
    { kode: "R2", i18n: "lap.R2", biaya: false },
    { kode: "R3", i18n: "lap.R3", biaya: false },
    { kode: "R4", i18n: "lap.R4", biaya: true },
    { kode: "R5", i18n: "lap.R5", biaya: true },
    { kode: "R6", i18n: "lap.R6", biaya: false },
    { kode: "R7", i18n: "lap.R7", biaya: false },
    { kode: "R8", i18n: "lap.R8", biaya: false },
    { kode: "R9", i18n: "lap.R9", biaya: false },
    { kode: "R10", i18n: "lap.R10", biaya: false }
  ];

  function bolehBiaya(u) {
    return NBStore.departemenTerlihat().every(function (d) { return NBRbac.canSeeCost(u, d.department_id); });
  }

  function tersedia(u) {
    return DAFTAR.filter(function (l) { return !l.biaya || bolehBiaya(u); });
  }

  // Daftar kunci uang ditulis eksplisit. Pencocokan pola sempat membuat kolom
  // cost_center_id ikut diformat sebagai rupiah, dan isinya hilang jadi tanda hubung.
  var KUNCI_UANG = ["biaya", "monthly", "annualized", "monthly_cost", "annualized_cost",
                    "biayaAlokasi", "biayaActual"];

  function nilaiSel(kunci, v) {
    if (v === null || v === undefined || v === "") return "<span class='nb-muted'>-</span>";
    if (KUNCI_UANG.indexOf(kunci) !== -1) return "<span class='nb-mono'>" + NBFormat.rupiah(v) + "</span>";
    if (kunci === "action_type") return NBUi.badge(NBi18n.t("act." + v), (NBActions.def(v) || {}).badge);
    if (kunci === "timestamp") return NBUi.esc(NBFormat.tanggalPendek(v) + " " + NBFormat.jam(v));
    if (typeof v === "number") return NBFormat.angka(v);
    return NBUi.esc(String(v));
  }

  // Kolom dianggap angka bila kuncinya memang berisi angka, bukan karena labelnya
  // kebetulan mengandung kata tertentu.
  var KUNCI_ANGKA = ["quantity", "effective_month", "hc", "requested", "approved", "variance",
                     "b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8", "b9", "b10", "b11", "b12", "total",
                     "approved_qty", "consumed_qty", "remaining_qty", "kuota", "terpakai", "sisa",
                     "utilisasi", "hcRealisasi", "kelebihan", "bulan", "baris"];
  function angka(k) {
    return KUNCI_ANGKA.indexOf(k.kunci) !== -1 || KUNCI_UANG.indexOf(k.kunci) !== -1;
  }

  function render() {
    var u = NBStore.user();
    var c = NBStore.siklusAktif();
    if (!c) return "<div class='nb-card'>" + NBUi.kosong(T("dash.siklusKosong"), T("dash.siklusKosongSub")) + "</div>";

    var daftar = tersedia(u);
    if (!daftar.some(function (l) { return l.kode === state.laporan; })) state.laporan = daftar[0].kode;
    var data = NBStore.dataLaporan(state.laporan, c.cycle_id);

    var isi = data.baris.length
      ? "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
        data.kolom.map(function (k) {
          return "<th" + (angka(k) ? " class='nb-num'" : "") + ">" + NBUi.esc(k.label) + "</th>";
        }).join("") + "</tr></thead><tbody>" +
        data.baris.slice(0, 100).map(function (b) {
          return "<tr>" + data.kolom.map(function (k) {
            return "<td" + (angka(k) ? " class='nb-num'" : "") + ">" +
                   nilaiSel(k.kunci, b[k.kunci]) + "</td>";
          }).join("") + "</tr>";
        }).join("") + "</tbody></table></div>" +
        (data.baris.length > 100
          ? "<p class='nb-cell-sub' style='padding:12px 20px;margin:0'>" +
            NBUi.esc(T("lap.potong", { n: data.baris.length })) + "</p>"
          : "")
      : NBUi.kosong(T("lap.kosong"), T("lap.kosongSub"), NBUi.svg("layers"));

    return "" +
    "<div class='nb-pagehead'><div>" +
      "<h1>" + NBUi.esc(T("lap.judul")) + "</h1>" +
      "<p>" + NBUi.esc(T("lap.sub", { name: c.name })) + "</p></div>" +
      (data.baris.length
        ? "<button class='nb-btn nb-btn-primary' id='lEkspor'>" + NBUi.esc(T("lap.ekspor")) + "</button>"
        : "") +
    "</div>" +

    "<div class='nb-card nb-card-pad' style='margin-bottom:24px;background:var(--nb-gray-50)'>" +
      "<div class='nb-note'>" + NBUi.svg("shield") + "<div>" +
      "<div style='font-weight:600'>" + NBUi.esc(T("lap.aturanJudul")) + "</div>" +
      "<div class='nb-cell-sub'>" + NBUi.esc(T("lap.aturanIsi")) + "</div></div></div></div>" +

    "<div class='nb-card'>" +
      "<div class='nb-toolbar'>" +
        "<select class='nb-select' id='lPilih' style='width:340px'>" + daftar.map(function (l) {
          return "<option value='" + l.kode + "'" + (l.kode === state.laporan ? " selected" : "") + ">" +
                 NBUi.esc(l.kode + ". " + T(l.i18n)) + "</option>";
        }).join("") + "</select>" +
        "<div class='nb-cell-sub'>" + NBUi.esc(T("lap.jumlah", { n: data.baris.length })) + "</div>" +
      "</div>" + isi +
    "</div>";
  }

  function mount() {
    var pilih = document.getElementById("lPilih");
    if (pilih) pilih.onchange = function () { state.laporan = this.value; NBApp.ulang(); };

    var ekspor = document.getElementById("lEkspor");
    if (ekspor) ekspor.onclick = function () {
      var c = NBStore.siklusAktif();
      var data = NBStore.dataLaporan(state.laporan, c.cycle_id);
      var nama = state.laporan + "-" + c.cycle_id + ".csv";
      var berhasil = NBReport.unduh(nama, NBReport.keCsv(data.kolom, data.baris));
      NBUi.toast(berhasil ? T("lap.terunduh", { n: nama }) : T("lap.gagalUnduh"),
                 berhasil ? "ok" : "error");
      NBAudit.tulis(NBStore.user(), "REPORT_EXPORT", "Report", state.laporan,
        { key: "audit.d.ekspor", vars: { id: state.laporan, n: data.baris.length } });
    };
  }

  global.NBPages = global.NBPages || {};
  global.NBPages.laporan = { render: render, mount: mount };
})(window);
