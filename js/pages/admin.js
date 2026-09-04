// Layar Administrasi (bab 64 dan 65). Milik OD.
// Isinya sengaja hanya membaca dan satu aksi berat, yaitu penutupan siklus, karena
// perubahan master data yang sesungguhnya seharusnya berasal dari HRIS, bukan diketik di sini.
(function (global) {
  "use strict";

  var T = function (k, v) { return NBi18n.t(k, v); };
  var state = { tab: "pengguna" };

  function tabelPengguna() {
    return "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
      "<th>" + NBUi.esc(T("adm.thPengguna")) + "</th>" +
      "<th>" + NBUi.esc(T("umum.peranLabel")) + "</th>" +
      "<th>" + NBUi.esc(T("adm.thLingkup")) + "</th>" +
      "<th>" + NBUi.esc(T("adm.thBiaya")) + "</th>" +
      "</tr></thead><tbody>" + NBStore.semuaPengguna().map(function (u) {
        var deps = NBRbac.scopeDepartments(u, NBStore.semuaDepartemen());
        var lihatBiaya = deps.some(function (id) { return NBRbac.canSeeCost(u, id); });
        return "<tr><td><div class='nb-cell-person'>" +
            "<span class='nb-avatar nb-avatar-sm nb-avatar-soft'>" + NBUi.esc(u.name.charAt(0)) + "</span>" +
            "<div><div class='nb-cell-title'>" + NBUi.esc(u.name) + "</div>" +
            "<div class='nb-cell-sub nb-mono'>" + NBUi.esc(u.email) + "</div></div></div></td>" +
          "<td>" + NBUi.badge(NBRbac.roleLabel(u.role), "is-plain") +
            "<div class='nb-cell-sub'>" + NBUi.esc(u.title) + "</div></td>" +
          "<td>" + NBUi.esc(u.scope.type === "ALL"
              ? T("umum.nDept", { n: deps.length })
              : deps.map(function (id) { return (NBStore.departemen(id) || {}).name; }).join(", ")) + "</td>" +
          "<td>" + (lihatBiaya ? NBUi.badge(T("adm.biayaYa"), "is-emerald")
                               : NBUi.badge(T("adm.biayaTidak"), "is-plain")) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  function tabelParameter(c) {
    var ctx = NBStore.konteksBiaya(c.cycle_id);
    var paket = NBStore.semuaAsumsi();
    if (!paket.length) return NBUi.kosong(T("biaya.tanpaAsumsi"), T("kosong.asumsi"), NBUi.svg("layers"));
    return "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
      "<th>" + NBUi.esc(T("adm.thParameter")) + "</th><th>" + NBUi.esc(T("snap.thDirilis")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("umum.status")) + "</th></tr></thead><tbody>" +
      paket.map(function (a) {
        return "<tr><td><span class='nb-code'>" + NBUi.esc(a.assumption_id) + "</span>" +
          "<div class='nb-cell-sub'>" + NBUi.esc(a.note || "") + "</div></td>" +
          "<td>" + NBUi.esc(NBFormat.tanggal(a.effective_date)) + "</td>" +
          "<td class='nb-num'>" + (a.assumption_id === ctx.assumption_id
            ? NBUi.badge(T("adm.berlaku"), "is-emerald") : "<span class='nb-muted'>-</span>") + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      "<p class='nb-cell-sub' style='padding:16px 20px;margin:0'>" + NBUi.esc(T("adm.paramKet")) + "</p>";
  }

  function tabelPenutupan(c) {
    var j = NBStore.periksaPenutupan(c.cycle_id);
    var m = NBStore.ringkasMonitoring(c.cycle_id);
    var sudahTutup = c.status === "CLOSED";

    var daftar = j.masalah.length
      ? j.masalah.map(function (x) {
          return "<div class='nb-setting' style='margin-bottom:8px'>" +
            NBUi.badge(T(x.blokir ? "adm.blokir" : "adm.catatan"), x.blokir ? "is-red" : "is-amber") +
            "<div style='flex:1'>" + NBUi.esc(T(x.kunci, x.vars)) + "</div></div>";
        }).join("")
      : "<div class='nb-setting'>" + NBUi.badge(T("adm.siap"), "is-emerald") +
        "<div style='flex:1'>" + NBUi.esc(T("adm.siapKet")) + "</div></div>";

    var ringkas = sudahTutup && c.closure_summary
      ? "<div class='nb-kpigrid' style='margin-top:20px'>" +
        NBUi.kpi(T("alok.thKuota"), NBFormat.angka(c.closure_summary.kuota), "layers", "", "") +
        NBUi.kpi(T("mon.thRealisasi"), NBFormat.angka(c.closure_summary.realisasi), "check", "is-emerald", "") +
        NBUi.kpi(T("mon.thUtilisasi"), c.closure_summary.utilisasi + " persen", "chart", "", "") +
        NBUi.kpi(T("mon.thBiayaActual"), NBFormat.rupiahRingkas(c.closure_summary.biaya_actual),
                 "shield", "is-amber", "", true) +
        "</div>"
      : "";

    return "<div style='padding:20px'>" +
      "<div style='font-weight:600;margin-bottom:4px'>" + NBUi.esc(T("adm.tutupJudul", { name: c.name })) + "</div>" +
      "<div class='nb-cell-sub' style='margin-bottom:14px'>" + NBUi.esc(T("adm.tutupSub")) + "</div>" +
      daftar + ringkas +
      (sudahTutup
        ? "<div style='margin-top:16px'>" + NBUi.badge(T("adm.sudahTutup",
            { t: NBFormat.tanggal(c.closed_at) }), "is-emerald") + "</div>"
        : "<div class='nb-formfoot'><button class='nb-btn nb-btn-soft-danger' id='aTutup'" +
          (j.bolehTutup ? "" : " disabled") + ">" + NBUi.esc(T("siklus.aksiTutup")) + "</button></div>") +
    "</div>";
  }

  // Reorganisasi terkendali (F7-3): pindahkan departemen ke divisi lain di entitas yang sama.
  function tabelReorganisasi() {
    var deps = NBStore.semuaDepartemen();
    var divs = NBStore.semuaDivisi();
    var riwayat = NBStore.riwayatReorganisasi();
    return "<div style='padding:20px'>" +
      "<div class='nb-fields'>" +
        "<div><div class='nb-field-label'>" + NBUi.esc(T("umum.departemen")) + "</div>" +
        "<select class='nb-select' id='rgDept'>" + deps.map(function (d) {
          var div = divs.filter(function (x) { return x.division_id === d.division_id; })[0] || {};
          return "<option value='" + d.department_id + "'>" + NBUi.esc(d.name + " (" + (div.name || "-") + ")") + "</option>";
        }).join("") + "</select></div>" +
        "<div><div class='nb-field-label'>" + NBUi.esc(T("reorg.divisiBaru")) + "</div>" +
        "<select class='nb-select' id='rgDiv'>" + divs.map(function (v) {
          var dir = NBStore.direktorat(v.directorate_id) || {};
          return "<option value='" + v.division_id + "'>" + NBUi.esc(v.name + (dir.name ? " \u00b7 " + dir.name : "")) + "</option>";
        }).join("") + "</select></div>" +
      "</div>" +
      "<div class='nb-formfoot'><button class='nb-btn nb-btn-soft-danger' id='rgPindah'>" + NBUi.esc(T("reorg.pindahkan")) + "</button></div>" +
      "<p class='nb-cell-sub'>" + NBUi.esc(T("reorg.ket")) + "</p>" +
      (riwayat.length
        ? "<div class='nb-field-label' style='margin-top:16px'>" + NBUi.esc(T("reorg.riwayat")) + "</div>" +
          riwayat.map(function (r) {
            return "<div class='nb-setting' style='margin-top:8px'>" + NBUi.badge(NBFormat.tanggalPendek(r.timestamp), "is-plain") +
              "<div style='flex:1'>" + NBUi.esc((NBStore.departemen(r.object_id) || {}).name || r.object_id) + ": " +
              NBUi.esc(String(r.old_value)) + " \u2192 " + NBUi.esc(String(r.new_value)) +
              "<div class='nb-cell-sub'>" + NBUi.esc(r.reason || "") + "</div></div></div>";
          }).join("")
        : "") +
    "</div>";
  }

  function tabelPrototipe() {
    return "<div style='padding:20px'>" +
      "<div class='nb-note' style='margin-bottom:16px'>" + NBUi.svg("shield") + "<div>" +
      "<div style='font-weight:600'>" + NBUi.esc(T("adm.protoJudul")) + "</div>" +
      "<div class='nb-cell-sub'>" + NBUi.esc(T("adm.protoIsi")) + "</div></div></div>" +
      "<button class='nb-btn nb-btn-quiet' id='aReset'>" + NBUi.esc(T("siklus.aksiReset")) + "</button>" +
    "</div>";
  }

  function render() {
    var c = NBStore.siklusAktif();
    if (!c) return "<div class='nb-card'>" + NBUi.kosong(T("dash.siklusKosong"), T("dash.siklusKosongSub")) + "</div>";

    var tabs = [["pengguna", "adm.tabPengguna"], ["parameter", "adm.tabParameter"],
                ["reorg", "adm.tabReorg"],
                ["penutupan", "adm.tabPenutupan"], ["prototipe", "adm.tabPrototipe"]];
    var isi = state.tab === "parameter" ? tabelParameter(c)
            : (state.tab === "reorg" ? tabelReorganisasi()
            : (state.tab === "penutupan" ? tabelPenutupan(c)
            : (state.tab === "prototipe" ? tabelPrototipe() : tabelPengguna())));

    return "" +
    "<div class='nb-pagehead'><div>" +
      "<h1>" + NBUi.esc(T("adm.judul")) + "</h1>" +
      "<p>" + NBUi.esc(T("adm.sub")) + "</p></div>" +
      "<div style='display:flex;gap:8px'>" +
      NBUi.badge(T("login.build", { b: (global.NB_BUILD || {}).build || 0, t: (global.NB_BUILD || {}).tanggal || "-" }), "is-plain") +
      NBUi.badge(c.name + " " + T({ DRAFT: "siklus.stDraft", OPEN: "siklus.stOpen",
        LOCKED: "siklus.stLocked", CLOSED: "siklus.stClosed" }[c.status] || c.status), "is-plain") + "</div>" +
    "</div>" +

    "<div class='nb-card'>" +
      "<div class='nb-toolbar'><div class='nb-tabs'>" + tabs.map(function (t) {
        return "<button class='nb-tab" + (state.tab === t[0] ? " is-active" : "") +
               "' data-tab='" + t[0] + "'>" + NBUi.esc(T(t[1])) + "</button>";
      }).join("") + "</div></div>" + isi +
    "</div>";
  }

  function mount() {
    document.querySelectorAll("button[data-tab]").forEach(function (b) {
      b.onclick = function () { state.tab = b.dataset.tab; NBApp.ulang(); };
    });

    var tutup = document.getElementById("aTutup");
    if (tutup) tutup.onclick = function () {
      var c = NBStore.siklusAktif();
      NBUi.konfirmasi({
        judul: T("siklus.aksiTutup"), pesan: T("siklus.tutupTanya", { name: c.name }),
        ok: T("siklus.aksiTutup"), batal: T("umum.batal"), gaya: "nb-btn-soft-danger"
      }, function () {
        var res = NBStore.ubahStatusSiklus(c.cycle_id, "CLOSED", null);
        NBUi.toast(res.ok ? T("siklus.statusBerhasil")
                          : (res.kunci ? T(res.kunci, res.vars || {}) : res.alasan), res.ok ? "ok" : "error");
        if (res.ok) NBApp.ulang();
      });
    };

    var pindah = document.getElementById("rgPindah");
    if (pindah) pindah.onclick = function () {
      var dept = document.getElementById("rgDept").value, div = document.getElementById("rgDiv").value;
      NBUi.konfirmasi({
        judul: T("reorg.pindahkan"), pesan: T("reorg.tanya"),
        perluAlasan: true, labelAlasan: T("review.alasanLabel"), pesanAlasan: T("review.errAlasan"),
        ok: T("reorg.pindahkan"), batal: T("umum.batal"), gaya: "nb-btn-soft-danger"
      }, function (alasan) {
        var res = NBStore.pindahkanDepartemen(dept, div, alasan);
        NBUi.toast(res.ok ? T("reorg.berhasil") : T(res.kunci, res.vars || {}), res.ok ? "ok" : "error");
        if (res.ok) NBApp.ulang();
      });
    };
    var reset = document.getElementById("aReset");
    if (reset) reset.onclick = function () {
      NBUi.konfirmasi({
        judul: T("siklus.aksiReset"), pesan: T("siklus.resetTanya"),
        ok: T("siklus.aksiReset"), batal: T("umum.batal"), gaya: "nb-btn-soft-danger"
      }, function () {
        var res = NBStore.reset();
        NBUi.toast(res.ok ? T("siklus.resetBerhasil") : T(res.kunci || "mgmt.errPeran"), res.ok ? "ok" : "error");
        if (res.ok) NBApp.ulang();
      });
    };
  }

  global.NBPages = global.NBPages || {};
  global.NBPages.admin = { render: render, mount: mount };
})(window);
