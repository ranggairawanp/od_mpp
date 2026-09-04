// Layar Bagan Organisasi (masukan Dzuhri nomor 3).
// Digambar dari kolom atasan langsung, bukan dari hierarki departemen. Satu kotak satu orang.
// Vacancy terbuka dan alokasi yang disetujui tetapi belum terisi digambar garis putus.
(function (global) {
  "use strict";

  var T = function (k, v) { return NBi18n.t(k, v); };
  var state = { akar: null, dibuka: {}, tampilkanMpp: true };

  // Akar awal mengikuti persona: manajer dan HOD mulai dari dirinya, peran lain memilih.
  function akarAwal(u, pohon) {
    // Lingkup pohon selalu mulai dari dirinya; pilihan akar dari sesi lain tidak boleh terbawa.
    if (u.scope && u.scope.type === "TREE") return u.scope.employee_id;
    if (state.akar && pohon.peta[state.akar]) return state.akar;
    return pohon.puncak[0] || null;
  }

  // Kotak tambahan per atasan: vacancy terbuka di posisi bawahannya, dan alokasi yang belum terisi.
  function tambahanMpp(pohon, c) {
    var peta = {};
    if (!state.tampilkanMpp) return peta;
    var karyawan = NBStore.karyawanTerlihat();
    // Atasan sebuah posisi: atasan dari orang yang sedang memegang posisi itu, atau HOD-nya.
    function atasanPosisi(positionId, departmentId) {
      var pemegang = karyawan.filter(function (e) { return e.position_id === positionId && e.direct_report_id; })[0];
      if (pemegang) return pemegang.direct_report_id;
      var hod = NBStore.hodDari(departmentId);
      return hod ? hod.employee_id : null;
    }
    NBStore.vacancyTerlihat().filter(function (v) { return v.status === "Open"; }).forEach(function (v) {
      var atas = atasanPosisi(v.position_id, v.department_id);
      if (!atas) return;
      (peta[atas] = peta[atas] || []).push({ jenis: "vacancy", judul: T("bagan.vacancy"),
        sub: v.position_title || v.position_id, grade: v.grade_id || "" });
    });
    if (c) {
      NBStore.alokasiTerlihat(c.cycle_id).forEach(function (a) {
        if (a.hc_impact <= 0 || a.remaining_qty <= 0) return;
        var atas = a.position_id ? atasanPosisi(a.position_id, a.department_id)
          : (NBStore.hodDari(a.department_id) || {}).employee_id;
        if (!atas) return;
        var judul = a.new_position_title || (NBStore.posisi(a.position_id) || {}).title || a.action_type;
        for (var i = 0; i < a.remaining_qty; i++) {
          (peta[atas] = peta[atas] || []).push({ jenis: "alokasi", judul: T("bagan.alokasi"),
            sub: judul, grade: a.grade_id || "" });
        }
      });
    }
    return peta;
  }

  function render() {
    var u = NBStore.user();
    var pohon = NBStore.pohonOrganisasi();
    var c = NBStore.siklusAktif();
    if (!pohon.puncak.length) {
      return "<div class='nb-pagehead'><div><h1>" + NBUi.esc(T("bagan.judul")) + "</h1></div></div>" +
        "<div class='nb-card'>" + NBUi.kosong(T("kosong.karyawan"), "", NBUi.svg("users")) + "</div>";
    }
    var akar = akarAwal(u, pohon);
    state.akar = akar;
    var batasDept = u.scope.type === "TREE" ? u.scope.department_id : null;

    var hasil = NBBagan.susun(akar, pohon, state.dibuka, {
      batasDept: batasDept,
      tambahan: tambahanMpp(pohon, c),
      bolehDilipat: function (e) { return NBOrganisasi.bolehDilipat(e, NBStore.levelGrade); },
      kedalamanAwal: 2,
      label: function (e) {
        var p = NBStore.posisi(e.position_id);
        return { judul: e.name, sub: p ? p.title : e.position_id, grade: e.grade_id + " \u00b7 " +
                 ((NBStore.departemen(e.department_id) || {}).name || "") };
      }
    });

    // Pemilih akar untuk peran berlingkup penuh: puncak tiap departemen.
    var pilihAkar = u.scope.type === "ALL"
      ? "<select class='nb-select' id='bgAkar' style='width:300px'>" + pohon.puncak.map(function (id) {
          var e = pohon.peta[id];
          return "<option value='" + id + "'" + (id === akar ? " selected" : "") + ">" +
            NBUi.esc(e.name + " \u00b7 " + ((NBStore.departemen(e.department_id) || {}).name || "")) + "</option>";
        }).join("") + "</select>"
      : NBUi.badge(T("bagan.pohonAnda"), "is-plain");

    var jumlahOrang = hasil.simpul.filter(function (n) { return n.jenis === "orang"; }).length;
    var jumlahVac = hasil.simpul.filter(function (n) { return n.jenis === "vacancy"; }).length;
    var jumlahAlok = hasil.simpul.filter(function (n) { return n.jenis === "alokasi"; }).length;

    return "" +
    "<div class='nb-pagehead'><div>" +
      "<h1>" + NBUi.esc(T("bagan.judul")) + "</h1>" +
      "<p>" + NBUi.esc(T("bagan.sub")) + "</p></div>" +
      "<div style='display:flex;gap:8px'>" +
        "<button class='nb-btn nb-btn-outline' id='bgLipat'>" + NBUi.esc(T("bagan.lipatSemua")) + "</button>" +
        "<button class='nb-btn nb-btn-primary' id='bgEkspor'>" + NBUi.esc(T("bagan.ekspor")) + "</button>" +
      "</div></div>" +

    "<div class='nb-card nb-card-pad' style='margin-bottom:24px;background:var(--nb-gray-50)'>" +
      "<div class='nb-note'>" + NBUi.svg("shield") + "<div>" +
      "<div style='font-weight:600'>" + NBUi.esc(T("bagan.aturanJudul")) + "</div>" +
      "<div class='nb-cell-sub'>" + NBUi.esc(T("bagan.aturanIsi")) + "</div></div></div></div>" +

    "<div class='nb-card'>" +
      "<div class='nb-toolbar'><div style='display:flex;gap:12px;align-items:center;flex-wrap:wrap'>" +
        pilihAkar +
        "<label class='nb-cell-sub' style='display:flex;gap:6px;align-items:center;cursor:pointer'>" +
          "<input type='checkbox' id='bgMpp'" + (state.tampilkanMpp ? " checked" : "") + "> " +
          NBUi.esc(T("bagan.tampilkanMpp")) + "</label>" +
      "</div><div class='nb-cell-sub'>" +
        NBUi.esc(T("bagan.ringkas", { o: jumlahOrang, v: jumlahVac, a: jumlahAlok })) +
        (hasil.terpotong ? " " + NBUi.badge(T("bagan.terpotong", { n: NBBagan.BATAS_KOTAK }), "is-amber") : "") +
      "</div></div>" +
      "<div class='nb-legenda' style='padding:0 20px 12px;display:flex;gap:16px;flex-wrap:wrap'>" +
        "<span class='nb-cell-sub'><span class='nb-legenda-kotak' style='border:1.5px solid #E8E9ED'></span>" + NBUi.esc(T("bagan.legOrang")) + "</span>" +
        "<span class='nb-cell-sub'><span class='nb-legenda-kotak' style='border:1.5px dashed #9EA3AE'></span>" + NBUi.esc(T("bagan.legVacancy")) + "</span>" +
        "<span class='nb-cell-sub'><span class='nb-legenda-kotak' style='border:1.5px dashed #3273F6;background:#F1F6FE'></span>" + NBUi.esc(T("bagan.legAlokasi")) + "</span>" +
        "<span class='nb-cell-sub'>" + NBUi.esc(T("bagan.legKlik")) + "</span>" +
      "</div>" +
      "<div class='nb-tablewrap' style='padding:8px 20px 20px;background:var(--nb-white)'>" + hasil.svg + "</div>" +
    "</div>";
  }

  function mount() {
    var akar = document.getElementById("bgAkar");
    if (akar) akar.onchange = function () { state.akar = this.value; state.dibuka = {}; NBApp.ulang(); };
    var mpp = document.getElementById("bgMpp");
    if (mpp) mpp.onchange = function () { state.tampilkanMpp = this.checked; NBApp.ulang(); };
    var lipat = document.getElementById("bgLipat");
    if (lipat) lipat.onclick = function () { state.dibuka = {}; NBApp.ulang(); };
    document.querySelectorAll(".nb-bagan-simpul[data-id]").forEach(function (g) {
      g.addEventListener("click", function () {
        var id = g.getAttribute("data-id");
        if (id.indexOf("|") !== -1) return;   // kotak vacancy atau alokasi tidak bisa dibuka
        state.dibuka[id] = !state.dibuka[id];
        NBApp.ulang();
      });
    });
    var ekspor = document.getElementById("bgEkspor");
    if (ekspor) ekspor.onclick = function () {
      var svg = document.querySelector("svg.nb-bagan");
      if (!svg) return;
      var nama = "bagan-organisasi-" + (state.akar || "semua") + ".svg";
      var ok = NBReport.unduh(nama, svg.outerHTML, "image/svg+xml");
      NBUi.toast(ok ? T("lap.terunduh", { n: nama }) : T("lap.gagalUnduh"), ok ? "ok" : "error");
    };
  }

  global.NBPages = global.NBPages || {};
  global.NBPages.bagan = { render: render, mount: mount };
})(window);
