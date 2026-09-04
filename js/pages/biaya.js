// Layar Perhitungan Biaya (FR-06).
// Dua tab: asumsi biaya yang berlaku, dan hasil perhitungan atas usulan yang sudah
// dikonsolidasikan. Tidak ada satu pun angka rupiah yang dihitung di berkas ini.
(function (global) {
  "use strict";

  var T = function (k, v) { return NBi18n.t(k, v); };
  var state = { tab: "hasil", grade: null };

  function tabelAsumsi(c) {
    var ctx = NBStore.konteksBiaya(c.cycle_id);
    var grades = NBStore.semuaGrade();
    var gradeAktif = state.grade || grades[Math.min(6, grades.length - 1)].grade_id;

    var rincian = NBStore.biayaGrade(gradeAktif, c.cycle_id);
    var kelompok = [
      ["biaya.grupUtama", NBCosting.UTAMA],
      ["biaya.grupRincian", NBCosting.RINCIAN]
    ];

    var pilih = "<select class='nb-select' id='bGrade' style='width:260px'>" +
      grades.map(function (g) {
        return "<option value='" + g.grade_id + "'" + (g.grade_id === gradeAktif ? " selected" : "") +
               ">" + NBUi.esc(g.grade_id + " " + g.label) + "</option>";
      }).join("") + "</select>";

    var isi = rincian
      ? kelompok.map(function (kel) {
          // Rincian sengaja tidak dijumlahkan: hanya lima angka utama yang menjadi biaya.
          var sub = kel[0] === "biaya.grupUtama"
            ? kel[1].reduce(function (a, k) { return a + (rincian.komponen[k] || 0); }, 0) : null;
          return "<tr class='is-active'><td colspan='2'><b>" + NBUi.esc(T(kel[0])) + "</b></td>" +
              "<td class='nb-num'><b>" + (sub === null ? "<span class='nb-muted'>" +
                NBUi.esc(T("biaya.rincianKet")) + "</span>" : NBFormat.rupiah(sub)) + "</b></td></tr>" +
            kel[1].map(function (k) {
              return "<tr><td colspan='2' style='padding-left:32px'>" + NBUi.esc(T("komp." + k)) + "</td>" +
                "<td class='nb-num nb-mono'>" + NBFormat.rupiah(rincian.komponen[k] || 0) + "</td></tr>";
            }).join("");
        }).join("") +
        "<tr><td colspan='2'><b>" + NBUi.esc(T("biaya.totalBulanan")) + "</b></td>" +
        "<td class='nb-num'><b>" + NBFormat.rupiah(rincian.total) + "</b></td></tr>"
      : "<tr><td colspan='3'>" + NBUi.kosong(T("biaya.tanpaAsumsi"), "") + "</td></tr>";

    return "<div class='nb-toolbar'><div style='display:flex;gap:12px;align-items:center'>" + pilih +
      NBUi.badge(T("biaya.paket", { id: ctx.assumption_id || "-",
                                    t: NBFormat.tanggal(ctx.tanggal) }), "is-plain") +
      "</div></div>" +
      "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
      "<th colspan='2'>" + NBUi.esc(T("biaya.thKomponen")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("biaya.thPerBulan")) + "</th>" +
      "</tr></thead><tbody>" + isi + "</tbody></table></div>" +
      "<div style='padding:20px'>" +
      "<p class='nb-cell-sub'>" + NBUi.esc(T("biaya.catatanUtama")) + "</p>" +
      "<p class='nb-cell-sub'>" + NBUi.esc(T("biaya.catatanPph")) + "</p>" +
      "</div>";
  }

  function tabelHasil(c, h) {
    if (!h || !h.baris) {
      return NBUi.kosong(T("biaya.kosong"), T("biaya.kosongSub"), NBUi.svg("layers"));
    }
    return "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
      "<th>" + NBUi.esc(T("plan.thId")) + "</th>" +
      "<th>" + NBUi.esc(T("plan.thAction")) + "</th>" +
      "<th>" + NBUi.esc(T("umum.departemen")) + "</th>" +
      "<th>" + NBUi.esc(T("plan.thBulan")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("biaya.thBulanBerlaku")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("biaya.thPerBulan")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("biaya.thTahunan")) + "</th>" +
      "</tr></thead><tbody>" +
      h.rincian.map(function (r) {
        var b = r.baris, x = r.biaya;
        var d = NBStore.departemen(b.department_id);
        return "<tr><td><span class='nb-code'>" + NBUi.esc(b.line_item_id) + "</span></td>" +
          "<td>" + NBUi.badge(T("act." + b.action_type), (NBActions.def(b.action_type) || {}).badge) +
            (x.jenis === "delta" ? "<div class='nb-cell-sub'>" + NBUi.esc(T("biaya.selisihGrade",
              { a: x.grade_asal, b: x.grade_tujuan })) + "</div>" : "") + "</td>" +
          "<td>" + NBUi.esc(d ? d.name : b.department_id) + "</td>" +
          "<td>" + (b.effective_month ? NBUi.esc(NBFormat.bulanPendek(b.effective_month)) : "-") + "</td>" +
          "<td class='nb-num'>" + (x.applicable_months || "<span class='nb-muted'>0</span>") + "</td>" +
          "<td class='nb-num nb-mono'>" + (x.monthly_cost ? NBFormat.uang(x.monthly_cost, x.mata_uang)
                                        : "<span class='nb-muted'>-</span>") + "</td>" +
          "<td class='nb-num nb-mono'>" + (x.annualized_cost ? NBFormat.uang(x.annualized_cost, x.mata_uang) +
                                          (x.mata_uang && x.mata_uang !== "IDR" && x.annualized_idr !== null
                                            ? "<div class='nb-cell-sub'>" + NBFormat.rupiah(x.annualized_idr) + "</div>" : "")
                                        : "<span class='nb-muted'>-</span>") + "</td></tr>";
      }).join("") +
      "<tr><td colspan='5'><b>" + NBUi.esc(T("kons.totalPerusahaan")) + "</b></td>" +
      "<td class='nb-num'><b>" + NBFormat.rupiah(h.total.monthly) + "</b></td>" +
      "<td class='nb-num'><b>" + NBFormat.rupiah(h.total.annualized) + "</b></td></tr>" +
      "</tbody></table></div>";
  }

  function tabelDept(h) {
    if (!h || !h.perDept.length) return NBUi.kosong(T("biaya.kosong"), T("biaya.kosongSub"));
    return "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
      "<th>" + NBUi.esc(T("umum.departemen")) + "</th>" +
      "<th>" + NBUi.esc(T("dash.thCostCenter")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("review.thBaris")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("biaya.thPerBulan")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("biaya.thTahunan")) + "</th>" +
      "</tr></thead><tbody>" + h.perDept.map(function (d) {
        return "<tr><td>" + NBUi.esc(d.name) +
            (d.mata_uang && d.mata_uang !== "IDR"
              ? "<div class='nb-cell-sub'>" + NBUi.esc(d.mata_uang + (d.kurs ? " \u00d7 " + NBFormat.angka(d.kurs) : "")) + "</div>" : "") +
          "</td>" +
          "<td class='nb-mono'>" + NBUi.esc(d.cost_center_id) + "</td>" +
          "<td class='nb-num'>" + d.baris + "</td>" +
          "<td class='nb-num nb-mono'>" + NBFormat.uang(d.monthly, d.mata_uang) + "</td>" +
          "<td class='nb-num nb-mono'>" + NBFormat.uang(d.annualized, d.mata_uang) +
            (d.mata_uang && d.mata_uang !== "IDR" && d.annualized_idr
              ? "<div class='nb-cell-sub'>" + NBFormat.rupiah(d.annualized_idr) + "</div>" : "") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  function kurvaBulan(h) {
    if (!h) return "";
    var maks = h.perBulan.reduce(function (m, b) { return Math.max(m, b.biaya); }, 1);
    return "<div style='padding:4px 20px 20px;display:grid;grid-template-columns:repeat(12,1fr);" +
      "gap:6px;align-items:end'>" + h.perBulan.map(function (b) {
        var t = Math.max(2, Math.round(b.biaya / maks * 80));
        return "<div style='text-align:center'>" +
          "<div style='height:84px;display:flex;align-items:flex-end'>" +
          "<div style='width:100%;height:" + t + "px;background:var(--nb-blue-bd);border-radius:4px 4px 0 0'></div>" +
          "</div><div class='nb-kpi-label' style='margin:6px 0 2px'>" +
          NBUi.esc(NBFormat.bulanPendek(b.bulan)) + "</div>" +
          "<div class='nb-cell-sub'>" + (b.biaya ? NBFormat.rupiahRingkas(b.biaya) : "-") + "</div></div>";
      }).join("") + "</div>" +
      "<p class='nb-cell-sub' style='padding:0 20px 20px;margin:0'>" + NBUi.esc(T("biaya.kurvaKet")) + "</p>";
  }

  function render() {
    var u = NBStore.user();
    var c = NBStore.siklusAktif();
    if (!c) return "<div class='nb-card'>" + NBUi.kosong(T("dash.siklusKosong"), T("dash.siklusKosongSub")) + "</div>";
    var h = NBStore.biayaSiklus(c.cycle_id);
    var selisih = h ? h.tanpaProrata - h.total.annualized : 0;

    var tabs = [["hasil", "biaya.tabHasil"], ["dept", "biaya.tabDept"],
                ["bulan", "biaya.tabBulan"], ["asumsi", "biaya.tabAsumsi"]];
    var isi = state.tab === "asumsi" ? tabelAsumsi(c)
            : (state.tab === "dept" ? tabelDept(h)
            : (state.tab === "bulan" ? kurvaBulan(h) : tabelHasil(c, h)));

    return "" +
    "<div class='nb-pagehead'><div>" +
      "<h1>" + NBUi.esc(T("biaya.judul")) + "</h1>" +
      "<p>" + NBUi.esc(T("biaya.sub", { name: c.name })) + "</p></div>" +
      NBUi.badge(T("biaya.paket", { id: h ? h.assumption_id : "-",
                                    t: NBFormat.tanggal(h ? h.tanggal : c.start_date) }), "is-plain") +
    "</div>" +

    (h && h.total.tanpaKurs && h.total.tanpaKurs.length
      ? "<div class='nb-card nb-card-pad' style='margin-bottom:24px;border-color:var(--nb-amber-bd);" +
        "background:var(--nb-amber-bg)'>" + NBUi.esc(T("biaya.tanpaKurs", { n: h.total.tanpaKurs.join(", ") })) + "</div>"
      : "") +
    "<div class='nb-kpigrid'>" +
      NBUi.kpi(T("biaya.kpiTahunan"), h ? NBFormat.rupiahRingkas(h.total.annualized) : "-",
               "chart", "is-blue", T("biaya.kpiTahunanKet", { n: h ? h.baris : 0 }), true) +
      NBUi.kpi(T("biaya.kpiBulanan"), h ? NBFormat.rupiahRingkas(h.total.monthly) : "-",
               "chart", "", T("biaya.kpiBulananKet"), true) +
      NBUi.kpi(T("biaya.kpiTanpaProrata"), h ? NBFormat.rupiahRingkas(h.tanpaProrata) : "-",
               "shield", "is-amber", T("biaya.kpiTanpaProrataKet"), true) +
      NBUi.kpi(T("biaya.kpiSelisih"), h ? NBFormat.rupiahRingkas(selisih) : "-",
               "check", "is-emerald", T("biaya.kpiSelisihKet"), true) +
    "</div>" +

    "<div class='nb-card'>" +
      "<div class='nb-toolbar'><div class='nb-tabs'>" + tabs.map(function (t) {
        return "<button class='nb-tab" + (state.tab === t[0] ? " is-active" : "") +
               "' data-tab='" + t[0] + "'>" + NBUi.esc(T(t[1])) + "</button>";
      }).join("") + "</div>" +
      "<div class='nb-cell-sub'>" + NBUi.esc(T("biaya.dasar")) + "</div></div>" +
      isi +
    "</div>";
  }

  function mount() {
    document.querySelectorAll("button[data-tab]").forEach(function (b) {
      b.onclick = function () { state.tab = b.dataset.tab; NBApp.ulang(); };
    });
    var g = document.getElementById("bGrade");
    if (g) g.onchange = function () { state.grade = this.value; NBApp.ulang(); };
  }

  global.NBPages = global.NBPages || {};
  global.NBPages.biaya = { render: render, mount: mount };
})(window);
