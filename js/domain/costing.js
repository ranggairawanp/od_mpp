// Mesin biaya people cost. Satu-satunya tempat angka rupiah dihitung.
//
// Komponen mengikuti definisi yang dikunci Kang Rangga:
// gaji pokok, tunjangan grade, tunjangan jabatan, tunjangan komunikasi, tunjangan kehadiran,
// tunjangan makan, tunjangan PPh 21 (gaji net), tunjangan COP/HOP, BPJS Kesehatan bagian
// perusahaan, BPJS Ketenagakerjaan bagian perusahaan (JP, JKK, JKM, JHT, JKP), asuransi
// pihak ketiga, accrual THR, dan accrual bonus.
//
// Catatan satu: dalam daftar semula tertulis JKN di bawah BPJS Ketenagakerjaan. JKN adalah
// program BPJS Kesehatan, sedangkan komponen kematian di BPJS Ketenagakerjaan bernama JKM.
// Di sini dicatat sebagai JKM supaya tidak berbenturan dengan BPJS Kesehatan yang sudah
// berdiri sendiri. Kalau memang JKN yang dimaksud, cukup ganti labelnya.
//
// Catatan dua: tunjangan PPh 21 di sini adalah angka yang diisi C&B, bukan hasil hitungan
// pajak. Menghitung PPh 21 sungguhan memerlukan TER bulanan, PTKP, dan penyetahunan
// Desember, dan itu keputusan tersendiri yang belum diambil.
//
// BR-E: biaya tahunan bukan biaya bulanan dikali dua belas, melainkan dikali jumlah bulan
// yang benar-benar berlaku, yaitu tiga belas dikurangi bulan efektif.
(function (global) {
  "use strict";

  var KOMPONEN = [
    { kunci: "gaji_pokok",            jenis: "tetap",   upah: true },
    { kunci: "tunj_grade",            jenis: "tetap",   upah: true },
    { kunci: "tunj_jabatan",          jenis: "tetap",   upah: true },
    { kunci: "tunj_komunikasi",       jenis: "tunjangan" },
    { kunci: "tunj_kehadiran",        jenis: "tunjangan" },
    { kunci: "tunj_makan",            jenis: "tunjangan" },
    { kunci: "tunj_pph21",            jenis: "tunjangan" },
    { kunci: "tunj_cop_hop",          jenis: "tunjangan" },
    { kunci: "asuransi_pihak_ketiga", jenis: "asuransi" }
  ];

  var IURAN = [
    { kunci: "bpjs_kes", pct: "bpjs_kes_pct", cap: "bpjs_kes_cap" },
    { kunci: "jht",      pct: "jht_pct" },
    { kunci: "jkk",      pct: "jkk_pct" },
    { kunci: "jkm",      pct: "jkm_pct" },
    { kunci: "jp",       pct: "jp_pct", cap: "jp_cap" },
    { kunci: "jkp",      pct: "jkp_pct" }
  ];

  function bulat(n) { return Math.round(n); }

  // Rincian biaya bulanan satu grade. Mengembalikan tiap komponen supaya layar
  // bisa menampilkan rinciannya tanpa menghitung ulang apa pun.
  // Lima kelompok utama diisi langsung oleh C&B (masukan Dzuhri nomor 1). Tiga belas rincian
  // di sebelahnya hanya keterangan dan tidak pernah dijumlahkan oleh sistem, supaya tidak
  // ada dua angka yang bisa saling bertentangan.
  var UTAMA = ["fixed_income", "variable_income", "company_coverage", "accrual_thr", "accrual_bonus"];
  var RINCIAN = ["gaji_pokok", "tunj_grade", "tunj_jabatan", "tunj_komunikasi", "tunj_kehadiran",
                 "tunj_makan", "tunj_pph21", "tunj_cop_hop", "bpjs_kes", "jht", "jkk", "jkm",
                 "jp", "jkp", "asuransi_pihak_ketiga"];

  function bulanan(asumsiGrade, param) {
    if (!asumsiGrade) return null;
    var r = { komponen: {}, utama: {}, rincian: {}, total: 0 };
    UTAMA.forEach(function (k) {
      var v = bulat(Number(asumsiGrade[k] || 0));
      r.utama[k] = v; r.komponen[k] = v; r.total += v;
    });
    RINCIAN.forEach(function (k) {
      var v = bulat(Number(asumsiGrade[k] || 0));
      r.rincian[k] = v; r.komponen[k] = v;
    });
    // Nama lama tetap disediakan untuk layar yang mengelompokkan.
    r.upah = r.utama.fixed_income;
    r.tunjangan = r.utama.variable_income;
    r.iuran = r.utama.company_coverage;
    r.accrual = r.utama.accrual_thr + r.utama.accrual_bonus;
    return r;
  }

  // Biaya satu baris usulan. Mengembalikan biaya bulanan, jumlah bulan berlaku,
  // dan biaya tahunan yang sudah diprorata.
  //
  // ctx: { asumsi(gradeId), param, gradeAsal, gradeTujuan }
  function baris(b, ctx) {
    var a = NBActions.def(b.action_type);
    if (!a) return null;
    var bulanBerlaku = NBFormat.bulanBerlaku(b.effective_month);
    var qty = a.perluKuantitas ? Number(b.quantity || 0) : 1;

    function totalGrade(g) {
      var m = bulanan(ctx.asumsi(g), ctx.param);
      return m ? m.total : 0;
    }

    var jenis = a.biaya, bulananNilai = 0, catatan = jenis;

    if (jenis === "penuh") {
      bulananNilai = totalGrade(ctx.gradeTujuan || ctx.gradeAsal) * qty;
    } else if (jenis === "delta") {
      // Yang diprorata adalah selisihnya, bukan biaya penuh.
      bulananNilai = totalGrade(ctx.gradeTujuan) - totalGrade(ctx.gradeAsal);
    } else if (jenis === "hemat") {
      bulananNilai = -totalGrade(ctx.gradeAsal) * qty;
    } else {
      bulananNilai = 0;
    }

    // Vacancy hanya berbiaya bila diisi. Posisi baru hanya berbiaya bila langsung diisi.
    if (b.action_type === "VACANCY_ACTION") {
      bulananNilai = b.vacancy_subtype === "FILL" ? totalGrade(ctx.gradeTujuan || ctx.gradeAsal) : 0;
      catatan = b.vacancy_subtype === "FILL" ? "penuh" : "none";
    }
    if (b.action_type === "POSITION_CREATION") {
      bulananNilai = b.fill_immediately ? totalGrade(ctx.gradeTujuan) * qty : 0;
      catatan = b.fill_immediately ? "penuh" : "none";
    }

    return {
      line_item_id: b.line_item_id,
      jenis: catatan,
      monthly_cost: bulat(bulananNilai),
      applicable_months: bulananNilai ? bulanBerlaku : 0,
      annualized_cost: bulat(bulananNilai * bulanBerlaku)
    };
  }

  global.NBCosting = {
    KOMPONEN: KOMPONEN, IURAN: IURAN, UTAMA: UTAMA, RINCIAN: RINCIAN,
    bulanan: bulanan, baris: baris
  };
})(window);
