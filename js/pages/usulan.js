// Layar Review Usulan (FR-04). Milik OD.
// Satu-satunya jalan mundur bagi usulan yang sudah dikirim adalah Returned, dan itu
// wajib menyertakan alasan. Aturan ini dijaga di store, bukan hanya di layar ini.
(function (global) {
  "use strict";

  var T = function (k, v) { return NBi18n.t(k, v); };
  var state = { buka: null };

  var STATUS = {
    DRAFT:       { i18n: "plan.statusDRAFT",       badge: "is-plain" },
    SUBMITTED:   { i18n: "plan.statusSUBMITTED",   badge: "is-blue" },
    RETURNED:    { i18n: "plan.statusRETURNED",    badge: "is-amber" },
    OD_ACCEPTED: { i18n: "plan.statusOD_ACCEPTED", badge: "is-emerald" }
  };

  function barisRingkas(s) {
    var d = NBStore.departemen(s.department_id);
    var st = STATUS[s.status] || { i18n: s.status, badge: "" };
    var r = s.ringkas;
    return "<tr class='" + (state.buka === s.submission_id ? "is-active" : "") +
      "' data-sub='" + s.submission_id + "' style='cursor:pointer'>" +
      "<td><div class='nb-cell-title'>" + NBUi.esc(d ? d.name : s.department_id) +
        (s.off_cycle ? " " + NBUi.badge(T("luar.badge"), "is-violet") : "") + "</div>" +
        "<div class='nb-cell-sub nb-mono'>" + NBUi.esc(s.submission_id) + " v" + s.version + "</div></td>" +
      "<td>" + NBUi.badge(T(st.i18n), st.badge) +
        (s.is_late ? " " + NBUi.badge(T("review.terlambat"), "is-red") : "") + "</td>" +
      "<td class='nb-num'>" + NBFormat.angka(r.baris) + "</td>" +
      "<td class='nb-num'>" + NBFormat.delta(r.netto) + "</td>" +
      "<td>" + (r.galat
          ? NBUi.badge(T("plan.errorN", { n: r.galat }), "is-red")
          : (r.peringatan ? NBUi.badge(T("plan.warnN", { n: r.peringatan }), "is-amber")
                          : NBUi.badge(T("plan.siap"), "is-emerald"))) +
        (r.mutasiMenunggu ? " " + NBUi.badge(T("review.mutasiMenunggu", { n: r.mutasiMenunggu }), "is-violet") : "") +
      "</td>" +
      "<td>" + (s.submitted_at ? NBFormat.tanggalPendek(s.submitted_at)
                               : "<span class='nb-muted'>-</span>") + "</td>" +
    "</tr>";
  }

  // Keputusan 4c dan 5c: OD menetapkan atasan baru di departemen tujuan sebelum konsolidasi.
  function kontrolAtasan(b) {
    var calon = NBStore.karyawanTerlihat({ department_id: b.target_department_id }).filter(function (e) {
      return NBStore.levelGrade(e.grade_id) >= NBOrganisasi.LEVEL_MANAJER;
    });
    var terkunci = b.status !== "SUBMITTED" && b.status !== "DRAFT";
    return "<div style='margin-top:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap'>" +
      "<span class='nb-cell-sub'>" + NBUi.esc(T("review.atasanTujuan")) + "</span>" +
      (terkunci
        ? NBUi.badge(b.target_manager_id ? ((NBStore.karyawan(b.target_manager_id) || {}).name || b.target_manager_id) : "-", "is-plain")
        : "<select class='nb-select' data-atasan-untuk='" + b.line_item_id + "' style='width:220px'>" +
          "<option value=''>-</option>" + calon.map(function (e) {
            return "<option value='" + e.employee_id + "'" + (e.employee_id === b.target_manager_id ? " selected" : "") + ">" +
              NBUi.esc(e.name + " (" + e.grade_id + ")") + "</option>";
          }).join("") + "</select>" +
          "<button class='nb-btn nb-btn-outline' data-tetapkan='" + b.line_item_id + "'>" + NBUi.esc(T("review.tetapkan")) + "</button>") +
      (!b.target_manager_id ? " " + NBUi.badge("W05c", "is-amber") : "") +
    "</div>";
  }

  function detail() {
    if (!state.buka) return "";
    var sub = NBStore.daftarSubmission(NBStore.siklusAktif().cycle_id).filter(function (s) {
      return s.submission_id === state.buka;
    })[0];
    if (!sub) return "";
    var baris = NBStore.barisSubmission(sub.submission_id);
    var d = NBStore.departemen(sub.department_id);

    var isi = baris.map(function (b) {
      var dampak = NBActions.dampakHc(b);
      var h = NBStore.periksaBaris(b);
      return "<tr><td><span class='nb-code'>" + NBUi.esc(b.line_item_id) + "</span></td>" +
        "<td>" + NBUi.badge(T("act." + b.action_type), (NBActions.def(b.action_type) || {}).badge) + "</td>" +
        "<td><div class='nb-cell-title'>" + NBUi.esc(namaSasaran(b)) + "</div>" +
          "<div class='nb-cell-sub'>" + NBUi.esc(b.justification || "") + "</div>" +
          (b.action_type === "TRANSFER" && b.target_department_id ? kontrolAtasan(b) : "") + "</td>" +
        "<td>" + (b.effective_month ? NBUi.esc(NBFormat.bulanPendek(b.effective_month)) : "-") + "</td>" +
        "<td class='nb-num'>" + (dampak.perusahaan === 0 ? "0" : "<b>" + NBFormat.delta(dampak.perusahaan) + "</b>") + "</td>" +
        "<td>" + (h.errors.length ? NBUi.badge(T("plan.errorN", { n: h.errors.length }), "is-red")
                 : (b.transfer_status ? NBUi.badge(T("mutasi.st" + b.transfer_status), "is-violet")
                                      : NBUi.badge(T("plan.siap"), "is-emerald"))) + "</td></tr>";
    }).join("");

    var aksi = sub.status === "SUBMITTED"
      ? "<button class='nb-btn nb-btn-soft-danger' id='rKembali'>" + NBUi.esc(T("review.kembalikan")) + "</button>" +
        "<button class='nb-btn nb-btn-primary' id='rTerima'>" + NBUi.esc(T("review.terima")) + "</button>"
      : "<span class='nb-cell-sub'>" + NBUi.esc(T("review.tidakBisa", { s: T((STATUS[sub.status] || {}).i18n || sub.status) })) + "</span>";

    return "<div class='nb-card' style='margin-top:24px'>" +
      "<div class='nb-toolbar'><div>" +
        "<div style='font-weight:600'>" + NBUi.esc(T("review.detailJudul", { d: d ? d.name : "" })) + "</div>" +
        "<div class='nb-cell-sub'>" + NBUi.esc(sub.review_note
            ? T("review.catatanTerakhir", { c: sub.review_note })
            : T("review.detailSub")) + "</div>" +
      "</div><div style='display:flex;gap:8px'>" + aksi + "</div></div>" +
      "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
        "<th>" + NBUi.esc(T("plan.thId")) + "</th>" +
        "<th>" + NBUi.esc(T("plan.thAction")) + "</th>" +
        "<th>" + NBUi.esc(T("plan.thSasaran")) + "</th>" +
        "<th>" + NBUi.esc(T("plan.thBulan")) + "</th>" +
        "<th class='nb-num'>" + NBUi.esc(T("plan.thHc")) + "</th>" +
        "<th>" + NBUi.esc(T("plan.thValidasi")) + "</th>" +
      "</tr></thead><tbody>" + isi + "</tbody></table></div></div>";
  }

  function namaSasaran(b) {
    if (b.employee_id) return (NBStore.karyawan(b.employee_id) || {}).name || b.employee_id;
    if (b.new_position_title) return b.new_position_title;
    if (b.position_id) return (NBStore.posisi(b.position_id) || {}).title || b.position_id;
    if (b.vacancy_id) return b.vacancy_id;
    return "-";
  }

  function render() {
    var c = NBStore.siklusAktif();
    if (!c) return "<div class='nb-card'>" + NBUi.kosong(T("dash.siklusKosong"), T("dash.siklusKosongSub")) + "</div>";
    var daftar = NBStore.daftarSubmission(c.cycle_id);
    var deps = NBStore.departemenTerlihat();

    var dikirim = daftar.filter(function (s) { return s.status === "SUBMITTED"; }).length;
    var diterima = daftar.filter(function (s) { return s.status === "OD_ACCEPTED"; }).length;
    var dikembalikan = daftar.filter(function (s) { return s.status === "RETURNED"; }).length;
    var belum = deps.length - daftar.filter(function (s) { return s.status !== "DRAFT"; }).length;

    var isi = daftar.length
      ? "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
        "<th>" + NBUi.esc(T("umum.departemen")) + "</th>" +
        "<th>" + NBUi.esc(T("umum.status")) + "</th>" +
        "<th class='nb-num'>" + NBUi.esc(T("review.thBaris")) + "</th>" +
        "<th class='nb-num'>" + NBUi.esc(T("review.thNetto")) + "</th>" +
        "<th>" + NBUi.esc(T("plan.thValidasi")) + "</th>" +
        "<th>" + NBUi.esc(T("review.thDikirim")) + "</th>" +
        "</tr></thead><tbody>" + daftar.map(barisRingkas).join("") + "</tbody></table></div>"
      : NBUi.kosong(T("review.kosong"), T("review.kosongSub"), NBUi.svg("layers"));

    return "" +
    "<div class='nb-pagehead'><div>" +
      "<h1>" + NBUi.esc(T("review.judul")) + "</h1>" +
      "<p>" + NBUi.esc(T("review.sub", { name: c.name })) + "</p></div>" +
      NBUi.badge(c.name, "is-plain") + "</div>" +

    "<div class='nb-kpigrid'>" +
      NBUi.kpi(T("review.kpiMenunggu"), NBFormat.angka(dikirim), "layers", "is-blue", T("review.kpiMenungguKet")) +
      NBUi.kpi(T("review.kpiDiterima"), NBFormat.angka(diterima), "check", "is-emerald", "") +
      NBUi.kpi(T("review.kpiDikembalikan"), NBFormat.angka(dikembalikan), "chart", "is-amber", "") +
      NBUi.kpi(T("review.kpiBelum"), NBFormat.angka(belum < 0 ? 0 : belum), "building", "", T("review.kpiBelumKet")) +
    "</div>" +

    "<div class='nb-card'>" +
      "<div class='nb-toolbar'><div><div style='font-weight:600'>" + NBUi.esc(T("review.daftar")) + "</div>" +
      "<div class='nb-cell-sub'>" + NBUi.esc(T("review.daftarSub")) + "</div></div></div>" + isi +
    "</div>" + detail();
  }

  function mount() {
    document.querySelectorAll("tr[data-sub]").forEach(function (tr) {
      tr.onclick = function () { state.buka = tr.dataset.sub; NBApp.ulang(); };
    });

    document.querySelectorAll("button[data-tetapkan]").forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.dataset.tetapkan;
        var sel = document.querySelector("select[data-atasan-untuk='" + id + "']");
        var res = NBStore.tetapkanAtasanMutasi(id, sel ? sel.value : "");
        NBUi.toast(res.ok ? T("review.atasanDitetapkan") : T(res.kunci, res.vars || {}), res.ok ? "ok" : "error");
        if (res.ok) NBApp.ulang();
      };
    });
    var terima = document.getElementById("rTerima");
    if (terima) terima.onclick = function () {
      NBUi.konfirmasi({
        judul: T("review.terimaJudul"), pesan: T("review.terimaPesan"),
        ok: T("review.terima"), batal: T("umum.batal")
      }, function () {
        var res = NBStore.reviewSubmission(state.buka, "ACCEPT", null);
        NBUi.toast(res.ok ? T("review.diterima") : T(res.kunci, res.vars || {}), res.ok ? "ok" : "error");
        if (res.ok) NBApp.ulang();
      });
    };

    var kembali = document.getElementById("rKembali");
    if (kembali) kembali.onclick = function () {
      NBUi.konfirmasi({
        judul: T("review.kembalikanJudul"), pesan: T("review.kembalikanPesan"),
        perluAlasan: true, labelAlasan: T("review.alasanLabel"),
        placeholder: T("review.alasanPlaceholder"), pesanAlasan: T("review.errAlasan"),
        ok: T("review.kembalikan"), batal: T("umum.batal"), gaya: "nb-btn-soft-danger"
      }, function (alasan) {
        var res = NBStore.reviewSubmission(state.buka, "RETURN", alasan);
        NBUi.toast(res.ok ? T("review.dikembalikan") : T(res.kunci, res.vars || {}), res.ok ? "ok" : "error");
        if (res.ok) NBApp.ulang();
      });
    };
  }

  global.NBPages = global.NBPages || {};
  global.NBPages.usulan = { render: render, mount: mount };
})(window);
