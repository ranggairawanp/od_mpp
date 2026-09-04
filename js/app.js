// Shell dan router. Satu halaman, navigasi berbasis hash, tanpa build step.
// Navigasi dirakit dari kapabilitas peran, bukan disembunyikan dengan CSS.
(function (global) {
  "use strict";

  // Layar mengikuti inventaris bab 25. cap null berarti terbuka untuk semua peran yang login.
  var RUTE = [
    { id: "dashboard",   i18n: "nav.dashboard",   cap: null },
    { id: "eksekutif",   i18n: "nav.eksekutif",   cap: "exec.view" },
    { id: "organisasi",  i18n: "nav.organisasi",  cap: null },
    { id: "bagan",       i18n: "nav.bagan",       cap: null },
    { id: "siklus",      i18n: "nav.siklus",      cap: null },
    { id: "planning",    i18n: "nav.planning",    cap: "plan.create" },
    { id: "usulan",      i18n: "nav.usulan",      cap: "plan.review" },
    { id: "konsolidasi", i18n: "nav.konsolidasi", cap: "consolidate" },
    { id: "biaya",       i18n: "nav.biaya",       cap: "cost.view" },
    { id: "review",      i18n: "nav.review",      cap: "review.decide", capAlt: "review.support" },
    { id: "approved",    i18n: "nav.approved",    cap: null },
    { id: "monitoring",  i18n: "nav.monitoring",  cap: null },
    { id: "matriks",     i18n: "nav.matriks",     cap: null },
    { id: "laporan",     i18n: "nav.laporan",     cap: null },
    { id: "audit",       i18n: "nav.audit",       cap: null },
    { id: "data",        i18n: "nav.data",        cap: null },
    { id: "admin",       i18n: "nav.admin",       cap: "admin" }
  ];

  function bolehLihat(u, r) {
    if (!r.cap) return true;
    return NBRbac.can(u, r.cap) || (r.capAlt && NBRbac.can(u, r.capAlt)) ||
           (r.cap === "cost.view" && NBRbac.can(u, "cost.view.own"));
  }

  function rutuSaatIni() {
    var h = (location.hash || "#dashboard").replace("#", "");
    return RUTE.filter(function (r) { return r.id === h; })[0] || RUTE[0];
  }

  function gambarNav() {
    var u = NBStore.user();
    var nav = document.getElementById("nbNav");
    var aktif = rutuSaatIni().id;
    nav.innerHTML = RUTE.filter(function (r) { return bolehLihat(u, r); }).map(function (r) {
      return "<a class='nb-nav-item" + (r.id === aktif ? " is-active" : "") + "' href='#" + r.id + "'>" +
             "<span data-i18n='" + r.i18n + "'>" + NBi18n.t(r.i18n) + "</span></a>";
    }).join("");
  }

  // Penanda siklus aktif di app bar. Semua modul berikutnya bergantung pada siklus ini,
  // jadi statusnya harus terlihat di setiap layar.
  function gambarSiklus() {
    var el = document.getElementById("nbCycle");
    if (!el) return;
    var c = NBStore.siklusAktif();
    if (!c) { el.style.display = "none"; return; }
    var peta = { DRAFT: "is-plain", OPEN: "is-blue", LOCKED: "is-amber", CLOSED: "is-emerald" };
    var kunci = { DRAFT: "siklus.stDraft", OPEN: "siklus.stOpen",
                  LOCKED: "siklus.stLocked", CLOSED: "siklus.stClosed" };
    el.className = "nb-badge " + (peta[c.status] || "");
    el.textContent = c.name + " \u00b7 " + (kunci[c.status] ? NBi18n.t(kunci[c.status]) : c.status);
    el.style.display = "inline-flex";
  }

  // Peringatan sekali jalan kalau penyimpanan sesi menolak menampung data.
  // Diam-diam kehilangan data jauh lebih buruk daripada memberi tahu apa adanya.
  var peringatanTampil = false;
  function gambarPeringatanSimpan() {
    if (peringatanTampil || !global.NBSimpanan || !NBSimpanan.statusSimpan) return;
    var g = NBSimpanan.statusSimpan();
    if (!g) return;
    peringatanTampil = true;
    NBUi.toast(NBi18n.t("umum.simpanGagal",
      { n: Math.round(g.ukuran / 1048576 * 10) / 10 }), "error");
  }

  // Nama entitas di app bar berasal dari berkas struktur, bukan teks tetap.
  function gambarEntitas() {
    var el = document.getElementById("nbEntity");
    if (!el) return;
    var ent = NBStore.semuaEntitas ? NBStore.semuaEntitas() : [];
    if (ent.length === 1) { el.textContent = ent[0].name; el.removeAttribute("data-i18n"); }
    else if (ent.length > 1) { el.textContent = NBi18n.t("umum.nEntitas", { n: ent.length }); el.removeAttribute("data-i18n"); }
  }

  function gambarIdentitas() {
    gambarEntitas();
    var u = NBStore.user();
    var deps = NBStore.departemenTerlihat();
    var lingkup = u.scope.type === "ALL"
      ? NBi18n.t("umum.semua")
      : deps.map(function (d) { return d.name; }).join(", ");
    document.getElementById("nbUser").innerHTML =
      "<div style='text-align:right' title='" + NBUi.esc(u.name + ", " + NBRbac.roleLabel(u.role) + ", " + lingkup) + "'>" +
        "<div style='font-weight:600;font-size:13px'>" + NBUi.esc(u.name) + "</div>" +
        "<div class='nb-cell-sub'>" + NBUi.esc(NBRbac.roleLabel(u.role)) + " &middot; " + NBUi.esc(lingkup) + "</div>" +
      "</div><span class='nb-avatar'>" + NBUi.esc(u.name.charAt(0)) + "</span>";
  }

  function ulang() {
    var u = NBStore.user();
    var chrome = document.getElementById("nbChrome");

    // Belum masuk: shell tetap dipakai, isinya pemilih persona.
    if (!u) {
      if (chrome) chrome.style.display = "none";
      document.getElementById("nbNav").innerHTML = "";
      var hostLogin = document.getElementById("nbPage");
      hostLogin.innerHTML = NBPages.login.render();
      NBPages.login.mount();
      NBi18n.apply(hostLogin);
      return;
    }
    if (chrome) chrome.style.display = "flex";
    var r = rutuSaatIni();

    // Penjagaan rute. Peran yang tidak berhak tidak bisa masuk lewat URL.
    if (!bolehLihat(u, r)) {
      NBAudit.tulis(u, "SCOPE_DENIED", "Screen", r.id, { key: "audit.d.denyScreen" });
      location.hash = "#dashboard";
      NBUi.toast(NBi18n.t("umum.aksesDitolak"), "error");
      ulang();
      return;
    }

    // Aplikasi kosong harus jujur (prinsip 4 fase 3). Selama struktur belum diunggah,
    // layar data menampilkan keadaan kosong yang menyebut berkas apa yang harus diunggah,
    // bukan tabel kosong tanpa keterangan. Impor, administrasi, dan audit tetap terbuka.
    var BEBAS = ["data", "admin", "audit"];
    if (BEBAS.indexOf(r.id) === -1 && NBStore.jumlahData().departemen === 0) {
      gambarNav(); gambarSiklus(); gambarIdentitas();
      document.getElementById("nbPage").innerHTML =
        "<div class='nb-pagehead'><div><h1>" + NBUi.esc(NBi18n.t("kosong.judul")) + "</h1>" +
        "<p>" + NBUi.esc(NBi18n.t("kosong.isi")) + "</p></div>" +
        (NBRbac.can(u, "admin")
          ? "<a class='nb-btn nb-btn-primary' href='#data'>" + NBUi.esc(NBi18n.t("nav.data")) + "</a>"
          : "") + "</div>" +
        "<div class='nb-card nb-card-pad'>" + [1, 2, 3, 4, 5, 6].map(function (n) {
          return "<div class='nb-setting' style='margin-bottom:8px'>" +
            NBUi.badge(String(n), "is-plain") + "<div style='flex:1'>" +
            NBUi.esc(NBi18n.t("kosong.langkah" + n)) + "</div></div>";
        }).join("") + "</div>";
      NBi18n.apply(document.getElementById("nbPage"));
      return;
    }

    // Mata uang mengikuti entitas dalam lingkup. Lebih dari satu entitas: tetap Rupiah,
    // dan kolom nominal per entitas lain menjadi pekerjaan lanjutan yang tercatat di batas.
    var entLingkup = {};
    NBStore.departemenTerlihat().forEach(function (d) {
      var e = NBStore.entitasDepartemen(d.department_id); if (e) entLingkup[e] = true;
    });
    var kodeEnt = Object.keys(entLingkup);
    var ent1 = kodeEnt.length === 1 ? NBStore.semuaEntitas().filter(function (e) { return e.entity_id === kodeEnt[0]; })[0] : null;
    NBFormat.setMataUang(ent1 ? ent1.currency : "IDR");

    var page = (global.NBPages || {})[r.id];
    var host = document.getElementById("nbPage");
    host.innerHTML = page ? page.render() : NBUi.kosong(NBi18n.t("umum.layarTidakAda"), "");
    if (page && page.mount) page.mount();
    NBi18n.apply(host);
    gambarNav();
    gambarSiklus();
    gambarIdentitas();
    gambarPeringatanSimpan();
    window.scrollTo(0, 0);
  }

  function mulai() {
    NBStore.pulihkanSesi();

    document.getElementById("nbLogout").onclick = function () {
      NBStore.keluar();
      location.hash = "#dashboard";
      ulang();
    };
    document.querySelectorAll(".nb-lang button").forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll(".nb-lang button").forEach(function (x) {
          x.classList.toggle("is-active", x === b);
        });
        NBi18n.set(b.dataset.lang);
        ulang();
      };
    });

    window.addEventListener("hashchange", ulang);
    if (!location.hash) location.hash = "#dashboard";
    NBi18n.apply(document);
    ulang();
  }

  global.NBApp = { mulai: mulai, ulang: ulang };
})(window);
