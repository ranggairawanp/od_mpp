// Layar Management Review (FR-07).
// Aturan yang dikunci: manajemen boleh menurunkan angka, kenaikan wajib lewat pengembalian
// ke departemen. Larangan menaikkan dijaga di store, bukan hanya disembunyikan di layar ini.
(function (global) {
  "use strict";

  var T = function (k, v) { return NBi18n.t(k, v); };
  var state = { tab: "baris" };

  var KEPUTUSAN = {
    APPROVED: { i18n: "mgmt.stAPPROVED", badge: "is-emerald" },
    REDUCED:  { i18n: "mgmt.stREDUCED",  badge: "is-amber" },
    REJECTED: { i18n: "mgmt.stREJECTED", badge: "is-red" }
  };

  function namaSasaran(b) {
    if (b.employee_id) return (NBStore.karyawan(b.employee_id) || {}).name || b.employee_id;
    if (b.new_position_title) return b.new_position_title;
    if (b.position_id) return (NBStore.posisi(b.position_id) || {}).title || b.position_id;
    if (b.vacancy_id) return b.vacancy_id;
    return "-";
  }

  function tabelBaris(r, bolehPutus) {
    if (!r.baris.length) {
      return NBUi.kosong(T("mgmt.kosong"), T("mgmt.kosongSub"), NBUi.svg("layers"));
    }
    return "<div class='nb-tablewrap'><table class='nb-table' style='min-width:1060px'><thead><tr>" +
      "<th>" + NBUi.esc(T("plan.thId")) + "</th>" +
      "<th>" + NBUi.esc(T("plan.thAction")) + "</th>" +
      "<th>" + NBUi.esc(T("plan.thSasaran")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("mgmt.thQty")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("mgmt.thBiaya")) + "</th>" +
      "<th>" + NBUi.esc(T("mgmt.thKeputusan")) + "</th>" +
      (bolehPutus ? "<th class='nb-num'>" + NBUi.esc(T("umum.aksi")) + "</th>" : "") +
      "</tr></thead><tbody>" + r.baris.map(function (x) {
        var b = x.baris;
        var d = NBStore.departemen(b.department_id);
        var k = KEPUTUSAN[b.decision];
        return "<tr><td><span class='nb-code'>" + NBUi.esc(b.line_item_id) + "</span></td>" +
          "<td>" + NBUi.badge(T("act." + b.action_type), (NBActions.def(b.action_type) || {}).badge) + "</td>" +
          "<td><div class='nb-cell-title'>" + NBUi.esc(namaSasaran(b)) + "</div>" +
            "<div class='nb-cell-sub'>" + NBUi.esc(d ? d.name : "") + " &middot; " +
              NBUi.esc(b.effective_month ? NBFormat.bulanPendek(b.effective_month) : "-") + "</div></td>" +
          "<td class='nb-num'><b>" + x.setujuQty + "</b>" +
            (x.setujuQty !== x.usulanQty
              ? "<div class='nb-cell-sub'>" + NBUi.esc(T("mgmt.dariUsulan", { n: x.usulanQty })) + "</div>"
              : "") + "</td>" +
          "<td class='nb-num nb-mono'>" +
            NBFormat.rupiahRingkas(x.biayaSetuju ? x.biayaSetuju.annualized_cost : 0) +
            (x.biayaUsulan && x.biayaSetuju && x.biayaUsulan.annualized_cost !== x.biayaSetuju.annualized_cost
              ? "<div class='nb-cell-sub'>" + NBUi.esc(T("mgmt.dariBiaya",
                  { n: NBFormat.rupiahRingkas(x.biayaUsulan.annualized_cost) })) + "</div>"
              : "") + "</td>" +
          "<td>" + (k ? NBUi.badge(T(k.i18n), k.badge) : NBUi.badge(T("mgmt.stBELUM"), "is-plain")) +
            (b.decision_reason ? "<div class='nb-cell-sub'>" + NBUi.esc(b.decision_reason) + "</div>" : "") + "</td>" +
          (bolehPutus
            ? "<td class='nb-num' style='white-space:nowrap'>" +
              "<button class='nb-btn nb-btn-outline' data-setuju='" + b.line_item_id + "'>" +
                NBUi.esc(T("mgmt.setuju")) + "</button> " +
              "<button class='nb-btn nb-btn-outline' data-kurangi='" + b.line_item_id + "'>" +
                NBUi.esc(T("mgmt.kurangi")) + "</button> " +
              "<button class='nb-btn nb-btn-ghost-danger' data-tolak='" + b.line_item_id + "'>" +
                NBUi.esc(T("mgmt.tolak")) + "</button></td>"
            : "") + "</tr>";
      }).join("") + "</tbody></table></div>";
  }

  function tabelRevisi(c) {
    var rev = NBStore.revisiSiklus(c.cycle_id);
    if (!rev.length) return NBUi.kosong(T("mgmt.revKosong"), T("mgmt.revKosongSub"));
    return "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
      "<th>" + NBUi.esc(T("audit.waktu")) + "</th>" +
      "<th>" + NBUi.esc(T("mgmt.thObjek")) + "</th>" +
      "<th>" + NBUi.esc(T("snap.thField")) + "</th>" +
      "<th>" + NBUi.esc(T("audit.nilai")) + "</th>" +
      "<th>" + NBUi.esc(T("review.alasanLabel")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("kons.thVersi")) + "</th>" +
      "</tr></thead><tbody>" + rev.map(function (r) {
        var oleh = (NBStore.pengguna(r.actor_id) || {}).name || r.actor_id;
        return "<tr><td class='nb-ts'>" + NBFormat.tanggalPendek(r.timestamp) +
            "<small>" + NBFormat.jam(r.timestamp) + "</small>" +
            "<small>" + NBUi.esc(r.revision_id) + "</small></td>" +
          "<td><span class='nb-code'>" + NBUi.esc(r.object_id) + "</span>" +
            "<div class='nb-cell-sub'>" + NBUi.esc(oleh) + "</div></td>" +
          "<td class='nb-mono'>" + NBUi.esc(r.field) + "</td>" +
          "<td><span class='nb-mono'>" + NBUi.esc(String(r.old_value)) + "</span> " +
            "<span class='nb-muted'>" + NBUi.esc(T("audit.ke")) + "</span> " +
            "<span class='nb-mono'>" + NBUi.esc(String(r.new_value)) + "</span></td>" +
          "<td class='nb-cell-sub'>" + NBUi.esc(r.reason || "-") + "</td>" +
          "<td class='nb-num'>v" + r.version + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  function render() {
    var u = NBStore.user();
    var c = NBStore.siklusAktif();
    if (!c) return "<div class='nb-card'>" + NBUi.kosong(T("dash.siklusKosong"), T("dash.siklusKosongSub")) + "</div>";

    var r = NBStore.ringkasKeputusan(c.cycle_id);
    var approval = NBStore.approvalSiklus(c.cycle_id);
    var bolehPutus = NBRbac.can(u, "review.decide") && r.baris.length > 0 &&
      NBStore.barisReview(c.cycle_id).length > 0 && !approval.length;
    var semuaDiputuskan = r.baris.length > 0 && r.diputuskan === r.baris.length;

    var hemat = r.usulanBiaya - r.disetujuiBiaya;
    var tabs = [["baris", "mgmt.tabBaris"], ["revisi", "mgmt.tabRevisi"]];

    var aksi = "";
    if (bolehPutus) {
      aksi = "<div style='display:flex;gap:8px'>" +
        "<button class='nb-btn nb-btn-soft-danger' id='mKembali'>" + NBUi.esc(T("mgmt.kembalikan")) + "</button>" +
        "<button class='nb-btn nb-btn-primary' id='mSetujui'" + (semuaDiputuskan ? "" : " disabled") + ">" +
          NBUi.esc(T("mgmt.setujuiMpp")) + "</button></div>";
    } else if (approval.length) {
      aksi = NBUi.badge(T("mgmt.sudahDisetujui", { id: approval[0].approval_id }), "is-emerald");
    } else {
      aksi = NBUi.badge(T("mgmt.belumSiap"), "is-amber");
    }

    return "" +
    "<div class='nb-pagehead'><div>" +
      "<h1>" + NBUi.esc(T("mgmt.judul")) + "</h1>" +
      "<p>" + NBUi.esc(T("mgmt.sub", { name: c.name })) + "</p></div>" + aksi + "</div>" +

    "<div class='nb-kpigrid'>" +
      NBUi.kpi(T("mgmt.kpiHcUsulan"), NBFormat.delta(r.usulanHc), "chart", "is-blue",
               T("mgmt.kpiHcUsulanKet", { n: r.baris.length })) +
      NBUi.kpi(T("mgmt.kpiHcSetuju"), NBFormat.delta(r.disetujuiHc), "check", "is-emerald",
               T("mgmt.kpiHcSetujuKet", { a: r.diputuskan, b: r.baris.length })) +
      NBUi.kpi(T("mgmt.kpiBiayaSetuju"), NBFormat.rupiahRingkas(r.disetujuiBiaya), "layers", "",
               T("mgmt.kpiBiayaSetujuKet", { n: NBFormat.rupiahRingkas(r.usulanBiaya) }), true) +
      NBUi.kpi(T("mgmt.kpiHemat"), NBFormat.rupiahRingkas(hemat), "shield", "is-amber",
               T("mgmt.kpiHematKet", { a: r.dikurangi, b: r.ditolak }), true) +
    "</div>" +

    "<div class='nb-card nb-card-pad' style='margin-bottom:24px;background:var(--nb-gray-50)'>" +
      "<div class='nb-note'>" + NBUi.svg("shield") +
      "<div><div style='font-weight:600'>" + NBUi.esc(T("mgmt.aturanJudul")) + "</div>" +
      "<div class='nb-cell-sub'>" + NBUi.esc(T("mgmt.aturanIsi")) + "</div></div></div></div>" +

    "<div class='nb-card'>" +
      "<div class='nb-toolbar'><div class='nb-tabs'>" + tabs.map(function (t) {
        return "<button class='nb-tab" + (state.tab === t[0] ? " is-active" : "") +
               "' data-tab='" + t[0] + "'>" + NBUi.esc(T(t[1])) + "</button>";
      }).join("") + "</div>" +
      "<div class='nb-cell-sub'>" + NBUi.esc(T("mgmt.dasar")) + "</div></div>" +
      (state.tab === "revisi" ? tabelRevisi(c) : tabelBaris(r, bolehPutus)) +
    "</div>";
  }

  function mount() {
    document.querySelectorAll("button[data-tab]").forEach(function (b) {
      b.onclick = function () { state.tab = b.dataset.tab; NBApp.ulang(); };
    });

    function jalankan(res) {
      NBUi.toast(res.ok ? T("mgmt.tercatat") : T(res.kunci, res.vars || {}), res.ok ? "ok" : "error");
      if (res.ok) NBApp.ulang();
    }

    document.querySelectorAll("button[data-setuju]").forEach(function (b) {
      b.onclick = function () { jalankan(NBStore.putuskanBaris(b.dataset.setuju, "APPROVE", null, null)); };
    });

    document.querySelectorAll("button[data-tolak]").forEach(function (b) {
      b.onclick = function () {
        NBUi.konfirmasi({
          judul: T("mgmt.tolakJudul"), pesan: T("mgmt.tolakPesan"),
          perluAlasan: true, labelAlasan: T("review.alasanLabel"),
          pesanAlasan: T("review.errAlasan"), ok: T("mgmt.tolak"),
          batal: T("umum.batal"), gaya: "nb-btn-soft-danger"
        }, function (alasan) { jalankan(NBStore.putuskanBaris(b.dataset.tolak, "REJECT", 0, alasan)); });
      };
    });

    // Menurunkan angka memakai dialog tersendiri karena butuh angka baru sekaligus alasan.
    document.querySelectorAll("button[data-kurangi]").forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.kurangi;
        var baris = NBStore.barisReview(NBStore.siklusAktif().cycle_id)
          .filter(function (x) { return x.line_item_id === id; })[0];
        var usulan = NBStore.kuantitasUsulan(baris);
        var host = document.createElement("div");
        host.innerHTML =
          "<div class='nb-overlay' id='mKurangi'><div class='nb-modal' style='max-width:520px'>" +
          "<div class='nb-modal-head'><div><div class='nb-modal-title'><h2>" +
            NBUi.esc(T("mgmt.kurangiJudul")) + "</h2></div>" +
            "<div class='nb-metachips'><span class='nb-metachip is-code'>" + NBUi.esc(id) + "</span>" +
            "<span class='nb-metachip'>" + NBUi.esc(T("mgmt.diusulkan", { n: usulan })) + "</span></div></div>" +
            "<button class='nb-iconbtn' data-batal='1'>&times;</button></div>" +
          "<div class='nb-modal-body'><div class='nb-section' style='margin-bottom:0'>" +
            "<div class='nb-field-label'>" + NBUi.esc(T("mgmt.jumlahBaru")) + "</div>" +
            "<input class='nb-input' id='kQty' type='number' min='0' max='" + usulan + "' value='" +
              Math.max(0, usulan - 1) + "'>" +
            "<div style='margin-top:14px'><div class='nb-field-label'>" +
              NBUi.esc(T("review.alasanLabel")) + "</div>" +
            "<textarea class='nb-input' id='kAlasan' rows='3' style='resize:vertical' placeholder='" +
              NBUi.esc(T("mgmt.alasanPlaceholder")) + "'></textarea></div>" +
            "<div id='kGalat' class='nb-cell-sub' style='color:var(--nb-red-700);margin-top:8px'></div>" +
            "<p class='nb-cell-sub' style='margin-top:10px'>" + NBUi.esc(T("mgmt.aturanIsi")) + "</p>" +
          "</div></div>" +
          "<div class='nb-modal-foot'><button class='nb-btn nb-btn-quiet' data-batal='1'>" +
            NBUi.esc(T("umum.batal")) + "</button>" +
          "<div class='nb-group'><button class='nb-btn nb-btn-primary' id='kOk'>" +
            NBUi.esc(T("mgmt.kurangi")) + "</button></div></div></div></div>";
        document.body.appendChild(host.firstChild);
        var modal = document.getElementById("mKurangi");
        modal.querySelectorAll("[data-batal]").forEach(function (x) { x.onclick = function () { modal.remove(); }; });
        modal.onclick = function (e) { if (e.target === modal) modal.remove(); };
        document.getElementById("kOk").onclick = function () {
          var res = NBStore.putuskanBaris(id, "REDUCE",
            document.getElementById("kQty").value,
            document.getElementById("kAlasan").value.trim());
          if (!res.ok) {
            document.getElementById("kGalat").textContent = T(res.kunci, res.vars || {});
            return;
          }
          modal.remove();
          jalankan(res);
        };
      };
    });

    var setujui = document.getElementById("mSetujui");
    if (setujui) setujui.onclick = function () {
      var c = NBStore.siklusAktif();
      NBUi.konfirmasi({
        judul: T("mgmt.setujuiJudul"), pesan: T("mgmt.setujuiPesan"),
        perluAlasan: true, labelAlasan: T("mgmt.catatanLabel"),
        placeholder: T("mgmt.catatanPlaceholder"), pesanAlasan: T("review.errAlasan"),
        ok: T("mgmt.setujuiMpp"), batal: T("umum.batal")
      }, function (catatan) {
        var res = NBStore.setujuiMpp(c.cycle_id, catatan);
        NBUi.toast(res.ok ? T("mgmt.disetujui", { id: res.approval.approval_id })
                          : T(res.kunci, res.vars || {}), res.ok ? "ok" : "error");
        if (res.ok) NBApp.ulang();
      });
    };

    var kembali = document.getElementById("mKembali");
    if (kembali) kembali.onclick = function () {
      var c = NBStore.siklusAktif();
      NBUi.konfirmasi({
        judul: T("mgmt.kembalikanJudul"), pesan: T("mgmt.kembalikanPesan"),
        perluAlasan: true, labelAlasan: T("review.alasanLabel"),
        pesanAlasan: T("review.errAlasan"), ok: T("mgmt.kembalikan"),
        batal: T("umum.batal"), gaya: "nb-btn-soft-danger"
      }, function (alasan) {
        var res = NBStore.kembalikanKeDepartemen(c.cycle_id, alasan);
        NBUi.toast(res.ok ? T("mgmt.dikembalikan", { n: res.jumlah })
                          : T(res.kunci, res.vars || {}), res.ok ? "ok" : "error");
        if (res.ok) NBApp.ulang();
      });
    };
  }

  global.NBPages = global.NBPages || {};
  global.NBPages.review = { render: render, mount: mount };
})(window);
