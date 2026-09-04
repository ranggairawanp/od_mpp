// Layar Impor dan Ekspor Data.
// Alur yang dijaga: unduh templat, isi di Excel, unggah, lihat pratinjau, baru terapkan.
// Tidak ada jalur yang melewati validasi, dan tidak ada berkas yang langsung masuk
// tanpa pengguna melihat dulu berapa baris yang lolos dan berapa yang gagal.
(function (global) {
  "use strict";

  var T = function (k, v) { return NBi18n.t(k, v); };
  var state = { berkas: "USULAN", pratinjau: null, namaBerkas: null };

  function daftarBerkas() {
    return NBImpor.daftar().filter(function (k) { return NBStore.bolehImpor(k).ok; });
  }

  function kartuBerkas(kode) {
    var b = NBImpor.def(kode);
    var wajib = b.kolom.filter(function (k) { return k.w; }).length;
    return "<div class='nb-setting' style='margin-bottom:8px'>" +
      NBUi.badge(T("imp.f" + kode), "is-blue") +
      "<div style='flex:1'>" +
        "<div class='nb-setting-label'>" + NBUi.esc(T("imp.d" + kode)) + "</div>" +
        "<div class='nb-setting-desc'>" + NBUi.esc(T("imp.kolomInfo",
          { n: b.kolom.length, w: wajib })) + "</div>" +
      "</div>" +
      "<button class='nb-btn nb-btn-outline' data-templat='" + kode + "'>" +
        NBUi.esc(T("imp.templat")) + "</button>" +
      "<button class='nb-btn nb-btn-outline' data-ekspor='" + kode + "'>" +
        NBUi.esc(T("imp.eksporIsi")) + "</button>" +
    "</div>";
  }

  function tabelPratinjau() {
    var p = state.pratinjau;
    if (!p) return "";
    var kolomTampil = NBImpor.def(state.berkas).kolom.slice(0, 5).map(function (k) { return k.k; });

    return "<div class='nb-card' style='margin-top:24px'>" +
      "<div class='nb-toolbar'><div>" +
        "<div style='font-weight:600'>" + NBUi.esc(T("imp.pratinjauJudul", { n: state.namaBerkas })) + "</div>" +
        "<div class='nb-cell-sub'>" + NBUi.esc(T("imp.pratinjauSub",
          { v: p.valid, g: p.galat })) + "</div>" +
      "</div><div style='display:flex;gap:8px'>" +
        (p.galat ? "<button class='nb-btn nb-btn-outline' id='iUnduhGalat'>" +
          NBUi.esc(T("imp.unduhGalat")) + "</button>" : "") +
        "<button class='nb-btn nb-btn-quiet' id='iBatal'>" + NBUi.esc(T("umum.batal")) + "</button>" +
        (p.valid ? "<button class='nb-btn nb-btn-primary' id='iTerapkan'>" +
          NBUi.esc(T("imp.terapkan", { n: p.valid })) + "</button>" : "") +
      "</div></div>" +
      "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
        "<th class='nb-num'>" + NBUi.esc(T("imp.thBaris")) + "</th>" +
        kolomTampil.map(function (k) { return "<th>" + NBUi.esc(k) + "</th>"; }).join("") +
        "<th>" + NBUi.esc(T("imp.thHasil")) + "</th>" +
      "</tr></thead><tbody>" + p.hasil.slice(0, 60).map(function (h) {
        return "<tr" + (h.ok ? "" : " style='background:var(--nb-red-50)'") + ">" +
          "<td class='nb-num nb-mono'>" + (h.baris._baris || "-") + "</td>" +
          kolomTampil.map(function (k) {
            return "<td class='nb-cell-sub'>" + NBUi.esc(h.baris[k] || "-") + "</td>";
          }).join("") +
          "<td>" + (h.ok
            ? NBUi.badge(T("imp.a" + (h.aksi || "TAMBAH")), "is-emerald")
            : NBUi.badge((h.kodeGalat ? h.kodeGalat + " " : "") + T(h.kunci, h.vars), "is-red")) +
          "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      (p.hasil.length > 60
        ? "<p class='nb-cell-sub' style='padding:12px 20px;margin:0'>" +
          NBUi.esc(T("lap.potong", { n: p.hasil.length })) + "</p>"
        : "") +
    "</div>";
  }

  function render() {
    var u = NBStore.user();
    var c = NBStore.siklusAktif();
    if (!c) return "<div class='nb-card'>" + NBUi.kosong(T("dash.siklusKosong"), T("dash.siklusKosongSub")) + "</div>";
    var daftar = daftarBerkas();
    if (!daftar.length) {
      return "<div class='nb-pagehead'><div><h1>" + NBUi.esc(T("imp.judul")) + "</h1>" +
        "<p>" + NBUi.esc(T("imp.sub")) + "</p></div></div>" +
        "<div class='nb-card'>" + NBUi.kosong(T("imp.tidakAda"), T("imp.tidakAdaSub")) + "</div>";
    }
    if (daftar.indexOf(state.berkas) === -1) state.berkas = daftar[0];

    return "" +
    "<div class='nb-pagehead'><div>" +
      "<h1>" + NBUi.esc(T("imp.judul")) + "</h1>" +
      "<p>" + NBUi.esc(T("imp.sub")) + "</p></div>" +
      (NBRbac.can(u, "admin")
        ? "<div style='display:flex;gap:8px'>" +
          "<button class='nb-btn nb-btn-outline' id='iCadangan'>" + NBUi.esc(T("imp.cadangan")) + "</button>" +
          "<label class='nb-btn nb-btn-outline' style='cursor:pointer'>" + NBUi.esc(T("imp.pulihkan")) +
          "<input type='file' id='iPulih' accept='.json' style='display:none'></label></div>"
        : "") +
    "</div>" +

    "<div class='nb-card nb-card-pad' style='margin-bottom:24px;background:var(--nb-gray-50)'>" +
      "<div class='nb-note'>" + NBUi.svg("shield") + "<div>" +
      "<div style='font-weight:600'>" + NBUi.esc(T("imp.aturanJudul")) + "</div>" +
      "<div class='nb-cell-sub'>" + NBUi.esc(T("imp.aturanIsi")) + "</div></div></div></div>" +

    "<div class='nb-card nb-card-pad' style='margin-bottom:24px'>" +
      "<div class='nb-card-head'>" + NBUi.svg("layers") + "<div>" +
      "<h3>" + NBUi.esc(T("imp.unduhJudul")) + "</h3>" +
      "<p>" + NBUi.esc(T("imp.unduhSub")) + "</p></div></div>" +
      daftar.map(kartuBerkas).join("") +
    "</div>" +

    "<div class='nb-card nb-card-pad'>" +
      "<div class='nb-card-head'>" + NBUi.svg("save") + "<div>" +
      "<h3>" + NBUi.esc(T("imp.unggahJudul")) + "</h3>" +
      "<p>" + NBUi.esc(T("imp.unggahSub")) + "</p></div></div>" +
      "<div class='nb-setting'>" +
        "<div style='flex:1'>" +
          "<div class='nb-setting-label'>" + NBUi.esc(T("imp.pilihBerkas")) + "</div>" +
          "<select class='nb-select' id='iJenis' style='margin-top:8px;width:100%'>" +
            daftar.map(function (k) {
              return "<option value='" + k + "'" + (k === state.berkas ? " selected" : "") + ">" +
                     NBUi.esc(T("imp.d" + k)) + "</option>";
            }).join("") + "</select>" +
        "</div>" +
        "<label class='nb-btn nb-btn-primary' style='cursor:pointer'>" + NBUi.esc(T("imp.pilihCsv")) +
        "<input type='file' id='iFile' accept='.csv,text/csv' style='display:none'></label>" +
      "</div>" +
      "<div id='iPesan' class='nb-cell-sub' style='color:var(--nb-red-700);margin-top:10px'></div>" +
    "</div>" +

    tabelPratinjau();
  }

  function bacaBerkas(file, selesai) {
    var fr = new FileReader();
    fr.onload = function () { selesai(String(fr.result)); };
    fr.onerror = function () { NBUi.toast(T("imp.errBaca"), "error"); };
    fr.readAsText(file, "utf-8");
  }

  function mount() {
    var c = NBStore.siklusAktif();

    document.querySelectorAll("button[data-templat]").forEach(function (b) {
      b.onclick = function () {
        var kode = b.dataset.templat;
        NBReport.unduh("templat-" + kode.toLowerCase() + ".csv", NBImpor.templat(kode));
        NBUi.toast(T("imp.templatTerunduh", { n: T("imp.d" + kode) }));
      };
    });

    document.querySelectorAll("button[data-ekspor]").forEach(function (b) {
      b.onclick = function () {
        var kode = b.dataset.ekspor;
        var data = NBStore.eksporData(kode, c.cycle_id);
        NBReport.unduh(kode.toLowerCase() + "-" + c.cycle_id + ".csv",
          NBReport.keCsv(data.kolom, data.baris));
        NBUi.toast(T("lap.terunduh", { n: kode.toLowerCase() + ".csv" }));
      };
    });

    var jenis = document.getElementById("iJenis");
    if (jenis) jenis.onchange = function () {
      state.berkas = this.value; state.pratinjau = null; NBApp.ulang();
    };

    var file = document.getElementById("iFile");
    if (file) file.onchange = function () {
      var f = this.files && this.files[0];
      if (!f) return;
      bacaBerkas(f, function (teks) {
        var urai = NBImpor.urai(teks);
        var cek = NBImpor.periksaKepala(state.berkas, urai.kolom);
        if (!cek.ok) {
          document.getElementById("iPesan").textContent = T(cek.kunci, cek.vars || {});
          return;
        }
        var p = NBStore.pratinjauImpor(state.berkas, urai.baris, c.cycle_id);
        if (!p.ok) {
          document.getElementById("iPesan").textContent = T(p.kunci, p.vars || {});
          return;
        }
        state.pratinjau = p;
        state.namaBerkas = f.name;
        NBApp.ulang();
      });
    };

    var batal = document.getElementById("iBatal");
    if (batal) batal.onclick = function () { state.pratinjau = null; NBApp.ulang(); };

    var terapkan = document.getElementById("iTerapkan");
    if (terapkan) terapkan.onclick = function () {
      var p = state.pratinjau;
      NBUi.konfirmasi({
        judul: T("imp.terapkanJudul"), pesan: T("imp.terapkanPesan", { n: p.valid, g: p.galat }),
        ok: T("imp.terapkan", { n: p.valid }), batal: T("umum.batal")
      }, function () {
        var res = NBStore.terapkanImpor(state.berkas,
          p.hasil.map(function (h) { return h.baris; }), c.cycle_id);
        state.pratinjau = null;
        NBUi.toast(res.ok ? T("imp.berhasil", { n: res.masuk, g: res.galat.length })
                          : T(res.kunci, res.vars || {}), res.ok ? "ok" : "error");
        NBApp.ulang();
      });
    };

    var unduhGalat = document.getElementById("iUnduhGalat");
    if (unduhGalat) unduhGalat.onclick = function () {
      var gagal = state.pratinjau.hasil.filter(function (h) { return !h.ok; });
      var kolom = NBImpor.def(state.berkas).kolom.map(function (k) { return { kunci: k.k, label: k.k }; });
      kolom.push({ kunci: "_alasan", label: "alasan_gagal" });
      var baris = gagal.map(function (h) {
        return Object.assign({}, h.baris, { _alasan: T(h.kunci, h.vars) });
      });
      NBReport.unduh("gagal-" + state.berkas.toLowerCase() + ".csv", NBReport.keCsv(kolom, baris));
    };

    var cadangan = document.getElementById("iCadangan");
    if (cadangan) cadangan.onclick = function () {
      var nama = "cadangan-mpp-" + new Date().toISOString().slice(0, 10) + ".json";
      var ok = NBReport.unduh(nama, NBStore.cadangan(), "application/json");
      NBUi.toast(ok ? T("lap.terunduh", { n: nama }) : T("lap.gagalUnduh"), ok ? "ok" : "error");
    };

    var pulih = document.getElementById("iPulih");
    if (pulih) pulih.onchange = function () {
      var f = this.files && this.files[0];
      if (!f) return;
      bacaBerkas(f, function (teks) {
        NBUi.konfirmasi({
          judul: T("imp.pulihkan"), pesan: T("imp.pulihkanPesan"),
          ok: T("imp.pulihkan"), batal: T("umum.batal"), gaya: "nb-btn-soft-danger"
        }, function () {
          var res = NBStore.pulihkanCadangan(teks);
          NBUi.toast(res.ok ? T("imp.pulihBerhasil") : T(res.kunci), res.ok ? "ok" : "error");
          if (res.ok) { state.pratinjau = null; NBApp.ulang(); }
        });
      });
    };
  }

  global.NBPages = global.NBPages || {};
  global.NBPages.data = { render: render, mount: mount };
})(window);
