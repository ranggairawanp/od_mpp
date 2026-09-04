// Validasi baris usulan MPP. Dipisah dari layar supaya bisa diuji tanpa membuka browser
// dan supaya aturan yang sama berlaku di mana pun baris dibuat.
//
// Kode aturan mengacu ke business rules dokumen. Yang tidak punya rujukan berarti
// tambahan saya, dan ditandai jelas di komentar.
(function (global) {
  "use strict";

  function galat(kode, kunci, vars) { return { kode: kode, kunci: kunci, vars: vars || {} }; }

  // konteks: { baris, semuaBaris, departemen, karyawan, grade, vacancy, currentHc }
  function periksa(baris, ctx) {
    var errors = [], warnings = [];
    var a = NBActions.def(baris.action_type);
    if (!a) return { errors: [galat("V00", "val.actionTidakDikenal")], warnings: [] };

    // V01, BR-01: bulan efektif wajib untuk setiap action yang perlu implementasi.
    if (a.perluBulan) {
      var m = Number(baris.effective_month);
      if (!m || m < 1 || m > 12) errors.push(galat("V01", "val.bulanWajib"));
    }

    // V02: kuantitas minimal satu untuk action berbasis jumlah.
    if (a.perluKuantitas) {
      var q = Number(baris.quantity);
      if (!q || q < 1) errors.push(galat("V02", "val.kuantitasMin"));
      if (q > 50) warnings.push(galat("W02", "val.kuantitasBesar", { n: q }));
    }

    // V03, BR-A: setiap penambahan headcount wajib diklasifikasi replacement atau additional.
    var perluRep = a.perluReplacement ||
      (baris.action_type === "VACANCY_ACTION" && baris.vacancy_subtype === "FILL");
    if (perluRep && !baris.replacement_flag) errors.push(galat("V03", "val.replacementWajib"));

    // V04, BR-F: grade tujuan wajib dan harus berbeda. Promosi harus naik.
    if (a.perluGrade) {
      if (!baris.target_grade_id) errors.push(galat("V04", "val.gradeWajib"));
      else if (ctx.gradeAsal) {
        var asal = ctx.levelGrade(ctx.gradeAsal), tujuan = ctx.levelGrade(baris.target_grade_id);
        if (baris.action_type !== "POSITION_CREATION" && tujuan === asal) {
          errors.push(galat("V04b", "val.gradeSama"));
        }
        if (a.gradeNaik && tujuan < asal) errors.push(galat("V04c", "val.promosiTurun"));
        if (a.gradeNaik && tujuan - asal > 1) warnings.push(galat("W04", "val.lompatGrade", { n: tujuan - asal }));
      }
    }

    // V07f (keputusan 3b): karyawan dengan NIK sementara belum boleh diusulkan.
    if (baris.employee_id && ctx.karyawanSementara) errors.push(galat("V07f", "val.karyawanSementara"));
    // W05c (keputusan 4c): mutasi antar departemen menunggu OD menetapkan atasan barunya.
    if (a.perluDeptTujuan && !baris.target_manager_id) warnings.push(galat("W05c", "val.mutasiTanpaAtasan"));

    // V05c: mutasi internal wajib menunjuk atasan baru di departemen yang sama, dan atasan
    // itu harus orang yang berbeda dari atasan sekarang. Pemeriksaan keberadaan atasan dan
    // departemennya dilakukan store lewat ctx.atasanTujuan.
    if (a.perluAtasanTujuan) {
      if (!baris.target_manager_id) errors.push(galat("V05c", "val.atasanTujuanWajib"));
      else if (ctx.atasanTujuan === false) errors.push(galat("V05d", "val.atasanTujuanLuar"));
      else if (baris.target_manager_id === ctx.atasanSekarang) errors.push(galat("V05e", "val.atasanTujuanSama"));
      else warnings.push(galat("W05b", "val.mutasiInternalPerluHod"));
    }

    // V05, BR-D: transfer wajib punya departemen tujuan yang berbeda,
    // dan menunggu konfirmasi departemen penerima.
    if (a.perluDeptTujuan) {
      if (!baris.target_department_id) errors.push(galat("V05", "val.deptTujuanWajib"));
      else if (baris.target_department_id === baris.department_id) {
        errors.push(galat("V05b", "val.deptTujuanSama"));
      } else if (ctx.lintasEntitas) {
        // Mutasi lintas legal entity bukan mutasi, melainkan berhenti dan diangkat kembali
        // di entitas lain. Dilarang di sini sampai punya aturannya sendiri (F4-4).
        errors.push(galat("V05f", "val.deptTujuanLintasEntitas"));
      } else {
        warnings.push(galat("W05", "val.transferPerluKonfirmasi"));
      }
    }

    // V06: alasan wajib untuk setiap baris yang menambah headcount atau biaya.
    if (a.perluAlasan && (!baris.justification || baris.justification.trim().length < 10)) {
      errors.push(galat("V06", "val.alasanWajib"));
    }

    // V07: sasaran baris harus ada dan berada dalam lingkup departemen penyusun.
    if (a.basis === "employee" && !baris.employee_id) errors.push(galat("V07", "val.karyawanWajib"));
    if (a.basis === "vacancy" && !baris.vacancy_id) errors.push(galat("V07b", "val.vacancyWajib"));
    if (a.perluJudulPosisi && !baris.new_position_title) errors.push(galat("V07c", "val.judulPosisiWajib"));
    if (a.perluSubtipe && !baris.vacancy_subtype) errors.push(galat("V07d", "val.subtipeWajib"));
    if (a.perluSebabKurang && !baris.reduction_reason) errors.push(galat("V07e", "val.sebabKurangWajib"));
    // V05g (F9-1): pindah entitas wajib menyebut departemen tujuan di legal entity lain.
    if (a.perluSebabKurang && baris.reduction_reason === "Pindah entitas") {
      if (!baris.target_department_id) errors.push(galat("V05g", "val.pindahEntitasTujuan"));
      else if (ctx.lintasEntitas === false) errors.push(galat("V05h", "val.pindahEntitasSama"));
      else if (!baris.linked_line_item_id) warnings.push(galat("W05d", "val.pindahEntitasMenunggu"));
    }

    // V08, BR-I: headcount departemen tidak boleh menjadi negatif.
    if (typeof ctx.currentHc === "number") {
      var rekap = NBActions.rekap(ctx.semuaBaris || [], baris.department_id);
      if (ctx.currentHc + rekap.netto < 0) errors.push(galat("V08", "val.hcNegatif"));
    }

    // V09: pencegah double counting. Baris hiring yang menunjuk induk wajib menunjuk
    // baris Position Creation yang benar, dan induknya tidak boleh sudah diisi langsung.
    // Aturan ini tidak ada di dokumen, saya tambahkan pada fase perencanaan gap nomor 2.
    if (baris.parent_line_item_id) {
      var induk = (ctx.semuaBaris || []).filter(function (x) {
        return x.line_item_id === baris.parent_line_item_id;
      })[0];
      if (!induk) errors.push(galat("V09", "val.indukTidakAda"));
      else if (induk.action_type !== "POSITION_CREATION") errors.push(galat("V09b", "val.indukBukanPosisi"));
      else if (induk.fill_immediately) errors.push(galat("V09c", "val.indukSudahDiisi"));
    }

    // V10: satu karyawan sebaiknya tidak muncul di lebih dari satu baris yang mengubah statusnya.
    if (baris.employee_id && baris.action_type !== "NO_CHANGE") {
      var kembar = (ctx.semuaBaris || []).filter(function (x) {
        return x.employee_id === baris.employee_id && x.line_item_id !== baris.line_item_id &&
               x.action_type !== "NO_CHANGE";
      });
      if (kembar.length) warnings.push(galat("W10", "val.karyawanGanda"));
    }

    // V11: vacancy yang direncanakan harus masih terbuka.
    if (baris.vacancy_id && ctx.vacancyStatus && ctx.vacancyStatus !== "Open") {
      errors.push(galat("V11", "val.vacancyTidakTerbuka", { s: ctx.vacancyStatus }));
    }

    return { errors: errors, warnings: warnings };
  }

  function valid(hasil) { return hasil.errors.length === 0; }

  global.NBValidate = { periksa: periksa, valid: valid };
})(window);
