// Mesin action MPP. Sumber kebenaran tunggal untuk apa saja yang boleh direncanakan
// dan bagaimana masing-masing memengaruhi headcount.
//
// Dokumen menyebut tujuh action type (bab 11). Saya menambahkan satu, PLANNED_REDUCTION,
// karena tanpa itu tidak ada satu pun jalan untuk merencanakan pengurangan headcount,
// sehingga Proposed selalu naik dan tidak akan pernah cocok dengan Actual. Ini disetujui
// sebagai jawaban default pertanyaan nomor 4 pada fase perencanaan.
//
// Aturan penting yang tidak tertulis di dokumen: hanya tiga action yang menambah
// headcount perusahaan, yaitu External Hiring, Vacancy Fill, dan Position Creation yang
// langsung diisi. Promotion, Grade Adjustment, dan Transfer tidak mengubah total headcount
// perusahaan sama sekali. Transfer hanya memindahkan satu orang antar departemen.
(function (global) {
  "use strict";

  // basis: apa yang menjadi sasaran baris. employee, position, vacancy, atau baru.
  // hc: dampak ke headcount perusahaan per satu kuantitas.
  // biaya: none, delta (selisih grade), penuh, hemat.
  var ACTIONS = {
    NO_CHANGE: {
      kode: "NO_CHANGE", basis: "employee", hc: 0, biaya: "none",
      badge: "is-plain", perluBulan: false, perluAlasan: false
    },
    PROMOTION: {
      kode: "PROMOTION", basis: "employee", hc: 0, biaya: "delta",
      badge: "is-blue", perluBulan: true, perluAlasan: true, perluGrade: true, gradeNaik: true
    },
    GRADE_ADJUSTMENT: {
      kode: "GRADE_ADJUSTMENT", basis: "employee", hc: 0, biaya: "delta",
      badge: "is-indigo", perluBulan: true, perluAlasan: true, perluGrade: true
    },
    TRANSFER: {
      kode: "TRANSFER", basis: "employee", hc: 0, biaya: "none",
      badge: "is-violet", perluBulan: true, perluAlasan: true, perluDeptTujuan: true
    },
    // Mutasi antar tim di dalam satu departemen (K4 nomor 7). Headcount dan biaya departemen
    // tidak berubah, yang berpindah hanya atasan langsungnya, dan HOD yang mengonfirmasi.
    INTERNAL_TRANSFER: {
      kode: "INTERNAL_TRANSFER", basis: "employee", hc: 0, biaya: "none",
      badge: "is-violet", perluBulan: true, perluAlasan: true, perluAtasanTujuan: true
    },
    EXTERNAL_HIRING: {
      kode: "EXTERNAL_HIRING", basis: "position", hc: 1, biaya: "penuh",
      badge: "is-emerald", perluBulan: true, perluAlasan: true,
      perluKuantitas: true, perluReplacement: true
    },
    VACANCY_ACTION: {
      kode: "VACANCY_ACTION", basis: "vacancy", hc: 0, biaya: "none",
      badge: "is-teal", perluBulan: true, perluAlasan: true, perluSubtipe: true
    },
    POSITION_CREATION: {
      kode: "POSITION_CREATION", basis: "baru", hc: 0, biaya: "none",
      badge: "is-amber", perluBulan: true, perluAlasan: true,
      perluKuantitas: true, perluGrade: true, perluJudulPosisi: true, bisaIsiLangsung: true
    },
    PLANNED_REDUCTION: {
      kode: "PLANNED_REDUCTION", basis: "employee", hc: -1, biaya: "hemat",
      badge: "is-red", perluBulan: true, perluAlasan: true, perluSebabKurang: true
    }
  };

  // Sub tipe Vacancy Action (bab 12).
  var VACANCY_SUB = {
    FILL:   { kode: "FILL",   hc: 1,  perluReplacement: true },
    RETAIN: { kode: "RETAIN", hc: 0 },
    CANCEL: { kode: "CANCEL", hc: 0, hapusSlot: true }
  };

  var SEBAB_KURANG = ["Resign", "Pensiun", "Berakhir kontrak", "Restrukturisasi", "Pindah entitas"];

  function daftar() { return Object.keys(ACTIONS); }
  function def(kode) { return ACTIONS[kode] || null; }

  // Dampak headcount satu baris. Selalu dihitung dari definisi, tidak pernah
  // dari angka yang diketik pengguna, supaya tidak bisa dimanipulasi lewat layar.
  function dampakHc(baris) {
    var a = ACTIONS[baris.action_type];
    if (!a) return { perusahaan: 0, asal: 0, tujuan: 0 };
    var qty = a.perluKuantitas ? Number(baris.quantity || 0) : 1;

    // Catatan koreksi, ditemukan saat QA Modul 4.
    // Semula baris turunan Position Creation saya nolkan seluruhnya. Itu keliru, karena
    // posisi baru yang tidak langsung diisi memang berdampak nol, sehingga menolkan baris
    // rekrutmen turunannya membuat penambahan headcount hilang sama sekali.
    // Pembagian yang benar: Position Creation membuat slot dan hanya menambah headcount
    // bila ditandai diisi langsung, sedangkan rekrutmen turunannya adalah yang mengisi slot
    // dan tetap dihitung. Double counting dicegah aturan V09c, yang melarang satu posisi
    // ditandai diisi langsung sekaligus punya baris rekrutmen turunan.

    if (baris.action_type === "VACANCY_ACTION") {
      var sub = VACANCY_SUB[baris.vacancy_subtype] || VACANCY_SUB.RETAIN;
      return { perusahaan: sub.hc, asal: sub.hc, tujuan: 0 };
    }
    if (baris.action_type === "POSITION_CREATION") {
      var n = baris.fill_immediately ? qty : 0;
      return { perusahaan: n, asal: n, tujuan: 0 };
    }
    if (baris.action_type === "TRANSFER") {
      return { perusahaan: 0, asal: -1, tujuan: 1 };
    }
    return { perusahaan: a.hc * qty, asal: a.hc * qty, tujuan: 0 };
  }

  // Mutasi baru berlaku setelah departemen penerima mengonfirmasi (BR-D).
  // Selama masih draft, transfer_status belum ada, jadi tetap dihitung sebagai pratinjau.
  // Begitu dikirim dan berstatus menunggu atau ditolak, mutasi tidak dihitung di mana pun.
  function mutasiBerlaku(b) {
    if (b.action_type !== "TRANSFER") return true;
    if (!b.transfer_status) return true;
    return b.transfer_status === "CONFIRMED";
  }

  // Ringkasan satu kumpulan baris untuk satu departemen.
  function rekap(barisList, departmentId) {
    var tambah = 0, kurang = 0, masuk = 0, keluar = 0;
    barisList.forEach(function (b) {
      var d = dampakHc(b);
      if (b.action_type === "TRANSFER") {
        if (!mutasiBerlaku(b)) return;
        if (b.department_id === departmentId) keluar += 1;
        if (b.target_department_id === departmentId) masuk += 1;
        return;
      }
      if (d.perusahaan > 0) tambah += d.perusahaan;
      if (d.perusahaan < 0) kurang += Math.abs(d.perusahaan);
    });
    return { tambah: tambah, kurang: kurang, masuk: masuk, keluar: keluar,
             netto: tambah - kurang + masuk - keluar };
  }

  global.NBActions = {
    ACTIONS: ACTIONS, VACANCY_SUB: VACANCY_SUB, SEBAB_KURANG: SEBAB_KURANG,
    daftar: daftar, def: def, dampakHc: dampakHc, rekap: rekap, mutasiBerlaku: mutasiBerlaku
  };
})(window);
