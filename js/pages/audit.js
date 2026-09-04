// Layar 11 dari inventaris bab 25. Audit log (BR-08) dan pembeda dengan Revision History (bab 47).
(function (global) {
  "use strict";

  var T = function (k, v) { return NBi18n.t(k, v); };

  function nilai(v) {
    if (v === null || v === undefined) return "<span class='nb-muted'>-</span>";
    if (v === "") return "<span class='nb-muted'>" + NBUi.esc(T("audit.nilaiKosong")) + "</span>";
    return "<span class='nb-mono'>" + NBUi.esc(String(v).slice(0, 60)) + "</span>";
  }

  function render() {
    var u = NBStore.user();
    var data = NBAudit.untuk(u, NBStore.departemenDariAudit);

    var baris = data.map(function (e) {
      var tipe = NBAudit.TIPE[e.event_type] || { label: e.event_type, badge: "" };
      var perubahan = (e.before === null && e.after === null)
        ? "<span class='nb-muted'>-</span>"
        : nilai(e.before) + " <span class='nb-muted'>" + NBUi.esc(T("audit.ke")) + "</span> " + nilai(e.after);

      return "<tr>" +
        "<td class='nb-ts'>" + NBFormat.tanggalPendek(e.timestamp) +
          "<small>" + NBFormat.jam(e.timestamp) + "</small></td>" +
        "<td><span class='nb-actor'>" + NBUi.esc(e.actor_email) + "</span>" +
          "<span class='nb-role'>" + NBUi.esc(T("audit.peran", { r: e.actor_role })) + "</span></td>" +
        "<td>" + NBUi.badge(tipe.label, tipe.badge) + "</td>" +
        "<td>" + NBUi.esc(e.detail_key ? T(e.detail_key, e.detail_vars || {}) : e.detail) +
          (e.reason ? "<div class='nb-cell-sub'>" + NBUi.esc(T("audit.alasan", { r: e.reason })) + "</div>" : "") +
          "<div class='nb-cell-sub nb-mono'>" + NBUi.esc(e.object_type + " " + e.object_id) + "</div></td>" +
        "<td>" + perubahan + "</td>" +
      "</tr>";
    }).join("");

    var isi = data.length
      ? "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
        "<th>" + NBUi.esc(T("audit.waktu")) + "</th>" +
        "<th>" + NBUi.esc(T("audit.aktor")) + "</th>" +
        "<th>" + NBUi.esc(T("audit.aksi")) + "</th>" +
        "<th>" + NBUi.esc(T("audit.rincian")) + "</th>" +
        "<th>" + NBUi.esc(T("audit.nilai")) + "</th>" +
        "</tr></thead><tbody>" + baris + "</tbody></table></div>"
      : NBUi.kosong(T("audit.kosong"), T("audit.kosongSub"));

    return "" +
    "<div class='nb-pagehead'><div>" +
      "<h1>" + NBUi.esc(T("audit.judul")) + "</h1>" +
      "<p>" + NBUi.esc(T("audit.sub")) + "</p>" +
    "</div>" +
      NBUi.badge(T("audit.event", { n: NBFormat.angka(data.length) }), "is-plain") +
    "</div>" +
    "<div class='nb-card'>" + isi + "</div>" +
    "<p class='nb-cell-sub' style='margin-top:12px'>" + NBUi.esc(T("audit.catatan")) + "</p>";
  }

  global.NBPages = global.NBPages || {};
  global.NBPages.audit = { render: render };
})(window);
