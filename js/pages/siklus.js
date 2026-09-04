// Layar Siklus MPP dan Snapshot. FR-01 dan FR-02.
// Snapshot yang sudah dirilis adalah state Current. Tidak pernah ditimpa, hanya ditambah versinya.
(function (global) {
  "use strict";

  var T = function (k, v) { return NBi18n.t(k, v); };
  var state = { cycle_id: null, snapshot_id: null };
  var BATAS_BARIS = 200;

  var STATUS = {
    DRAFT:  { label: "siklus.stDraft",  ket: "siklus.stDraftKet",  badge: "is-plain" },
    OPEN:   { label: "siklus.stOpen",   ket: "siklus.stOpenKet",   badge: "is-blue" },
    LOCKED: { label: "siklus.stLocked", ket: "siklus.stLockedKet", badge: "is-amber" },
    CLOSED: { label: "siklus.stClosed", ket: "siklus.stClosedKet", badge: "is-emerald" }
  };

  function siklusTerpilih() {
    var c = state.cycle_id ? NBStore.siklus(state.cycle_id) : null;
    return c || NBStore.siklusAktif();
  }

  function barisSiklus(c, aktifId) {
    var st = STATUS[c.status] || { label: c.status, ket: "", badge: "" };
    var snap = NBStore.snapshotAktif(c.cycle_id);
    return "<tr class='" + (c.cycle_id === aktifId ? "is-active" : "") + "' data-cycle='" + c.cycle_id +
      "' style='cursor:pointer'>" +
      "<td><div class='nb-cell-title'>" + NBUi.esc(c.name) + "</div>" +
        "<div class='nb-cell-sub nb-mono'>" + NBUi.esc(c.cycle_id) + " v" + c.version + "</div></td>" +
      "<td>" + NBUi.badge(T(st.label), st.badge) +
        "<div class='nb-cell-sub'>" + NBUi.esc(T(st.ket)) + "</div></td>" +
      "<td>" + NBUi.esc(T("siklus.periode", {
          a: NBFormat.tanggalPendek(c.start_date), b: NBFormat.tanggalPendek(c.end_date) })) + "</td>" +
      "<td>" + NBFormat.tanggalPendek(c.submission_deadline) + "</td>" +
      "<td>" + (snap
        ? "<span class='nb-mono'>" + NBUi.esc(snap.snapshot_id) + "</span><div class='nb-cell-sub'>" +
          NBUi.esc(T("umum.baris", { n: NBFormat.angka(NBStore.snapshotBarisTerlihat(snap.snapshot_id).length) })) +
          "</div>"
        : "<span class='nb-muted'>" + NBUi.esc(T("umum.belumAda")) + "</span>") + "</td>" +
    "</tr>";
  }

  function aksiSiklus(u, c) {
    if (!NBRbac.can(u, "cycle.create")) {
      return "<span class='nb-cell-sub'>" + NBUi.esc(T("siklus.hanyaBaca")) + "</span>";
    }
    var tombol = [];
    if (c.status === "DRAFT") tombol.push(["OPEN", "siklus.aksiBuka", "nb-btn-primary"]);
    if (c.status === "OPEN") {
      tombol.push(["LOCKED", "siklus.aksiTutupKumpul", "nb-btn-outline"]);
      tombol.push(["CLOSED", "siklus.aksiTutup", "nb-btn-soft-danger"]);
    }
    if (c.status === "LOCKED") {
      tombol.push(["OPEN", "siklus.aksiBukaKumpul", "nb-btn-outline"]);
      tombol.push(["CLOSED", "siklus.aksiTutup", "nb-btn-soft-danger"]);
    }
    if (c.status === "CLOSED") tombol.push(["OPEN", "siklus.aksiBukaUlang", "nb-btn-ghost-danger"]);

    return tombol.map(function (t) {
      return "<button class='nb-btn " + t[2] + "' data-status='" + t[0] + "'>" + NBUi.esc(T(t[1])) + "</button>";
    }).join("");
  }

  function panelSnapshot(u, c) {
    var daftar = NBStore.snapshotSiklus(c.cycle_id);
    var aktif = NBStore.snapshotAktif(c.cycle_id);
    var bolehRilis = NBRbac.can(u, "snapshot.upload") && c.status !== "CLOSED";

    var isi;
    if (!daftar.length) {
      isi = NBUi.kosong(T("snap.belumJudul"), T("snap.belumSub"), NBUi.svg("layers"));
    } else {
      isi = "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
        "<th>" + NBUi.esc(T("snap.thSnapshot")) + "</th>" +
        "<th>" + NBUi.esc(T("snap.thBerlaku")) + "</th>" +
        "<th>" + NBUi.esc(T("snap.thDirilis")) + "</th>" +
        "<th>" + NBUi.esc(T("snap.thSumber")) + "</th>" +
        "<th class='nb-num'>" + NBUi.esc(T("snap.thBaris")) + "</th>" +
        "<th class='nb-num'>" + NBUi.esc(T("snap.thVacancy")) + "</th><th></th>" +
        "</tr></thead><tbody>" +
        daftar.map(function (s) {
          var perilis = (NBStore.pengguna(s.released_by) || {}).name;
          return "<tr><td><span class='nb-code'>" + NBUi.esc(s.snapshot_id) + "</span>" +
            (aktif && s.snapshot_id === aktif.snapshot_id ? " " + NBUi.badge(T("snap.aktif"), "is-emerald") : "") + "</td>" +
            "<td>" + NBFormat.tanggal(s.effective_date) + "</td>" +
            "<td>" + NBFormat.tanggalPendek(s.released_at) +
              "<div class='nb-cell-sub'>" + NBUi.esc(perilis || s.released_by) + "</div></td>" +
            "<td class='nb-cell-sub'>" + NBUi.esc(s.source) + "</td>" +
            "<td class='nb-num'>" + NBFormat.angka(NBStore.snapshotBarisTerlihat(s.snapshot_id).length) + "</td>" +
            "<td class='nb-num'>" + NBFormat.angka((s.vacancy_ids || []).length) + "</td>" +
            "<td class='nb-num'><button class='nb-btn nb-btn-outline' data-lihat='" + s.snapshot_id + "'>" +
              NBUi.esc(T("snap.lihat")) + "</button></td>" +
          "</tr>";
        }).join("") + "</tbody></table></div>";
    }

    var formulir = bolehRilis
      ? "<div class='nb-setting'><div style='flex:1'>" +
          "<div class='nb-setting-label'>" + NBUi.esc(T("snap.rilisJudul")) + "</div>" +
          "<div class='nb-setting-desc'>" + NBUi.esc(T("snap.rilisSub")) + "</div></div>" +
          "<input type='date' class='nb-input' id='snapDate' value='" + NBUi.esc(c.start_date) +
            "' style='width:200px'>" +
          "<button class='nb-btn nb-btn-primary' id='snapRilis'>" +
            NBUi.esc(T("snap.rilisTombol", { v: daftar.length + 1 })) + "</button></div>"
      : "";

    return "<div class='nb-card' style='margin-bottom:24px'>" +
      "<div class='nb-toolbar'><div><div style='font-weight:600'>" + NBUi.esc(T("snap.judul")) + "</div>" +
      "<div class='nb-cell-sub'>" + NBUi.esc(T("snap.sub", { name: c.name })) + "</div></div></div>" +
      (formulir ? "<div style='padding:0 20px 4px'>" + formulir + "</div>" : "") +
      isi + "</div>";
  }

  function panelIsiSnapshot() {
    if (!state.snapshot_id) return "";
    var s = NBStore.snapshot(state.snapshot_id);
    if (!s) return "";
    var baris = NBStore.snapshotBarisTerlihat(s.snapshot_id);
    var beda = NBStore.bandingkanSnapshot(s.snapshot_id);

    var tabelBeda = beda.length
      ? "<div class='nb-tablewrap' style='border:1px solid var(--nb-gray-200);margin-top:12px'>" +
        "<table class='nb-table'><thead><tr>" +
        "<th>" + NBUi.esc(T("umum.karyawan")) + "</th>" +
        "<th>" + NBUi.esc(T("snap.thField")) + "</th>" +
        "<th>" + NBUi.esc(T("snap.thNilaiSnap")) + "</th>" +
        "<th>" + NBUi.esc(T("snap.thNilaiMaster")) + "</th></tr></thead><tbody>" +
        beda.map(function (b) {
          return "<tr><td><div class='nb-cell-title'>" + NBUi.esc(b.nama) + "</div>" +
            "<div class='nb-cell-sub nb-mono'>" + NBUi.esc(b.employee_id) + "</div></td>" +
            "<td class='nb-mono'>" + NBUi.esc(b.field) + "</td>" +
            "<td>" + NBUi.badge(b.snapshot, "is-blue") + "</td>" +
            "<td>" + NBUi.badge(b.master, "is-amber") +
              "<div class='nb-cell-sub'>" + NBUi.esc(b.sumber === "realisasi"
                ? T("snap.sumberRealisasi", { id: b.actual_id })
                : (b.sumber === "impor" ? T("snap.sumberImpor") : T("snap.sumberMaster"))) + "</div></td></tr>";
        }).join("") + "</tbody></table></div>"
      : "<p class='nb-cell-sub' style='margin-top:12px'>" + NBUi.esc(T("snap.buktiKosong")) + "</p>";

    return "<div class='nb-card nb-card-pad'>" +
      "<div class='nb-card-head'>" + NBUi.svg("layers") + "<div>" +
        "<h3>" + NBUi.esc(T("snap.isiJudul", { id: s.snapshot_id })) + "</h3>" +
        "<p>" + NBUi.esc(T("snap.isiSub", {
            tgl: NBFormat.tanggal(s.effective_date), n: NBFormat.angka(baris.length) })) + "</p></div></div>" +

      "<div class='nb-tablewrap' style='border:1px solid var(--nb-gray-200)'><table class='nb-table'><thead><tr>" +
      "<th>" + NBUi.esc(T("umum.nik")) + "</th>" +
      "<th>" + NBUi.esc(T("umum.karyawan")) + "</th>" +
      "<th>" + NBUi.esc(T("umum.departemen")) + "</th>" +
      "<th>" + NBUi.esc(T("snap.thGrade")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("snap.thHc")) + "</th>" +
      "</tr></thead><tbody>" +
      (baris.length ? baris.slice(0, BATAS_BARIS).map(function (l) {
        var d = NBStore.departemen(l.department_id);
        return "<tr><td><span class='nb-code'>" + NBUi.esc(l.employee_id) + "</span></td>" +
          "<td><div class='nb-cell-title'>" + NBUi.esc(l.employee_name) + "</div>" +
            "<div class='nb-cell-sub'>" + NBUi.esc(l.position_title) + "</div></td>" +
          "<td>" + NBUi.esc(d ? d.name : l.department_id) + "</td>" +
          "<td>" + NBUi.badge(l.grade_id, "is-plain") + "</td>" +
          "<td class='nb-num'>" + l.current_hc + "</td></tr>";
      }).join("") : "<tr><td colspan='5'>" + NBUi.kosong(T("snap.kosong"), "") + "</td></tr>") +
      "</tbody></table></div>" +
      (baris.length > BATAS_BARIS
        ? "<p class='nb-cell-sub' style='margin-top:8px'>" +
          NBUi.esc(T("snap.potong", { n: BATAS_BARIS, total: NBFormat.angka(baris.length) })) + "</p>"
        : "") +

      "<h4 class='nb-head' style='font-size:14px;margin:20px 0 0'>" + NBUi.esc(T("snap.buktiJudul")) + "</h4>" +
      "<p class='nb-cell-sub' style='margin:4px 0 0'>" + NBUi.esc(T("snap.buktiSub")) + "</p>" +
      tabelBeda + "</div>";
  }

  function render() {
    var u = NBStore.user();
    var c = siklusTerpilih();
    if (!c) return "<div class='nb-card'>" + NBUi.kosong(T("dash.siklusKosong"), T("dash.siklusKosongSub")) + "</div>";
    state.cycle_id = c.cycle_id;
    var st = STATUS[c.status];
    var snap = NBStore.snapshotAktif(c.cycle_id);

    var formBaru = NBRbac.can(u, "cycle.create")
      ? "<div class='nb-card nb-card-pad' style='margin-bottom:24px'>" +
        "<div class='nb-card-head'>" + NBUi.svg("layers") + "<div>" +
        "<h3>" + NBUi.esc(T("siklus.buatJudul")) + "</h3>" +
        "<p>" + NBUi.esc(T("siklus.buatSub")) + "</p></div></div>" +
        "<div style='display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px'>" +
          "<div><div class='nb-field-label'>" + NBUi.esc(T("siklus.fTahun")) +
            "</div><input class='nb-input' id='cyYear' type='number' value='2028'></div>" +
          "<div><div class='nb-field-label'>" + NBUi.esc(T("siklus.fMulai")) +
            "</div><input class='nb-input' id='cyStart' type='date' value='2027-09-01'></div>" +
          "<div><div class='nb-field-label'>" + NBUi.esc(T("siklus.fSelesai")) +
            "</div><input class='nb-input' id='cyEnd' type='date' value='2028-12-31'></div>" +
          "<div><div class='nb-field-label'>" + NBUi.esc(T("siklus.fBatas")) +
            "</div><input class='nb-input' id='cyDl' type='date' value='2027-10-15'></div>" +
        "</div><div class='nb-formfoot'><button class='nb-btn nb-btn-primary' id='cyBuat'>" +
          NBUi.esc(T("siklus.buatTombol")) + "</button></div></div>"
      : "";

    return "" +
    "<div class='nb-pagehead'><div>" +
      "<h1>" + NBUi.esc(T("siklus.judul")) + "</h1>" +
      "<p>" + NBUi.esc(T("siklus.sub")) + "</p></div>" +
    NBUi.badge(c.name + " " + T(st.label), st.badge) + "</div>" +

    "<div class='nb-kpigrid'>" +
      NBUi.kpi(T("siklus.kpiAktif"), NBUi.esc(c.name), "layers", "", T(st.ket)) +
      NBUi.kpi(T("siklus.kpiVersi"), "v" + c.version, "shield", "is-violet",
               c.reopen_reason ? T("siklus.pernahBuka") : T("siklus.belumBuka")) +
      NBUi.kpi(T("siklus.kpiSnapshot"),
               snap ? T("umum.baris", { n: NBFormat.angka(NBStore.snapshotBarisTerlihat(snap.snapshot_id).length) })
                    : T("umum.belumAda"),
               "building", snap ? "is-emerald" : "is-amber",
               snap ? T("siklus.snapshotNote", { id: snap.snapshot_id, tgl: NBFormat.tanggalPendek(snap.released_at) })
                    : T("siklus.snapshotBelum")) +
      NBUi.kpi(T("siklus.kpiBatas"), NBFormat.tanggalPendek(c.submission_deadline), "chart", "is-blue") +
    "</div>" +

    "<div class='nb-card' style='margin-bottom:24px'>" +
      "<div class='nb-toolbar'><div><div style='font-weight:600'>" + NBUi.esc(T("siklus.daftar")) + "</div>" +
      "<div class='nb-cell-sub'>" + NBUi.esc(T("siklus.daftarSub")) + "</div></div>" +
      "<div style='display:flex;gap:8px;flex-wrap:wrap'>" + aksiSiklus(u, c) +
        (NBRbac.can(u, "admin")
          ? "<button class='nb-btn nb-btn-quiet' id='cyReset'>" + NBUi.esc(T("siklus.aksiReset")) + "</button>"
          : "") +
      "</div></div>" +
      "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
      "<th>" + NBUi.esc(T("siklus.thSiklus")) + "</th>" +
      "<th>" + NBUi.esc(T("umum.status")) + "</th>" +
      "<th>" + NBUi.esc(T("siklus.thPeriode")) + "</th>" +
      "<th>" + NBUi.esc(T("siklus.thBatas")) + "</th>" +
      "<th>" + NBUi.esc(T("siklus.thSnapshot")) + "</th>" +
      "</tr></thead><tbody>" +
      NBStore.semuaSiklus().map(function (x) { return barisSiklus(x, c.cycle_id); }).join("") +
      "</tbody></table></div></div>" +

    formBaru +
    panelSnapshot(u, c) +
    panelIsiSnapshot();
  }

  function mount() {
    document.querySelectorAll("tr[data-cycle]").forEach(function (tr) {
      tr.onclick = function () {
        state.cycle_id = tr.dataset.cycle;
        state.snapshot_id = null;
        NBApp.ulang();
      };
    });

    document.querySelectorAll("button[data-status]").forEach(function (b) {
      b.onclick = function () {
        var target = b.dataset.status;
        var c = siklusTerpilih();
        function jalankan(alasan) {
          var hasil = NBStore.ubahStatusSiklus(c.cycle_id, target, alasan);
          NBUi.toast(hasil.ok ? T("siklus.statusBerhasil") : hasil.alasan, hasil.ok ? "ok" : "error");
          if (hasil.ok) NBApp.ulang();
        }
        if (c.status === "CLOSED" && target === "OPEN") {
          NBUi.konfirmasi({
            judul: T("siklus.aksiBukaUlang"), pesan: T("siklus.bukaUlangTanya", { name: c.name }),
            perluAlasan: true, labelAlasan: T("review.alasanLabel"),
            pesanAlasan: T("review.errAlasan"), ok: T("siklus.aksiBukaUlang"),
            batal: T("umum.batal"), gaya: "nb-btn-ghost-danger"
          }, jalankan);
          return;
        }
        if (target === "CLOSED") {
          NBUi.konfirmasi({
            judul: T("siklus.aksiTutup"), pesan: T("siklus.tutupTanya", { name: c.name }),
            ok: T("siklus.aksiTutup"), batal: T("umum.batal"), gaya: "nb-btn-soft-danger"
          }, function () { jalankan(null); });
          return;
        }
        jalankan(null);
      };
    });

    var reset = document.getElementById("cyReset");
    if (reset) reset.onclick = function () {
      NBUi.konfirmasi({
        judul: T("siklus.aksiReset"), pesan: T("siklus.resetTanya"),
        ok: T("siklus.aksiReset"), batal: T("umum.batal"), gaya: "nb-btn-soft-danger"
      }, function () {
        var hasil = NBStore.reset();
        NBUi.toast(hasil.ok ? T("siklus.resetBerhasil") : hasil.alasan, hasil.ok ? "ok" : "error");
        if (hasil.ok) { state.cycle_id = null; state.snapshot_id = null; NBApp.ulang(); }
      });
    };

    var buat = document.getElementById("cyBuat");
    if (buat) buat.onclick = function () {
      var hasil = NBStore.buatSiklus({
        year: document.getElementById("cyYear").value,
        start_date: document.getElementById("cyStart").value,
        end_date: document.getElementById("cyEnd").value,
        submission_deadline: document.getElementById("cyDl").value
      });
      NBUi.toast(hasil.ok ? T("siklus.buatBerhasil") : hasil.alasan, hasil.ok ? "ok" : "error");
      if (hasil.ok) { state.cycle_id = hasil.siklus.cycle_id; NBApp.ulang(); }
    };

    var rilis = document.getElementById("snapRilis");
    if (rilis) rilis.onclick = function () {
      var c = siklusTerpilih();
      var hasil = NBStore.rilisSnapshot(c.cycle_id, document.getElementById("snapDate").value);
      NBUi.toast(hasil.ok ? T("snap.rilisBerhasil", { id: hasil.snapshot.snapshot_id }) : hasil.alasan,
                 hasil.ok ? "ok" : "error");
      if (hasil.ok) { state.snapshot_id = hasil.snapshot.snapshot_id; NBApp.ulang(); }
    };

    document.querySelectorAll("button[data-lihat]").forEach(function (b) {
      b.onclick = function () { state.snapshot_id = b.dataset.lihat; NBApp.ulang(); };
    });
  }

  global.NBPages = global.NBPages || {};
  global.NBPages.siklus = { render: render, mount: mount };
})(window);
