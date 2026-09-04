// Placeholder untuk delapan layar sisa. Sengaja tidak diisi angka contoh:
// layar kosong yang jujur lebih baik daripada dashboard yang terlihat hidup padahal palsu.
(function (global) {
  "use strict";

  var MODUL = {
    // seluruh layar sudah dibangun
  };

  function buat(kunci) {
    return {
      render: function () {
        var T = function (k, v) { return NBi18n.t(k, v); };
        return "<div class='nb-pagehead'><div>" +
          "<h1>" + NBUi.esc(T("stub." + kunci)) + "</h1>" +
          "<p>" + NBUi.esc(T("stub.sub")) + "</p></div>" +
          NBUi.badge(T("stub.modul", { n: MODUL[kunci] }), "is-amber") + "</div>" +
          "<div class='nb-card'>" +
          NBUi.kosong(T("stub.belum"), T("stub." + kunci + "Ket"), NBUi.svg("layers")) + "</div>";
      }
    };
  }

  global.NBPages = global.NBPages || {};
  Object.keys(MODUL).forEach(function (k) { global.NBPages[k] = buat(k); });
  global.NBStub = { buat: buat, MODUL: MODUL };
})(window);
