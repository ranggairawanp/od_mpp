// Pemilih persona. Menjadi modul di dalam shell supaya aplikasi hanya punya satu titik masuk.
// Seluruh teks lewat NBi18n. Nama orang, jabatan, dan nama departemen tetap apa adanya
// karena itu isi data, bukan label antarmuka.
(function (global) {
  "use strict";

  var T = function (k, v) { return NBi18n.t(k, v); };

  function render() {
    var deps = NBStore.semuaDepartemen();

    var kartu = NBStore.semuaPengguna().map(function (u) {
      // Lingkup pohon menyimpan satu departemen jangkar, lingkup lama menyimpan daftar id.
      var idLingkup = u.scope.type === "TREE"
        ? [u.scope.department_id] : (u.scope.ids || []);
      var namaLingkup = u.scope.type === "ALL"
        ? T("umum.semua")
        : idLingkup.map(function (id) {
            var d = deps.filter(function (x) { return x.department_id === id; })[0];
            return d ? d.name : id;
          }).join(", ");
      var jml = NBRbac.scopeDepartments(u, deps).length;
      var semua = u.scope.type === "ALL";

      return "<button class='nb-card nb-card-pad persona' data-user='" + u.user_id + "' " +
        "style='text-align:left;cursor:pointer;font-family:inherit'>" +
        "<div style='display:flex;align-items:center;gap:12px;margin-bottom:12px'>" +
          "<span class='nb-avatar'>" + NBUi.esc(u.name.charAt(0)) + "</span>" +
          "<div style='min-width:0'>" +
            "<div style='font-weight:600'>" + NBUi.esc(u.name) + "</div>" +
            "<div class='nb-mono' style='font-size:12px;color:var(--nb-gray-500);" +
              "overflow-wrap:anywhere;line-height:1.4'>" + NBUi.esc(u.email) + "</div>" +
          "</div></div>" +
        "<div style='margin-bottom:8px'>" + NBUi.badge(NBRbac.roleLabel(u.role), "is-plain") + "</div>" +
        "<div class='nb-cell-sub'>" + NBUi.esc(u.title) + "<br>" +
          NBUi.esc(u.role === "ADMIN" ? T("login.admin") : semua
            ? T("login.lingkupSemua")
            : T("login.lingkup", {
                s: namaLingkup,
                d: jml === 1 ? T("umum.satuDept") : T("umum.nDept", { n: jml })
              })) + "</div></button>";
    }).join("");

    return "" +
      "<div class='nb-pagehead'><div>" +
        "<h1>" + NBUi.esc(T("login.judul")) + "</h1>" +
        "<p>" + NBUi.esc(T("login.sub")) + "</p>" +
      "</div></div>" +
      "<div style='display:grid;grid-template-columns:repeat(auto-fit,minmax(288px,1fr));" +
        "gap:14px;max-width:1220px'>" + kartu + "</div>" +
      "<div style='margin-top:28px;max-width:1220px;padding:16px 18px;border-radius:var(--nb-r-lg);" +
        "background:var(--nb-amber-bg);border:1px solid var(--nb-amber-bd);color:var(--nb-amber-fg);" +
        "font-size:13px;line-height:1.6'>" +
        "<b>" + NBUi.esc(T("login.batasJudul")) + "</b> " + NBUi.esc(T("login.batasTeks")) +
      "</div>" +
      "<div class='nb-cell-sub' style='margin-top:14px;max-width:1220px'>" +
        NBUi.esc(T("login.dataDimuat", { d: NBStore.jumlahData().departemen,
          k: NBFormat.angka(NBStore.jumlahData().karyawan) })) +
        " " + NBUi.esc(T("login.build", { b: (global.NB_BUILD || {}).build || 0, t: (global.NB_BUILD || {}).tanggal || "-" })) +
      "</div>";
  }

  function mount() {
    document.querySelectorAll("button[data-user]").forEach(function (b) {
      b.onclick = function () {
        NBStore.masuk(b.dataset.user);
        location.hash = "#dashboard";
        NBApp.ulang();
      };
    });
  }

  global.NBPages = global.NBPages || {};
  global.NBPages.login = { render: render, mount: mount };
})(window);
