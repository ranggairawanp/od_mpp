// Bagan organisasi. Fungsi murni: menyusun pohon menjadi koordinat, lalu menggambar SVG
// sebagai string. Tidak menyentuh DOM, jadi bisa diuji tanpa peramban.
//
// Keputusan yang dipegang (masukan Dzuhri nomor 3, dan K5, K6):
// 1. Satu kotak satu orang. Posisi yang diisi banyak orang digambar sebanyak orangnya.
// 2. Tampilan awal dilipat di tingkat manajer 5A; simpul dibuka per klik.
// 3. Vacancy terbuka dan alokasi yang disetujui tetapi belum terisi digambar garis putus,
//    supaya bagan berguna untuk MPP dan bukan sekadar direktori.
// 4. Batas keras 400 kotak per tampilan; lebihnya dilipat otomatis dengan hitungan.
(function (global) {
  "use strict";

  var LEBAR = 172, TINGGI = 64, JARAK_X = 16, JARAK_Y = 56, BATAS_KOTAK = 400;

  // Menyusun daftar simpul yang tampak, mengikuti simpul yang dibuka.
  // dibuka: peta employee_id -> true. bolehDilipat: fungsi(karyawan) -> boolean.
  function simpulTampak(akarId, pohon, dibuka, opsi) {
    var o = opsi || {};
    var hasil = [], jumlah = 0;
    var akar = pohon.peta[akarId];
    if (!akar) return { simpul: [], terpotong: false };

    function jelajah(id, kedalaman, induk) {
      var e = pohon.peta[id];
      if (!e) return;
      var anak = (pohon.anak[id] || []).slice();
      if (o.batasDept) anak = anak.filter(function (c) { return pohon.peta[c] && pohon.peta[c].department_id === o.batasDept; });
      var tambahan = o.tambahan ? (o.tambahan[id] || []) : [];
      var totalBawah = anak.length + tambahan.length;
      // Simpul manajer 5A ke atas dilipat sampai dibuka, kecuali akarnya sendiri.
      var lipat = kedalaman > 0 && o.bolehDilipat && o.bolehDilipat(e) && !dibuka[id];
      // Kedalaman awal: dua tingkat di bawah akar dibuka, selebihnya menunggu klik.
      if (kedalaman >= (o.kedalamanAwal || 2) && !dibuka[id]) lipat = totalBawah > 0;
      var simpul = { id: id, e: e, induk: induk, kedalaman: kedalaman, anak: [],
                     jumlahBawahan: totalBawah, terlipat: lipat && totalBawah > 0, jenis: "orang" };
      hasil.push(simpul); jumlah += 1;
      if (jumlah > BATAS_KOTAK) { simpul.terlipat = totalBawah > 0; return simpul; }
      if (!simpul.terlipat) {
        anak.forEach(function (c) {
          // Batas keras: anak yang tidak muat dilipat ke induknya dengan hitungan.
          if (jumlah >= BATAS_KOTAK) { simpul.terlipat = true; simpul.terpotong = true; return; }
          var s = jelajah(c, kedalaman + 1, simpul); if (s) simpul.anak.push(s);
        });
        tambahan.forEach(function (t, i) {
          var st = { id: id + "|" + t.jenis + "|" + i, e: null, tambahan: t, induk: simpul,
                     kedalaman: kedalaman + 1, anak: [], jumlahBawahan: 0, terlipat: false, jenis: t.jenis };
          hasil.push(st); jumlah += 1; simpul.anak.push(st);
        });
      }
      return simpul;
    }
    var akarSimpul = jelajah(akarId, 0, null);
    return { simpul: hasil, akar: akarSimpul, terpotong: hasil.some(function (n) { return n.terpotong; }) || jumlah > BATAS_KOTAK };
  }

  // Tata letak pohon sederhana: lebar subtree dihitung dari bawah, anak diratakan di
  // bawah induknya. Cukup untuk dua sampai tiga tingkat yang ditampilkan sekaligus.
  function tataLetak(akar) {
    function lebarSub(n) {
      if (!n.anak.length) { n.lebarSub = LEBAR; return n.lebarSub; }
      var total = 0;
      n.anak.forEach(function (c) { total += lebarSub(c); });
      total += JARAK_X * (n.anak.length - 1);
      n.lebarSub = Math.max(LEBAR, total);
      return n.lebarSub;
    }
    function tempatkan(n, x, y) {
      n.x = x + (n.lebarSub - LEBAR) / 2; n.y = y;
      var kursor = x;
      // Bila anak lebih sempit dari induk, geser supaya rata tengah.
      var lebarAnak = n.anak.reduce(function (t, c) { return t + c.lebarSub; }, 0) + JARAK_X * Math.max(0, n.anak.length - 1);
      kursor += (n.lebarSub - lebarAnak) / 2;
      n.anak.forEach(function (c) { tempatkan(c, kursor, y + TINGGI + JARAK_Y); kursor += c.lebarSub + JARAK_X; });
    }
    lebarSub(akar); tempatkan(akar, 0, 0);
    var maxY = 0, maxX = 0;
    (function jalan(n) { maxY = Math.max(maxY, n.y + TINGGI); maxX = Math.max(maxX, n.x + LEBAR); n.anak.forEach(jalan); })(akar);
    return { lebar: maxX, tinggi: maxY };
  }

  function esc(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function potong(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "\u2026" : s; }

  // Menggambar SVG. label: fungsi(karyawan) -> {judul, sub, grade}.
  function gambar(tata, opsi) {
    var o = opsi || {};
    var pad = 24;
    var w = tata.ukuran.lebar + pad * 2, h = tata.ukuran.tinggi + pad * 2;
    var out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h +
               '" width="' + w + '" height="' + h + '" class="nb-bagan" font-family="Geist, system-ui, sans-serif">'];
    // Garis penghubung dulu, supaya berada di bawah kotak.
    tata.simpul.forEach(function (n) {
      if (!n.induk) return;
      var x1 = n.induk.x + LEBAR / 2 + pad, y1 = n.induk.y + TINGGI + pad;
      var x2 = n.x + LEBAR / 2 + pad, y2 = n.y + pad;
      var ym = y1 + JARAK_Y / 2;
      out.push('<path d="M' + x1 + ' ' + y1 + ' V' + ym + ' H' + x2 + ' V' + y2 +
               '" fill="none" stroke="#D2D5DB" stroke-width="1.5"/>');
    });
    tata.simpul.forEach(function (n) {
      var x = n.x + pad, y = n.y + pad;
      if (n.jenis === "orang") {
        var l = o.label(n.e);
        out.push('<g class="nb-bagan-simpul" data-id="' + esc(n.id) + '" style="cursor:' +
                 (n.jumlahBawahan ? 'pointer' : 'default') + '">');
        out.push('<rect x="' + x + '" y="' + y + '" width="' + LEBAR + '" height="' + TINGGI +
                 '" rx="10" fill="#FFFFFF" stroke="' + (n.kedalaman === 0 ? '#CF392B' : '#E8E9ED') + '" stroke-width="1.5"/>');
        out.push('<text x="' + (x + 12) + '" y="' + (y + 22) + '" font-size="12" font-weight="600" fill="#121826">' + esc(potong(l.judul, 22)) + '</text>');
        out.push('<text x="' + (x + 12) + '" y="' + (y + 38) + '" font-size="10.5" fill="#6D727F">' + esc(potong(l.sub, 26)) + '</text>');
        out.push('<text x="' + (x + 12) + '" y="' + (y + 53) + '" font-size="10" fill="#9EA3AE">' + esc(l.grade) + '</text>');
        if (n.jumlahBawahan) {
          var cx = x + LEBAR - 18, cy = y + TINGGI - 14;
          out.push('<circle cx="' + cx + '" cy="' + cy + '" r="10" fill="' + (n.terlipat ? '#F1F6FE' : '#F3F4F6') + '" stroke="' + (n.terlipat ? '#C5DAFB' : '#E6E7EB') + '"/>');
          out.push('<text x="' + cx + '" y="' + (cy + 3.5) + '" font-size="9.5" text-anchor="middle" fill="' + (n.terlipat ? '#273FA9' : '#394150') + '">' +
                   (n.terlipat ? ('+' + n.jumlahBawahan) : n.jumlahBawahan) + '</text>');
        }
        out.push('</g>');
      } else {
        // Vacancy atau alokasi belum terisi: garis putus.
        var t = n.tambahan;
        var warna = t.jenis === "vacancy" ? "#9EA3AE" : "#3273F6";
        out.push('<g class="nb-bagan-simpul" data-id="' + esc(n.id) + '">');
        out.push('<rect x="' + x + '" y="' + y + '" width="' + LEBAR + '" height="' + TINGGI +
                 '" rx="10" fill="' + (t.jenis === "vacancy" ? "#F9FAFB" : "#F1F6FE") + '" stroke="' + warna + '" stroke-width="1.5" stroke-dasharray="5 4"/>');
        out.push('<text x="' + (x + 12) + '" y="' + (y + 22) + '" font-size="12" font-weight="600" fill="' + warna + '">' + esc(potong(t.judul, 22)) + '</text>');
        out.push('<text x="' + (x + 12) + '" y="' + (y + 38) + '" font-size="10.5" fill="#6D727F">' + esc(potong(t.sub, 26)) + '</text>');
        out.push('<text x="' + (x + 12) + '" y="' + (y + 53) + '" font-size="10" fill="#9EA3AE">' + esc(t.grade || "") + '</text>');
        out.push('</g>');
      }
    });
    out.push('</svg>');
    return out.join("");
  }

  // Satu pintu: dari pohon dan pilihan, langsung ke SVG dan ringkasannya.
  function susun(akarId, pohon, dibuka, opsi) {
    var tampak = simpulTampak(akarId, pohon, dibuka || {}, opsi);
    if (!tampak.akar) return { svg: "", jumlah: 0, terpotong: false, simpul: [] };
    var ukuran = tataLetak(tampak.akar);
    var svg = gambar({ simpul: tampak.simpul, ukuran: ukuran }, opsi);
    return { svg: svg, jumlah: tampak.simpul.length, terpotong: tampak.terpotong, simpul: tampak.simpul,
             ukuran: ukuran };
  }

  global.NBBagan = { simpulTampak: simpulTampak, tataLetak: tataLetak, gambar: gambar, susun: susun,
                     BATAS_KOTAK: BATAS_KOTAK, LEBAR: LEBAR, TINGGI: TINGGI };
})(window);
