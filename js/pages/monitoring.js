// Layar Monitoring (FR-08, bab 21 dan 22).
// Realisasi selalu dibandingkan terhadap Approved, bukan terhadap Proposed.
// Aturan yang dipakai: penambahan headcount diblokir bila melebihi alokasi, jenis lain
// tetap dicatat tetapi memunculkan exception yang harus diputuskan OD.
(function (global) {
  "use strict";

  var T = function (k, v) { return NBi18n.t(k, v); };
  var state = { tab: "ringkas" };

  var ST_ALOK = {
    OPEN:      { i18n: "mon.stOPEN",      badge: "is-plain" },
    PARTIAL:   { i18n: "mon.stPARTIAL",   badge: "is-blue" },
    FULFILLED: { i18n: "mon.stFULFILLED", badge: "is-emerald" },
    OVER:      { i18n: "mon.stOVER",      badge: "is-red" }
  };

  function namaSasaran(a) {
    if (a.employee_id) return (NBStore.karyawan(a.employee_id) || {}).name || a.employee_id;
    if (a.new_position_title) return a.new_position_title;
    if (a.position_id) return (NBStore.posisi(a.position_id) || {}).title || a.position_id;
    if (a.vacancy_id) return a.vacancy_id;
    return "-";
  }

  function bar(persen) {
    var p = Math.min(100, persen);
    var warna = persen > 100 ? "var(--nb-red-200)"
      : (persen === 100 ? "var(--nb-emerald-bd)" : "var(--nb-blue-bd)");
    return "<div style='height:6px;border-radius:999px;background:var(--nb-gray-100);margin-top:6px'>" +
      "<div style='height:6px;width:" + p + "%;border-radius:999px;background:" + warna + "'></div></div>";
  }

  function tabelRingkas(r, bolehBiaya) {
    if (!r.perDept.length) return NBUi.kosong(T("mon.kosong"), T("mon.kosongSub"), NBUi.svg("layers"));
    return "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
      "<th>" + NBUi.esc(T("umum.departemen")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("alok.thKuota")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("mon.thRealisasi")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("alok.thSisa")) + "</th>" +
      "<th>" + NBUi.esc(T("mon.thUtilisasi")) + "</th>" +
      (bolehBiaya ? "<th class='nb-num'>" + NBUi.esc(T("mon.thBiayaAlokasi")) + "</th>" +
                    "<th class='nb-num'>" + NBUi.esc(T("mon.thBiayaActual")) + "</th>" : "") +
      "</tr></thead><tbody>" + r.perDept.map(function (d) {
        return "<tr><td><div class='nb-cell-title'>" + NBUi.esc(d.name) + "</div>" +
          "<div class='nb-cell-sub nb-mono'>" + NBUi.esc(d.cost_center_id) + "</div></td>" +
          "<td class='nb-num'>" + NBFormat.angka(d.kuota) + "</td>" +
          "<td class='nb-num'><b>" + NBFormat.angka(d.terpakai) + "</b></td>" +
          "<td class='nb-num'>" + NBFormat.angka(d.sisa) + "</td>" +
          "<td style='min-width:140px'>" + NBUi.esc(d.utilisasi + " persen") + bar(d.utilisasi) + "</td>" +
          (bolehBiaya ? "<td class='nb-num nb-mono'>" + NBFormat.rupiahRingkas(d.biayaAlokasi) + "</td>" +
                        "<td class='nb-num nb-mono'>" + NBFormat.rupiahRingkas(d.biayaActual) + "</td>" : "") +
        "</tr>";
      }).join("") +
      "<tr><td><b>" + NBUi.esc(T("kons.totalPerusahaan")) + "</b></td>" +
        "<td class='nb-num'><b>" + NBFormat.angka(r.total.kuota) + "</b></td>" +
        "<td class='nb-num'><b>" + NBFormat.angka(r.total.terpakai) + "</b></td>" +
        "<td class='nb-num'><b>" + NBFormat.angka(r.total.sisa) + "</b></td>" +
        "<td><b>" + NBUi.esc(r.total.utilisasi + " persen") + "</b></td>" +
        (bolehBiaya ? "<td class='nb-num'><b>" + NBFormat.rupiahRingkas(r.total.biayaAlokasi) + "</b></td>" +
                      "<td class='nb-num'><b>" + NBFormat.rupiahRingkas(r.total.biayaActual) + "</b></td>" : "") +
      "</tr></tbody></table></div>";
  }

  function tabelAlokasi(r, bolehCatat) {
    if (!r.alokasi.length) return NBUi.kosong(T("mon.kosong"), T("mon.kosongSub"), NBUi.svg("layers"));
    return "<div class='nb-tablewrap'><table class='nb-table' style='min-width:1020px'><thead><tr>" +
      "<th>" + NBUi.esc(T("alok.thId")) + "</th>" +
      "<th>" + NBUi.esc(T("plan.thAction")) + "</th>" +
      "<th>" + NBUi.esc(T("plan.thSasaran")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("alok.thKuota")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("mon.thRealisasi")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("alok.thSisa")) + "</th>" +
      "<th>" + NBUi.esc(T("umum.status")) + "</th>" +
      (bolehCatat ? "<th class='nb-num'>" + NBUi.esc(T("umum.aksi")) + "</th>" : "") +
      "</tr></thead><tbody>" + r.alokasi.map(function (a) {
        var d = NBStore.departemen(a.department_id);
        var st = ST_ALOK[a.status || "OPEN"] || ST_ALOK.OPEN;
        return "<tr><td><span class='nb-code'>" + NBUi.esc(a.allocation_id) + "</span></td>" +
          "<td>" + NBUi.badge(T("act." + a.action_type), (NBActions.def(a.action_type) || {}).badge) + "</td>" +
          "<td><div class='nb-cell-title' style='white-space:nowrap'>" + NBUi.esc(namaSasaran(a)) + "</div>" +
            "<div class='nb-cell-sub'>" + NBUi.esc(d ? d.name : a.department_id) + " &middot; " +
            NBUi.esc(a.effective_month ? NBFormat.bulanPendek(a.effective_month) : "-") + "</div></td>" +
          "<td class='nb-num'>" + a.approved_qty + "</td>" +
          "<td class='nb-num'><b>" + a.consumed_qty + "</b></td>" +
          "<td class='nb-num'>" + a.remaining_qty + "</td>" +
          "<td>" + NBUi.badge(T(st.i18n), st.badge) +
            (a.over_qty ? " " + NBUi.badge(T("mon.lebih", { n: a.over_qty }), "is-red") : "") + "</td>" +
          (bolehCatat
            ? "<td class='nb-num'><button class='nb-btn nb-btn-outline' data-catat='" + a.allocation_id + "'>" +
              NBUi.esc(T("mon.catat")) + "</button></td>"
            : "") + "</tr>";
      }).join("") + "</tbody></table></div>";
  }

  function tabelRealisasi(r, bolehCatat) {
    if (!r.actual.length) return NBUi.kosong(T("mon.belumAdaRealisasi"), T("mon.belumAdaRealisasiSub"));
    var semua = NBStore.actualTerlihat(NBStore.siklusAktif().cycle_id);
    return "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
      "<th>" + NBUi.esc(T("mon.thId")) + "</th>" +
      "<th>" + NBUi.esc(T("umum.karyawan")) + "</th>" +
      "<th>" + NBUi.esc(T("umum.departemen")) + "</th>" +
      "<th>" + NBUi.esc(T("mon.thTanggal")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("plan.thQty")) + "</th>" +
      "<th>" + NBUi.esc(T("umum.status")) + "</th>" +
      (bolehCatat ? "<th class='nb-num'>" + NBUi.esc(T("umum.aksi")) + "</th>" : "") +
      "</tr></thead><tbody>" + semua.map(function (a) {
        var d = NBStore.departemen(a.department_id);
        return "<tr" + (a.status === "CANCELLED" ? " style='opacity:.6'" : "") + ">" +
          "<td><span class='nb-code'>" + NBUi.esc(a.actual_id) + "</span>" +
            "<div class='nb-cell-sub nb-mono'>" + NBUi.esc(a.allocation_id) + "</div></td>" +
          "<td><div class='nb-cell-title'>" + NBUi.esc(a.employee_name || "-") + "</div>" +
            "<div class='nb-cell-sub'>" + NBUi.esc(T("act." + a.action_type)) + "</div></td>" +
          "<td>" + NBUi.esc(d ? d.name : a.department_id) + "</td>" +
          "<td>" + NBUi.esc(NBFormat.tanggal(a.actual_date)) + "</td>" +
          "<td class='nb-num'>" + a.quantity + "</td>" +
          "<td>" + NBUi.badge(T("mon.act" + a.status), a.status === "RECORDED" ? "is-emerald" : "is-plain") +
            (a.master_status ? " " + NBUi.badge(T("mon.master" + a.master_status),
              a.master_status === "DITERAPKAN" ? "is-teal" : (a.master_status === "MENUNGGU" ? "is-amber" : "is-plain")) : "") +
            (a.cancel_reason ? "<div class='nb-cell-sub'>" + NBUi.esc(a.cancel_reason) + "</div>" : "") + "</td>" +
          (bolehCatat
            ? "<td class='nb-num'>" + (a.status === "RECORDED"
                ? "<button class='nb-btn nb-btn-ghost-danger' data-batal='" + a.actual_id + "'>" +
                  NBUi.esc(T("mon.batalkan")) + "</button>"
                : "<span class='nb-muted'>-</span>") + "</td>"
            : "") + "</tr>";
      }).join("") + "</tbody></table></div>";
  }

  function tabelException(r, bolehPutus) {
    if (!r.exceptions.length) return NBUi.kosong(T("mon.excKosong"), T("mon.excKosongSub"));
    return "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
      "<th>" + NBUi.esc(T("mon.thException")) + "</th>" +
      "<th>" + NBUi.esc(T("umum.departemen")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("mon.thKelebihan")) + "</th>" +
      "<th>" + NBUi.esc(T("umum.status")) + "</th>" +
      (bolehPutus ? "<th class='nb-num'>" + NBUi.esc(T("umum.aksi")) + "</th>" : "") +
      "</tr></thead><tbody>" + r.exceptions.map(function (e) {
        var d = NBStore.departemen(e.department_id);
        var badge = e.status === "PENDING" ? "is-amber"
          : (e.status === "ACCEPTED" ? "is-emerald" : "is-red");
        return "<tr><td><span class='nb-code'>" + NBUi.esc(e.exception_id) + "</span>" +
            "<div class='nb-cell-sub nb-mono'>" + NBUi.esc(e.allocation_id) + "</div></td>" +
          "<td>" + NBUi.esc(d ? d.name : e.department_id) + "</td>" +
          "<td class='nb-num'><b>" + e.kelebihan + "</b></td>" +
          "<td>" + NBUi.badge(T("mon.exc" + e.status), badge) +
            (e.reason ? "<div class='nb-cell-sub'>" + NBUi.esc(e.reason) + "</div>" : "") + "</td>" +
          (bolehPutus
            ? "<td class='nb-num' style='white-space:nowrap'>" + (e.status === "PENDING"
                ? "<button class='nb-btn nb-btn-outline' data-exc-ok='" + e.exception_id + "'>" +
                  NBUi.esc(T("mon.excTerima")) + "</button> " +
                  "<button class='nb-btn nb-btn-ghost-danger' data-exc-no='" + e.exception_id + "'>" +
                  NBUi.esc(T("mon.excTolak")) + "</button>"
                : "<span class='nb-muted'>-</span>") + "</td>"
            : "") + "</tr>";
      }).join("") + "</tbody></table></div>";
  }

  // Persetujuan HC (F5-1): daftar realisasi yang menunggu, dengan tombol setujui atau tolak.
  function tabelPersetujuan(bolehSetuju) {
    var c = NBStore.siklusAktif();
    var daftar = NBStore.realisasiMenunggu(c.cycle_id);
    if (!daftar.length) return NBUi.kosong(T("mon.hcKosong"), T("mon.hcKosongSub"));
    return "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
      "<th>" + NBUi.esc(T("mon.thId")) + "</th>" +
      "<th>" + NBUi.esc(T("plan.thAction")) + "</th>" +
      "<th>" + NBUi.esc(T("umum.karyawan")) + "</th>" +
      "<th>" + NBUi.esc(T("mon.thTanggal")) + "</th>" +
      "<th>" + NBUi.esc(T("mon.thDampakMaster")) + "</th>" +
      (bolehSetuju ? "<th class='nb-num'>" + NBUi.esc(T("umum.aksi")) + "</th>" : "") +
      "</tr></thead><tbody>" + daftar.map(function (a) {
        return "<tr><td><span class='nb-code'>" + NBUi.esc(a.actual_id) + "</span>" +
            "<div class='nb-cell-sub'>" + NBUi.esc((NBStore.departemen(a.department_id) || {}).name || "") + "</div></td>" +
          "<td>" + NBUi.badge(T("act." + a.action_type), (NBActions.def(a.action_type) || {}).badge) + "</td>" +
          "<td>" + NBUi.esc(a.employee_name || "-") + (a.employee_id ? "<div class='nb-cell-sub nb-mono'>" + NBUi.esc(a.employee_id) + "</div>" : "") + "</td>" +
          "<td>" + NBUi.esc(NBFormat.tanggal(a.actual_date)) + "</td>" +
          "<td class='nb-cell-sub'>" + NBUi.esc(T("mon.dampak" + a.action_type)) + "</td>" +
          (bolehSetuju
            ? "<td class='nb-num' style='white-space:nowrap'>" +
              "<button class='nb-btn nb-btn-outline' data-hc-ok='" + a.actual_id + "'>" + NBUi.esc(T("mon.hcSetuju")) + "</button> " +
              "<button class='nb-btn nb-btn-ghost-danger' data-hc-no='" + a.actual_id + "'>" + NBUi.esc(T("mon.hcTolak")) + "</button></td>"
            : "") + "</tr>";
      }).join("") + "</tbody></table></div>";
  }

  function kurvaBulan(r) {
    var maks = r.perBulan.reduce(function (m, b) { return Math.max(m, b.rencana, b.realisasi); }, 1);
    return "<div style='padding:4px 20px 20px;display:grid;grid-template-columns:repeat(12,1fr);" +
      "gap:6px;align-items:end'>" + r.perBulan.map(function (b) {
        var t1 = Math.round(b.rencana / maks * 70), t2 = Math.round(b.realisasi / maks * 70);
        return "<div style='text-align:center'>" +
          "<div style='height:76px;display:flex;align-items:flex-end;gap:3px;justify-content:center'>" +
            "<div style='width:40%;height:" + Math.max(2, t1) + "px;background:var(--nb-gray-200);" +
              "border-radius:4px 4px 0 0'></div>" +
            "<div style='width:40%;height:" + Math.max(2, t2) + "px;background:var(--nb-blue-bd);" +
              "border-radius:4px 4px 0 0'></div>" +
          "</div><div class='nb-kpi-label' style='margin:6px 0 2px'>" +
          NBUi.esc(NBFormat.bulanPendek(b.bulan)) + "</div>" +
          "<div class='nb-cell-sub'>" + b.rencana + " / " + b.realisasi + "</div></div>";
      }).join("") + "</div>" +
      "<p class='nb-cell-sub' style='padding:0 20px 20px;margin:0'>" + NBUi.esc(T("mon.kurvaKet")) + "</p>";
  }

  function render() {
    var u = NBStore.user();
    var c = NBStore.siklusAktif();
    if (!c) return "<div class='nb-card'>" + NBUi.kosong(T("dash.siklusKosong"), T("dash.siklusKosongSub")) + "</div>";

    var r = NBStore.ringkasMonitoring(c.cycle_id);
    var deps = NBStore.departemenTerlihat();
    var bolehBiaya = deps.every(function (d) { return NBRbac.canSeeCost(u, d.department_id); });
    var bolehCatat = NBRbac.can(u, "actual.record") && c.status !== "CLOSED";
    var bolehPutus = NBRbac.can(u, "consolidate") && NBRbac.can(u, "monitor.all");

    var bolehSetuju = NBRbac.can(u, "actual.approve") && c.status !== "CLOSED";
    var menungguHc = NBStore.realisasiMenunggu(c.cycle_id).length;
    var tabs = [["ringkas", "mon.tabRingkas"], ["alokasi", "mon.tabAlokasi"],
                ["realisasi", "mon.tabRealisasi"], ["persetujuan", "mon.tabPersetujuan"],
                ["bulan", "mon.tabBulan"], ["exception", "mon.tabException"]];
    var isi = state.tab === "alokasi" ? tabelAlokasi(r, bolehCatat)
            : state.tab === "persetujuan" ? tabelPersetujuan(bolehSetuju)
            : (state.tab === "realisasi" ? tabelRealisasi(r, bolehCatat)
            : (state.tab === "bulan" ? kurvaBulan(r)
            : (state.tab === "exception" ? tabelException(r, bolehPutus) : tabelRingkas(r, bolehBiaya))));

    return "" +
    "<div class='nb-pagehead'><div>" +
      "<h1>" + NBUi.esc(T("mon.judul")) + "</h1>" +
      "<p>" + NBUi.esc(T("mon.sub", { name: c.name })) + "</p></div>" +
      (r.menunggu ? NBUi.badge(T("mon.menunggu", { n: r.menunggu }), "is-red") : NBUi.badge(c.name, "is-plain")) +
    "</div>" +

    "<div class='nb-kpigrid'>" +
      NBUi.kpi(T("alok.thKuota"), NBFormat.angka(r.total.kuota), "layers", "is-blue", T("mon.kpiKuotaKet")) +
      NBUi.kpi(T("mon.thRealisasi"), NBFormat.angka(r.total.terpakai), "check", "is-emerald",
               T("mon.kpiRealisasiKet", { h: NBFormat.delta(r.total.hcRealisasi) })) +
      NBUi.kpi(T("mon.thUtilisasi"), r.total.utilisasi + " persen", "chart", "",
               T("mon.kpiUtilisasiKet", { n: r.total.sisa })) +
      (bolehBiaya
        ? NBUi.kpi(T("mon.thBiayaActual"), NBFormat.rupiahRingkas(r.total.biayaActual), "shield", "is-amber",
                   T("mon.kpiBiayaKet", { n: NBFormat.rupiahRingkas(r.total.biayaAlokasi) }), true)
        : NBUi.kpi(T("mon.kpiException"), NBFormat.angka(r.exceptions.length), "shield", "is-amber",
                   T("mon.kpiExceptionKet", { n: r.menunggu }))) +
    "</div>" +

    "<div class='nb-card nb-card-pad' style='margin-bottom:24px;background:var(--nb-gray-50)'>" +
      "<div class='nb-note'>" + NBUi.svg("shield") + "<div>" +
      "<div style='font-weight:600'>" + NBUi.esc(T("mon.aturanJudul")) + "</div>" +
      "<div class='nb-cell-sub'>" + NBUi.esc(T("mon.aturanIsi")) + "</div></div></div></div>" +

    "<div class='nb-card'>" +
      "<div class='nb-toolbar'><div class='nb-tabs'>" + tabs.map(function (t) {
        return "<button class='nb-tab" + (state.tab === t[0] ? " is-active" : "") +
               "' data-tab='" + t[0] + "'>" + NBUi.esc(T(t[1])) +
               (t[0] === "persetujuan" && menungguHc ? " " + NBUi.badge(String(menungguHc), "is-amber") : "") + "</button>";
      }).join("") + "</div>" +
      "<div class='nb-cell-sub'>" + NBUi.esc(T("mon.dasar")) + "</div></div>" + isi +
    "</div>";
  }

  function dialogCatat(allocationId) {
    var c = NBStore.siklusAktif();
    var a = NBStore.alokasiTerlihat(c.cycle_id).filter(function (x) {
      return x.allocation_id === allocationId;
    })[0];
    if (!a) return;
    var host = document.createElement("div");
    host.innerHTML =
      "<div class='nb-overlay' id='mCatat'><div class='nb-modal' style='max-width:560px'>" +
      "<div class='nb-modal-head'><div><div class='nb-modal-title'><h2>" +
        NBUi.esc(T("mon.catatJudul")) + "</h2></div>" +
        "<div class='nb-metachips'><span class='nb-metachip is-code'>" + NBUi.esc(allocationId) + "</span>" +
        "<span class='nb-metachip'>" + NBUi.esc(T("mon.sisaKuota", { n: a.remaining_qty })) + "</span></div></div>" +
        "<button class='nb-iconbtn' data-batal='1'>&times;</button></div>" +
      "<div class='nb-modal-body'><div class='nb-section' style='margin-bottom:0'>" +
        "<div class='nb-fields'>" +
          "<div><div class='nb-field-label'>" + NBUi.esc(T("mon.fTanggal")) + "</div>" +
          "<input class='nb-input' id='cTanggal' type='date' value='" +
            NBUi.esc(c.year + "-0" + Math.min(9, a.effective_month || 1) + "-01") + "'></div>" +
          "<div><div class='nb-field-label'>" + NBUi.esc(T("plan.thQty")) + "</div>" +
          "<input class='nb-input' id='cQty' type='number' min='1' value='1'></div>" +
        "</div>" +
        "<div style='margin-top:14px'><div class='nb-field-label'>" + NBUi.esc(T("mon.fNama")) + "</div>" +
        "<input class='nb-input' id='cNama' placeholder='" + NBUi.esc(T("mon.fNamaPlaceholder")) + "'></div>" +
        "<div style='margin-top:14px'><div class='nb-field-label'>" + NBUi.esc(T("mon.fNik")) + "</div>" +
        "<input class='nb-input' id='cNik'></div>" +
        "<div id='cGalat' class='nb-cell-sub' style='color:var(--nb-red-700);margin-top:10px'></div>" +
        "<p class='nb-cell-sub' style='margin-top:10px'>" + NBUi.esc(T("mon.fCatatan")) + "</p>" +
      "</div></div>" +
      "<div class='nb-modal-foot'><button class='nb-btn nb-btn-quiet' data-batal='1'>" +
        NBUi.esc(T("umum.batal")) + "</button>" +
      "<div class='nb-group'><button class='nb-btn nb-btn-primary' id='cOk'>" +
        NBUi.esc(T("mon.catat")) + "</button></div></div></div></div>";
    document.body.appendChild(host.firstChild);
    var modal = document.getElementById("mCatat");
    modal.querySelectorAll("[data-batal]").forEach(function (x) { x.onclick = function () { modal.remove(); }; });
    modal.onclick = function (e) { if (e.target === modal) modal.remove(); };
    document.getElementById("cOk").onclick = function () {
      var res = NBStore.catatActual(allocationId, {
        quantity: document.getElementById("cQty").value,
        actual_date: document.getElementById("cTanggal").value,
        employee_name: document.getElementById("cNama").value.trim(),
        employee_id: document.getElementById("cNik").value.trim() || null
      });
      if (!res.ok) {
        document.getElementById("cGalat").textContent = T(res.kunci, res.vars || {});
        return;
      }
      modal.remove();
      NBUi.toast(res.exception ? T("mon.tercatatException") : T("mon.tercatat"), res.exception ? "error" : "ok");
      NBApp.ulang();
    };
  }

  function mount() {
    document.querySelectorAll("button[data-tab]").forEach(function (b) {
      b.onclick = function () { state.tab = b.dataset.tab; NBApp.ulang(); };
    });
    document.querySelectorAll("button[data-catat]").forEach(function (b) {
      b.onclick = function () { dialogCatat(b.dataset.catat); };
    });
    document.querySelectorAll("button[data-batal]").forEach(function (b) {
      if (!b.dataset.batal || b.dataset.batal === "1") return;
      b.onclick = function () {
        NBUi.konfirmasi({
          judul: T("mon.batalJudul"), pesan: T("mon.batalPesan"),
          perluAlasan: true, labelAlasan: T("review.alasanLabel"),
          pesanAlasan: T("review.errAlasan"), ok: T("mon.batalkan"),
          batal: T("umum.batal"), gaya: "nb-btn-soft-danger"
        }, function (alasan) {
          var res = NBStore.batalkanActual(b.dataset.batal, alasan);
          NBUi.toast(res.ok ? T("mon.dibatalkan") : T(res.kunci, res.vars || {}), res.ok ? "ok" : "error");
          if (res.ok) NBApp.ulang();
        });
      };
    });
    document.querySelectorAll("button[data-hc-ok], button[data-hc-no]").forEach(function (b) {
      var setuju = !!b.dataset.hcOk;
      var id = setuju ? b.dataset.hcOk : b.dataset.hcNo;
      b.onclick = function () {
        NBUi.konfirmasi({
          judul: T(setuju ? "mon.hcSetujuJudul" : "mon.hcTolakJudul"),
          pesan: T(setuju ? "mon.hcSetujuPesan" : "mon.hcTolakPesan"),
          perluAlasan: !setuju, labelAlasan: T("review.alasanLabel"), pesanAlasan: T("review.errAlasan"),
          ok: T(setuju ? "mon.hcSetuju" : "mon.hcTolak"), batal: T("umum.batal"),
          gaya: setuju ? "nb-btn-primary" : "nb-btn-soft-danger"
        }, function (alasan) {
          var res = NBStore.setujuiRealisasi(id, setuju ? "SETUJU" : "TOLAK", alasan);
          NBUi.toast(res.ok ? T("mon.hcDiputus") : T(res.kunci, res.vars || {}), res.ok ? "ok" : "error");
          if (res.ok) NBApp.ulang();
        });
      };
    });
    document.querySelectorAll("button[data-exc-ok], button[data-exc-no]").forEach(function (b) {
      var terima = !!b.dataset.excOk;
      var id = terima ? b.dataset.excOk : b.dataset.excNo;
      b.onclick = function () {
        NBUi.konfirmasi({
          judul: T(terima ? "mon.excTerimaJudul" : "mon.excTolakJudul"),
          pesan: T(terima ? "mon.excTerimaPesan" : "mon.excTolakPesan"),
          perluAlasan: true, labelAlasan: T("review.alasanLabel"),
          pesanAlasan: T("review.errAlasan"), ok: T(terima ? "mon.excTerima" : "mon.excTolak"),
          batal: T("umum.batal"), gaya: terima ? "nb-btn-primary" : "nb-btn-soft-danger"
        }, function (alasan) {
          var res = NBStore.putuskanException(id, terima ? "ACCEPT" : "REJECT", alasan);
          NBUi.toast(res.ok ? T("mon.excDiputus") : T(res.kunci, res.vars || {}), res.ok ? "ok" : "error");
          if (res.ok) NBApp.ulang();
        });
      };
    });
  }

  global.NBPages = global.NBPages || {};
  global.NBPages.monitoring = { render: render, mount: mount };
})(window);
