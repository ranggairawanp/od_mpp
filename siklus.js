// Layar Siklus MPP dan Snapshot. FR-01 dan FR-02.
// Snapshot yang sudah dirilis adalah state Current. Tidak pernah ditimpa, hanya ditambah versinya.
(function (global) {
  "use strict";

  var state = { cycle_id: null, snapshot_id: null, tab: "ringkas" };

  var STATUS_SIKLUS = {
    DRAFT:  { label: "Draft",             badge: "is-plain",   ket: "Belum dibuka untuk departemen" },
    OPEN:   { label: "Terbuka",           badge: "is-blue",    ket: "Departemen boleh menyusun usulan" },
    LOCKED: { label: "Pengumpulan Ditutup",badge: "is-amber",  ket: "Usulan baru tidak diterima" },
    CLOSED: { label: "Ditutup",           badge: "is-emerald", ket: "Read only sesuai BR-09" }
  };

  function siklusTerpilih() {
    var c = state.cycle_id ? NBStore.siklus(state.cycle_id) : null;
    return c || NBStore.siklusAktif();
  }

  function kartuSiklus(c, aktifId) {
    var st = STATUS_SIKLUS[c.status] || { label: c.status, badge: "" };
    var snap = NBStore.snapshotAktif(c.cycle_id);
    return "<tr class='" + (c.cycle_id === aktifId ? "is-active" : "") + "' data-cycle='" + c.cycle_id + "' style='cursor:pointer'>" +
      "<td><div class='nb-cell-title'>" + NBUi.esc(c.name) + "</div>" +
        "<div class='nb-cell-sub nb-mono'>" + NBUi.esc(c.cycle_id) + " v" + c.version + "</div></td>" +
      "<td>" + NBUi.badge(st.label, st.badge) + "<div class='nb-cell-sub'>" + NBUi.esc(st.ket) + "</div></td>" +
      "<td>" + NBFormat.tanggalPendek(c.start_date) + " sampai " + NBFormat.tanggalPendek(c.end_date) + "</td>" +
      "<td>" + NBFormat.tanggalPendek(c.submission_deadline) + "</td>" +
      "<td>" + (snap ? "<span class='nb-mono'>" + NBUi.esc(snap.snapshot_id) + "</span>" +
                 "<div class='nb-cell-sub'>" + NBFormat.angka(snap.line_count) + " baris</div>"
               : "<span class='nb-muted'>Belum ada</span>") + "</td>" +
    "</tr>";
  }

  function aksiSiklus(u, c) {
    if (!NBRbac.can(u, "cycle.create")) {
      return "<span class='nb-cell-sub'>Peran Anda hanya membaca siklus. Pengelolaan siklus milik OD.</span>";
    }
    var tombol = [];
    if (c.status === "DRAFT") tombol.push(["OPEN", "Buka siklus", "nb-btn-primary"]);
    if (c.status === "OPEN") {
      tombol.push(["LOCKED", "Tutup pengumpulan", "nb-btn-outline"]);
      tombol.push(["CLOSED", "Tutup siklus", "nb-btn-soft-danger"]);
    }
    if (c.status === "LOCKED") {
      tombol.push(["OPEN", "Buka lagi pengumpulan", "nb-btn-outline"]);
      tombol.push(["CLOSED", "Tutup siklus", "nb-btn-soft-danger"]);
    }
    if (c.status === "CLOSED") tombol.push(["OPEN", "Buka ulang siklus", "nb-btn-ghost-danger"]);

    return tombol.map(function (t) {
      return "<button class='nb-btn " + t[2] + "' data-status='" + t[0] + "'>" + t[1] + "</button>";
    }).join("");
  }

  function panelSnapshot(u, c) {
    var daftar = NBStore.snapshotSiklus(c.cycle_id);
    var aktif = NBStore.snapshotAktif(c.cycle_id);
    var bolehRilis = NBRbac.can(u, "snapshot.upload") && c.status !== "CLOSED";

    var isi;
    if (!daftar.length) {
      isi = NBUi.kosong("Snapshot belum dirilis",
        "Selama snapshot belum ada, departemen tidak punya baseline Current untuk direncanakan. Ini prasyarat Modul 2.",
        NBUi.svg("layers"));
    } else {
      isi = "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
        "<th>Snapshot</th><th>Berlaku</th><th>Dirilis</th><th>Sumber</th>" +
        "<th class='nb-num'>Baris</th><th class='nb-num'>Vacancy</th><th></th>" +
        "</tr></thead><tbody>" +
        daftar.map(function (s) {
          var pengguna = (NBStore.karyawan(s.released_by) || {}).name;
          return "<tr><td><span class='nb-code'>" + NBUi.esc(s.snapshot_id) + "</span>" +
            (s === aktif ? " " + NBUi.badge("Aktif", "is-emerald") : "") + "</td>" +
            "<td>" + NBFormat.tanggal(s.effective_date) + "</td>" +
            "<td>" + NBFormat.tanggalPendek(s.released_at) +
              "<div class='nb-cell-sub'>" + NBUi.esc(pengguna || s.released_by) + "</div></td>" +
            "<td class='nb-cell-sub'>" + NBUi.esc(s.source) + "</td>" +
            "<td class='nb-num'>" + NBFormat.angka(s.line_count || (s.lines || []).length) + "</td>" +
            "<td class='nb-num'>" + NBFormat.angka((s.vacancy_ids || []).length) + "</td>" +
            "<td class='nb-num'><button class='nb-btn nb-btn-outline' data-lihat='" + s.snapshot_id + "'>Lihat isi</button></td>" +
          "</tr>";
        }).join("") + "</tbody></table></div>";
    }

    var formulir = bolehRilis
      ? "<div class='nb-setting'><div style='flex:1'>" +
          "<div class='nb-setting-label'>Rilis snapshot baru</div>" +
          "<div class='nb-setting-desc'>Menyalin seluruh data master organisasi menjadi baris beku. " +
          "Versi sebelumnya tidak dihapus.</div></div>" +
          "<input type='date' class='nb-select' id='snapDate' value='" + NBUi.esc(c.start_date) + "' style='width:200px'>" +
          "<button class='nb-btn nb-btn-primary' id='snapRilis'>Rilis V" +
            (daftar.length + 1) + "</button></div>"
      : "";

    return "<div class='nb-card' style='margin-bottom:24px'>" +
      "<div class='nb-toolbar'><div><div style='font-weight:600'>Snapshot struktur organisasi</div>" +
      "<div class='nb-cell-sub'>State Current untuk " + NBUi.esc(c.name) +
      ". Sekali dirilis, isinya tidak ikut berubah walaupun data master berubah.</div></div></div>" +
      (formulir ? "<div style='padding:0 20px 4px'>" + formulir + "</div>" : "") +
      isi + "</div>";
  }

  function panelIsiSnapshot() {
    if (!state.snapshot_id) return "";
    var s = NBStore.snapshot(state.snapshot_id);
    if (!s) return "";
    var u = NBStore.user();
    var izin = NBRbac.scopeDepartments(u, NBStore.semuaDepartemen());
    var baris = (s.lines || []).filter(function (l) { return izin.indexOf(l.department_id) !== -1; });
    var beda = NBStore.bandingkanSnapshot(s.snapshot_id);

    var tabelBeda = beda.length
      ? "<div class='nb-tablewrap' style='border:1px solid var(--nb-gray-200);margin-top:12px'>" +
        "<table class='nb-table'><thead><tr><th>Karyawan</th><th>Field</th>" +
        "<th>Nilai di snapshot</th><th>Nilai di master hari ini</th></tr></thead><tbody>" +
        beda.map(function (b) {
          return "<tr><td><div class='nb-cell-title'>" + NBUi.esc(b.nama) + "</div>" +
            "<div class='nb-cell-sub nb-mono'>" + NBUi.esc(b.employee_id) + "</div></td>" +
            "<td class='nb-mono'>" + NBUi.esc(b.field) + "</td>" +
            "<td>" + NBUi.badge(NBUi.esc(b.snapshot), "is-blue") + "</td>" +
            "<td>" + NBUi.badge(NBUi.esc(b.master), "is-amber") + "</td></tr>";
        }).join("") + "</tbody></table></div>"
      : "<p class='nb-cell-sub' style='margin-top:12px'>Tidak ada perbedaan. Snapshot ini masih identik dengan master.</p>";

    return "<div class='nb-card nb-card-pad'>" +
      "<div class='nb-card-head'>" + NBUi.svg("layers") + "<div>" +
        "<h3>Isi " + NBUi.esc(s.snapshot_id) + "</h3>" +
        "<p>Berlaku " + NBFormat.tanggal(s.effective_date) + ". Menampilkan " +
        NBFormat.angka(baris.length) + " baris dalam lingkup akses Anda dari total " +
        NBFormat.angka((s.lines || []).length) + " baris.</p></div></div>" +

      "<div class='nb-tablewrap' style='border:1px solid var(--nb-gray-200)'><table class='nb-table'><thead><tr>" +
      "<th>NIK</th><th>Karyawan</th><th>Departemen</th><th>Grade saat snapshot</th><th class='nb-num'>HC</th>" +
      "</tr></thead><tbody>" +
      (baris.length ? baris.slice(0, 200).map(function (l) {
        var d = NBStore.departemen(l.department_id);
        return "<tr><td><span class='nb-code'>" + NBUi.esc(l.employee_id) + "</span></td>" +
          "<td><div class='nb-cell-title'>" + NBUi.esc(l.employee_name) + "</div>" +
            "<div class='nb-cell-sub'>" + NBUi.esc(l.position_title) + "</div></td>" +
          "<td>" + NBUi.esc(d ? d.name : l.department_id) + "</td>" +
          "<td>" + NBUi.badge(l.grade_id, "is-plain") + "</td>" +
          "<td class='nb-num'>" + l.current_hc + "</td></tr>";
      }).join("") : "<tr><td colspan='5'>" + NBUi.kosong("Tidak ada baris dalam lingkup Anda", "") + "</td></tr>") +
      "</tbody></table></div>" +

      "<h4 class='nb-head' style='font-size:14px;margin:20px 0 0'>Bukti pembekuan: snapshot dibanding master</h4>" +
      "<p class='nb-cell-sub' style='margin:4px 0 0'>Daftar ini dihitung ulang setiap kali layar dibuka. " +
      "Kalau data master diubah setelah rilis, perbedaannya muncul di sini, bukan menimpa snapshot.</p>" +
      tabelBeda + "</div>";
  }

  function render() {
    var u = NBStore.user();
    var c = siklusTerpilih();
    if (!c) return "<div class='nb-card'>" + NBUi.kosong("Belum ada siklus MPP", "") + "</div>";
    state.cycle_id = c.cycle_id;
    var st = STATUS_SIKLUS[c.status];
    var snap = NBStore.snapshotAktif(c.cycle_id);

    var formBaru = NBRbac.can(u, "cycle.create")
      ? "<div class='nb-card nb-card-pad' style='margin-bottom:24px'>" +
        "<div class='nb-card-head'>" + NBUi.svg("layers") + "<div><h3>Buat siklus baru</h3>" +
        "<p>Satu siklus per tahun perencanaan. Batas pengumpulan dipakai untuk penanda keterlambatan (BR-H).</p></div></div>" +
        "<div style='display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px'>" +
          "<div><div class='nb-field-label'>Tahun</div><input class='nb-input' id='cyYear' type='number' value='2028'></div>" +
          "<div><div class='nb-field-label'>Mulai</div><input class='nb-input' id='cyStart' type='date' value='2027-09-01'></div>" +
          "<div><div class='nb-field-label'>Selesai</div><input class='nb-input' id='cyEnd' type='date' value='2028-12-31'></div>" +
          "<div><div class='nb-field-label'>Batas pengumpulan</div><input class='nb-input' id='cyDl' type='date' value='2027-10-15'></div>" +
        "</div><div class='nb-formfoot'><button class='nb-btn nb-btn-primary' id='cyBuat'>Buat siklus</button></div></div>"
      : "";

    return "" +
    "<div class='nb-pagehead'><div><h1>Siklus MPP &amp; Snapshot</h1>" +
    "<p>Pengelolaan siklus perencanaan dan pembekuan struktur organisasi sebagai baseline Current.</p></div>" +
    NBUi.badge(c.name + " " + st.label, st.badge) + "</div>" +

    "<div class='nb-kpigrid'>" +
      NBUi.kpi("Siklus aktif", NBUi.esc(c.name), "layers", "", st.ket) +
      NBUi.kpi("Versi siklus", "v" + c.version, "shield", "is-violet",
               c.reopen_reason ? "Pernah dibuka ulang" : "Belum pernah dibuka ulang") +
      NBUi.kpi("Snapshot Current", snap ? NBUi.esc(snap.snapshot_id) : "Belum ada", "building",
               snap ? "is-emerald" : "is-amber",
               snap ? NBFormat.angka(snap.line_count) + " baris beku" : "Departemen belum bisa merencanakan") +
      NBUi.kpi("Batas pengumpulan", NBFormat.tanggalPendek(c.submission_deadline), "chart", "is-blue") +
    "</div>" +

    "<div class='nb-card' style='margin-bottom:24px'>" +
      "<div class='nb-toolbar'><div><div style='font-weight:600'>Daftar siklus</div>" +
      "<div class='nb-cell-sub'>Klik baris untuk berpindah siklus.</div></div>" +
      "<div style='display:flex;gap:8px;flex-wrap:wrap'>" + aksiSiklus(u, c) + "</div></div>" +
      "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
      "<th>Siklus</th><th>Status</th><th>Periode</th><th>Batas pengumpulan</th><th>Snapshot aktif</th>" +
      "</tr></thead><tbody>" +
      NBStore.semuaSiklus().map(function (x) { return kartuSiklus(x, c.cycle_id); }).join("") +
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
        var alasan = null;
        if (c.status === "CLOSED" && target === "OPEN") {
          alasan = prompt("Alasan membuka ulang siklus " + c.name + ". Alasan wajib diisi dan tercatat di audit.");
          if (!alasan) return;
        }
        if (target === "CLOSED" && !confirm("Tutup siklus " + c.name + "? Setelah ditutup, siklus hanya bisa dibaca (BR-09).")) return;
        var hasil = NBStore.ubahStatusSiklus(c.cycle_id, target, alasan);
        NBUi.toast(hasil.ok ? "Status siklus diperbarui" : hasil.alasan, hasil.ok ? "ok" : "error");
        if (hasil.ok) NBApp.ulang();
      };
    });

    var buat = document.getElementById("cyBuat");
    if (buat) buat.onclick = function () {
      var hasil = NBStore.buatSiklus({
        year: document.getElementById("cyYear").value,
        start_date: document.getElementById("cyStart").value,
        end_date: document.getElementById("cyEnd").value,
        submission_deadline: document.getElementById("cyDl").value
      });
      NBUi.toast(hasil.ok ? "Siklus dibuat dalam status Draft" : hasil.alasan, hasil.ok ? "ok" : "error");
      if (hasil.ok) { state.cycle_id = hasil.siklus.cycle_id; NBApp.ulang(); }
    };

    var rilis = document.getElementById("snapRilis");
    if (rilis) rilis.onclick = function () {
      var c = siklusTerpilih();
      var hasil = NBStore.rilisSnapshot(c.cycle_id, document.getElementById("snapDate").value);
      NBUi.toast(hasil.ok ? "Snapshot " + hasil.snapshot.snapshot_id + " dirilis dan dibekukan" : hasil.alasan,
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
