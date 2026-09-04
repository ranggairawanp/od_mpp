// Layar Data Organisasi. Membuktikan tiga sumbu akses sekaligus:
// kapabilitas peran, lingkup baris, dan kolom biaya.
(function (global) {
  "use strict";

  var T = function (k, v) { return NBi18n.t(k, v); };
  var state = { department_id: "", q: "" };
  var BATAS_BARIS = 200;

  function barisKaryawan(u, list) {
    var bolehUbah = NBRbac.can(u, "master.employee.edit");
    var kolom = bolehUbah ? 7 : 6;

    if (!list.length) {
      return "<tr><td colspan='" + kolom + "'>" +
        NBUi.kosong(T("org.kosong"), T("org.kosongSub")) + "</td></tr>";
    }

    // Ditemukan saat uji beban: menggambar 32.000 baris memakan 45 detik dan membekukan
    // peramban. Tabel dibatasi, sisanya dicari lewat kotak pencarian.
    var dipotong = list.length > BATAS_BARIS;
    return list.slice(0, BATAS_BARIS).map(function (e) {
      var p = NBStore.posisi(e.position_id);
      var d = NBStore.departemen(e.department_id);
      var g = NBStore.grade(e.grade_id);
      var rentang = NBRbac.canSeeCost(u, e.department_id)
        ? "<span class='nb-mono'>" + NBUi.esc(T("org.rentang", {
            min: NBFormat.rupiahRingkas(g.min), max: NBFormat.rupiahRingkas(g.max) })) + "</span>"
        : "<span class='nb-muted'>" + NBUi.svg("lock") + "</span>";

      return "<tr>" +
        "<td><span class='nb-code'>" + NBUi.esc(e.employee_id) + "</span>" +
          (e.sementara ? "<div class='nb-cell-sub' style='color:var(--nb-amber-fg)'>" + NBUi.esc(T("org.sementara")) + "</div>" : "") +
          "</td>" +
        "<td><div class='nb-cell-person'><span class='nb-avatar nb-avatar-sm nb-avatar-soft'>" +
            NBUi.esc(e.name.charAt(0)) + "</span><div>" +
            "<div class='nb-cell-title'>" + NBUi.esc(e.name) + "</div>" +
            "<div class='nb-cell-sub'>" + NBUi.esc(p ? p.title : "-") + "</div></div></div></td>" +
        "<td>" + NBUi.esc(d ? d.name : "-") +
            "<div class='nb-cell-sub nb-mono'>" + NBUi.esc(e.cost_center_id) + "</div></td>" +
        "<td>" + NBUi.badge(e.grade_id, "is-plain") +
            "<div class='nb-cell-sub'>" + NBUi.esc(g ? g.label : "") + "</div></td>" +
        "<td>" + NBUi.badge(e.employment_status, e.employment_status === "Tetap" ? "is-emerald" : "is-amber") + "</td>" +
        "<td class='nb-num'>" + rentang + "</td>" +
        (bolehUbah
          ? "<td class='nb-num'><button class='nb-btn nb-btn-outline' data-edit='" + e.employee_id + "'>" +
            NBUi.esc(T("umum.ubah")) + "</button></td>"
          : "") +
      "</tr>";
    }).join("") +
    (dipotong
      ? "<tr><td colspan='" + kolom + "'><div class='nb-cell-sub' style='padding:8px 0'>" +
        NBUi.esc(T("org.potong", { n: BATAS_BARIS, total: NBFormat.angka(list.length) })) +
        "</div></td></tr>"
      : "");
  }

  function panelCatatan(u) {
    if (!NBRbac.can(u, "dept.note.edit")) return "";
    var deps = NBStore.departemenTerlihat();
    if (!deps.length) return "";
    var pilihan = deps.map(function (d) {
      return "<option value='" + d.department_id + "'>" + NBUi.esc(d.name) + "</option>";
    }).join("");

    return "<div class='nb-card nb-card-pad' style='margin-bottom:24px'>" +
      "<div class='nb-card-head'>" + NBUi.svg("save") + "<div>" +
        "<h3>" + NBUi.esc(T("org.catatan")) + "</h3>" +
        "<p>" + NBUi.esc(T("org.catatanSub")) + "</p>" +
      "</div></div>" +
      "<div class='nb-setting'><div style='flex:1'>" +
          "<div class='nb-setting-label'>" + NBUi.esc(T("umum.departemen")) + "</div>" +
          "<select class='nb-select' id='noteDept' style='margin-top:8px;width:100%'>" + pilihan + "</select>" +
          "<textarea class='nb-input' id='noteText' rows='3' style='margin-top:12px;resize:vertical' " +
            "placeholder='" + NBUi.esc(T("org.catatanPlaceholder")) + "'></textarea>" +
      "</div></div>" +
      "<div class='nb-formfoot'><button class='nb-btn nb-btn-primary' id='noteSave'>" +
        NBUi.svg("save") + NBUi.esc(T("umum.simpan")) + "</button></div>" +
    "</div>";
  }

  // Koreksi master mensimulasikan perbaikan data dari HRIS di tengah tahun.
  // Snapshot yang sudah dirilis tidak boleh ikut berubah (FR-02, bab 5.2).
  function modalEdit() {
    return "<div class='nb-overlay' id='mEdit' hidden><div class='nb-modal' style='max-width:560px'>" +
      "<div class='nb-modal-head'><div class='nb-modal-id'>" +
        "<span class='nb-avatar nb-avatar-lg' id='mAvatar'></span><div>" +
        "<div class='nb-modal-title'><h2 id='mNama'></h2></div>" +
        "<div class='nb-metachips'><span class='nb-metachip is-code' id='mNik'></span>" +
        "<span class='nb-metachip' id='mPosisi'></span></div></div></div>" +
        "<button class='nb-iconbtn' data-tutup='1'>&times;</button></div>" +
      "<div class='nb-modal-body'><div class='nb-section'>" +
        "<div class='nb-section-head'><span class='nb-roman'>I</span><h4>" +
          NBUi.esc(T("org.koreksiJudul")) + "</h4></div>" +
        "<div class='nb-fields'>" +
          "<div><div class='nb-field-label'>" + NBUi.esc(T("umum.grade")) +
            "</div><select class='nb-select' id='mGrade'></select></div>" +
          "<div><div class='nb-field-label'>" + NBUi.esc(T("umum.departemen")) +
            "</div><select class='nb-select' id='mDept'></select></div>" +
        "</div>" +
        "<div style='margin-top:16px'><div class='nb-field-label'>" + NBUi.esc(T("org.koreksiAlasan")) + "</div>" +
        "<input class='nb-input' id='mAlasan' placeholder='" + NBUi.esc(T("org.koreksiAlasanPlaceholder")) + "'></div>" +
        "<p class='nb-cell-sub' style='margin-top:12px'>" + NBUi.esc(T("org.koreksiCatatan")) + "</p>" +
      "</div></div>" +
      "<div class='nb-modal-foot'><button class='nb-btn nb-btn-quiet' data-tutup='1'>" +
        NBUi.esc(T("umum.batal")) + "</button>" +
      "<div class='nb-group'><button class='nb-btn nb-btn-primary' id='mSimpan'>" +
        NBUi.esc(T("org.koreksiSimpan")) + "</button></div></div>" +
    "</div></div>";
  }

  function render() {
    var u = NBStore.user();
    var deps = NBStore.departemenTerlihat();
    var list = NBStore.karyawanTerlihat(state);

    var opsiDept = "<option value=''>" + NBUi.esc(T("umum.semua")) + "</option>" +
      deps.map(function (d) {
        return "<option value='" + d.department_id + "'" +
               (state.department_id === d.department_id ? " selected" : "") + ">" +
               NBUi.esc(d.name) + "</option>";
      }).join("");

    return "" +
    "<div class='nb-pagehead'><div>" +
      "<h1>" + NBUi.esc(T("org.judul")) + "</h1>" +
      "<p>" + NBUi.esc(T("org.sub")) + "</p></div>" +
      NBUi.badge(T("org.barisLingkup", { n: NBFormat.angka(list.length) }), "is-plain") +
    "</div>" +

    panelCatatan(u) +

    "<div class='nb-card'>" +
      "<div class='nb-toolbar'>" +
        "<div style='display:flex;gap:12px;align-items:center'>" +
          "<select class='nb-select' id='fDept' style='width:240px'>" + opsiDept + "</select>" +
        "</div>" +
        "<label class='nb-search'>" + NBUi.svg("search") +
          "<input class='nb-input' id='fQ' value='" + NBUi.esc(state.q) + "' placeholder='" +
          NBUi.esc(T("org.cari")) + "'></label>" +
      "</div>" +
      "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
        "<th>" + NBUi.esc(T("umum.nik")) + "</th>" +
        "<th>" + NBUi.esc(T("umum.karyawan")) + "</th>" +
        "<th>" + NBUi.esc(T("umum.departemen")) + "</th>" +
        "<th>" + NBUi.esc(T("umum.grade")) + "</th>" +
        "<th>" + NBUi.esc(T("umum.status")) + "</th>" +
        "<th class='nb-num'>" + NBUi.esc(T("org.thRentang")) + "</th>" +
        (NBRbac.can(u, "master.employee.edit") ? "<th class='nb-num'>" + NBUi.esc(T("umum.aksi")) + "</th>" : "") +
      "</tr></thead><tbody>" + barisKaryawan(u, list) + "</tbody></table></div>" +
    "</div>" +
    (NBRbac.can(u, "master.employee.edit") ? modalEdit() : "");
  }

  function pasangEdit() {
    var modal = document.getElementById("mEdit");
    if (!modal) return;
    var aktif = null;

    function buka(id) {
      aktif = NBStore.karyawan(id);
      if (!aktif) return;
      var p = NBStore.posisi(aktif.position_id);
      document.getElementById("mAvatar").textContent = aktif.name.charAt(0);
      document.getElementById("mNama").textContent = aktif.name;
      document.getElementById("mNik").textContent = "# " + aktif.employee_id;
      document.getElementById("mPosisi").textContent = p ? p.title : "-";
      document.getElementById("mGrade").innerHTML = NBStore.semuaGrade().map(function (g) {
        return "<option value='" + g.grade_id + "'" + (g.grade_id === aktif.grade_id ? " selected" : "") +
               ">" + g.grade_id + " " + NBUi.esc(g.label) + "</option>";
      }).join("");
      document.getElementById("mDept").innerHTML = NBStore.departemenTerlihat().map(function (d) {
        return "<option value='" + d.department_id + "'" +
               (d.department_id === aktif.department_id ? " selected" : "") + ">" + NBUi.esc(d.name) + "</option>";
      }).join("");
      document.getElementById("mAlasan").value = "";
      modal.hidden = false;
    }

    document.querySelectorAll("button[data-edit]").forEach(function (b) {
      b.onclick = function () { buka(b.dataset.edit); };
    });
    modal.querySelectorAll("[data-tutup]").forEach(function (b) {
      b.onclick = function () { modal.hidden = true; };
    });
    modal.onclick = function (e) { if (e.target === modal) modal.hidden = true; };

    document.getElementById("mSimpan").onclick = function () {
      if (!aktif) return;
      var alasan = document.getElementById("mAlasan").value.trim();
      if (!alasan) { NBUi.toast(T("org.koreksiAlasanWajib"), "error"); return; }
      var berubah = false;
      [["grade_id", document.getElementById("mGrade").value],
       ["department_id", document.getElementById("mDept").value]].forEach(function (pair) {
        var hasil = NBStore.ubah("Employee", aktif.employee_id, pair[0], pair[1], {
          capability: "master.employee.edit",
          key: "audit.d.masterFix", vars: { name: aktif.name },
          reason: alasan
        });
        if (hasil.ok && !hasil.tidakBerubah) berubah = true;
        if (!hasil.ok) NBUi.toast(hasil.alasan, "error");
      });
      modal.hidden = true;
      NBUi.toast(berubah ? T("org.koreksiBerhasil") : T("umum.tidakBerubah"));
      if (berubah) NBApp.ulang();
    };
  }

  function mount() {
    var u = NBStore.user();

    var fd = document.getElementById("fDept");
    if (fd) fd.onchange = function () { state.department_id = this.value; NBApp.ulang(); };

    var fq = document.getElementById("fQ");
    if (fq) {
      fq.oninput = function () {
        state.q = this.value;
        var tbody = document.querySelector(".nb-table tbody");
        if (tbody) tbody.innerHTML = barisKaryawan(u, NBStore.karyawanTerlihat(state));
        pasangEdit();
      };
    }

    var sel = document.getElementById("noteDept");
    var txt = document.getElementById("noteText");
    if (sel && txt) {
      var muat = function () {
        var d = NBStore.departemen(sel.value);
        txt.value = d ? (d.note || "") : "";
      };
      sel.onchange = muat; muat();

      document.getElementById("noteSave").onclick = function () {
        var hasil = NBStore.ubah("Department", sel.value, "note", txt.value.trim(), {
          capability: "dept.note.edit",
          key: "audit.d.deptNote", vars: { name: (NBStore.departemen(sel.value) || {}).name }
        });
        if (!hasil.ok) { NBUi.toast(hasil.alasan, "error"); return; }
        if (hasil.tidakBerubah) { NBUi.toast(T("umum.tidakBerubah")); return; }
        NBUi.toast(T("org.catatanTersimpan"));
      };
    }

    pasangEdit();
  }

  global.NBPages = global.NBPages || {};
  global.NBPages.organisasi = { render: render, mount: mount };
})(window);
