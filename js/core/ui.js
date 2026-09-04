// Helper tampilan kecil. Komponen visual mengikuti Nabati FLK Design System (assets/nabati-ds.css).
// Tidak ada warna atau ukuran yang ditulis ulang di sini.
(function (global) {
  "use strict";

  function esc(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function badge(teks, varian) {
    return '<span class="nb-badge ' + (varian || "") + '">' + esc(teks) + "</span>";
  }

  // Keadaan kosong yang jujur. Tidak pernah menampilkan angka tebakan (prinsip 5).
  function kosong(judul, pesan, ikon) {
    return '<div class="nb-empty"><span class="nb-tile">' + (ikon || svg("info")) + "</span>" +
           "<h4>" + esc(judul) + "</h4><p>" + esc(pesan) + "</p></div>";
  }

  var IKON = {
    users: '<circle cx="9" cy="7" r="4"/><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M19 8v6M22 11h-6"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h6"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    chart: '<path d="M4 19V5m0 14h16"/><path d="M8 15v-4m4 4V8m4 7v-6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    logout: '<path d="M15 17l5-5-5-5"/><path d="M20 12H9"/><path d="M12 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/>'
  };

  function svg(nama, kelas) {
    return '<svg class="' + (kelas || "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
           'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (IKON[nama] || IKON.info) + "</svg>";
  }

  function kpi(label, nilai, ikon, varianTile, catatan, uang) {
    return '<div class="nb-kpi"><div><div class="nb-kpi-label">' + esc(label) + "</div>" +
           '<div class="nb-kpi-value' + (uang ? " is-money" : "") + '">' + nilai + "</div>" +
           (catatan ? '<div class="nb-cell-sub">' + esc(catatan) + "</div>" : "") +
           '</div><span class="nb-tile ' + (varianTile || "") + '">' + svg(ikon) + "</span></div>";
  }

  var toastTimer = null;
  function toast(pesan, jenis) {
    var box = document.getElementById("nbToast");
    if (!box) return;
    box.className = "nb-badge " + (jenis === "error" ? "is-red" : "is-emerald");
    box.textContent = pesan;
    box.style.display = "inline-flex";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.style.display = "none"; }, 3200);
  }

  // Dialog konfirmasi mengikuti design system. Menggantikan confirm dan prompt bawaan
  // browser, yang tidak bisa didesain, tidak bilingual, dan diblokir di sebagian konteks.
  // Memanggil balik lewat callback, bukan Promise, supaya tetap jalan tanpa build step.
  function konfirmasi(opsi, selesai) {
    var o = opsi || {};
    var host = document.createElement("div");
    host.innerHTML =
      '<div class="nb-overlay" id="nbConfirm"><div class="nb-modal" style="max-width:520px">' +
        '<div class="nb-modal-head"><div><div class="nb-modal-title">' +
          "<h2>" + esc(o.judul || "") + "</h2></div></div>" +
          '<button class="nb-iconbtn" data-batal="1">&times;</button></div>' +
        '<div class="nb-modal-body"><div class="nb-section" style="margin-bottom:0">' +
          "<p style='margin:0 0 " + (o.perluAlasan ? "14px" : "0") + "'>" + esc(o.pesan || "") + "</p>" +
          (o.perluAlasan
            ? "<div class='nb-field-label'>" + esc(o.labelAlasan || "") + "</div>" +
              "<textarea class='nb-input' id='nbConfirmAlasan' rows='3' style='resize:vertical' " +
              "placeholder='" + esc(o.placeholder || "") + "'></textarea>" +
              "<div id='nbConfirmGalat' class='nb-cell-sub' style='color:var(--nb-red-700);margin-top:6px'></div>"
            : "") +
        "</div></div>" +
        '<div class="nb-modal-foot"><button class="nb-btn nb-btn-quiet" data-batal="1">' +
          esc(o.batal || "Batal") + "</button>" +
        '<div class="nb-group"><button class="nb-btn ' + (o.gaya || "nb-btn-primary") + '" id="nbConfirmOk">' +
          esc(o.ok || "Lanjut") + "</button></div></div>" +
      "</div></div>";
    document.body.appendChild(host.firstChild);

    var modal = document.getElementById("nbConfirm");
    function tutup() { modal.remove(); }
    modal.querySelectorAll("[data-batal]").forEach(function (b) { b.onclick = tutup; });
    modal.onclick = function (e) { if (e.target === modal) tutup(); };

    document.getElementById("nbConfirmOk").onclick = function () {
      var alasan = null;
      if (o.perluAlasan) {
        var el = document.getElementById("nbConfirmAlasan");
        alasan = (el.value || "").trim();
        if (alasan.length < (o.minAlasan || 10)) {
          document.getElementById("nbConfirmGalat").textContent = o.pesanAlasan || "";
          return;
        }
      }
      tutup();
      if (selesai) selesai(alasan);
    };
  }

  global.NBUi = { esc: esc, badge: badge, kosong: kosong, svg: svg, kpi: kpi,
                  toast: toast, konfirmasi: konfirmasi };
})(window);
