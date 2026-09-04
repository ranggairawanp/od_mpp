// Mesin impor. Parser CSV, pembuat templat, dan definisi berkas yang boleh diunggah.
//
// Prinsip yang dipegang di sini:
// 1. Impor tidak pernah melewati validasi. Baris yang diunggah melewati aturan yang sama
//    persis dengan baris yang diketik di layar, termasuk BR-01, BR-A, BR-I, dan V09.
// 2. Baris bergalat tidak menggagalkan seluruh berkas. Yang lolos masuk, yang gagal
//    dikembalikan lengkap dengan alasannya supaya bisa diperbaiki dan diunggah ulang.
// 3. Impor selalu menambah atau membuat versi baru, tidak pernah menimpa diam-diam.
(function (global) {
  "use strict";

  // Pemisah dideteksi dari baris pertama. Excel Indonesia menulis titik koma,
  // ekspor dari sistem lain sering memakai koma.
  function deteksiPemisah(teks) {
    var baris = teks.split(/\r?\n/)[0] || "";
    var titikKoma = (baris.match(/;/g) || []).length;
    var koma = (baris.match(/,/g) || []).length;
    return titikKoma >= koma ? ";" : ",";
  }

  // Tanggal dari Excel berbahasa Indonesia (F10-1): 15/03/2027, 15-03-2027, 15.03.2027,
  // nomor seri Excel, atau sudah TTTT-BB-HH. Selalu disimpan sebagai TTTT-BB-HH.
  function tanggalDari(v) {
    if (v === null || v === undefined) return "";
    var t = String(v).trim();
    if (!t) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    var m = t.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    if (m) return m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
    var m2 = t.match(/^(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})$/);
    if (m2) return m2[1] + "-" + m2[2].padStart(2, "0") + "-" + m2[3].padStart(2, "0");
    if (/^\d{5}$/.test(t)) {   // nomor seri Excel, hari sejak 30 Desember 1899
      var d = new Date(Date.UTC(1899, 11, 30) + Number(t) * 86400000);
      return d.toISOString().slice(0, 10);
    }
    return t;   // dibiarkan, validasi yang menolak
  }

  // Kepala kolom lentur (F10-3): "Employee ID", "employee id", "EMPLOYEE_ID" menjadi employee_id.
  var ALIAS = {
    "nik": "employee_id", "nama": "name", "nama_karyawan": "name", "grade": "grade_id",
    "departemen": "department_id", "posisi": "position_id", "atasan": "direct_report_id",
    "atasan_langsung": "direct_report_id", "tanggal_masuk": "join_date", "status": "employment_status"
  };
  function normalKepala(h) {
    var k = String(h || "").replace(/^\uFEFF/, "").trim().toLowerCase()
      .replace(/[\s\-]+/g, "_").replace(/[^a-z0-9_]/g, "");
    return ALIAS[k] || k;
  }

  // Kolom kode dibaca tanpa spasi tepi dan tanpa membedakan huruf besar kecil (F10-2).
  var KOLOM_KODE = ["employee_id", "position_id", "grade_id", "department_id", "direct_report_id",
    "target_manager_id", "target_department_id", "target_grade_id", "vacancy_id", "allocation_id",
    "entity_id", "directorate_id", "division_id", "cost_center_id", "user_id", "nik_sementara",
    "currency", "action_type", "scope_type", "role"];
  var KOLOM_TANGGAL = ["join_date", "actual_date", "effective_date", "vacancy_date"];
  function normalNilai(kolom, v) {
    var t = String(v === undefined || v === null ? "" : v).trim();
    if (KOLOM_KODE.indexOf(kolom) !== -1) return t.toUpperCase();
    if (KOLOM_TANGGAL.indexOf(kolom) !== -1) return tanggalDari(t);
    return t;
  }

  function urai(teks) {
    if (!teks) return { kolom: [], baris: [] };
    if (teks.charCodeAt(0) === 0xFEFF) teks = teks.slice(1);
    var pemisah = deteksiPemisah(teks);
    var baris = [], sel = "", kini = [], dalamKutip = false;

    for (var i = 0; i < teks.length; i++) {
      var c = teks[i];
      if (dalamKutip) {
        if (c === '"' && teks[i + 1] === '"') { sel += '"'; i++; }
        else if (c === '"') dalamKutip = false;
        else sel += c;
      } else if (c === '"') dalamKutip = true;
      else if (c === pemisah) { kini.push(sel); sel = ""; }
      else if (c === "\n") { kini.push(sel); baris.push(kini); kini = []; sel = ""; }
      else if (c !== "\r") sel += c;
    }
    if (sel.length || kini.length) { kini.push(sel); baris.push(kini); }
    baris = baris.filter(function (b) { return b.some(function (x) { return String(x).trim() !== ""; }); });
    if (!baris.length) return { kolom: [], baris: [] };

    var kepala = baris[0].map(normalKepala);
    var isi = baris.slice(1).map(function (b, idx) {
      var o = { _baris: idx + 2 };   // nomor baris di berkas, kepala dihitung baris 1
      kepala.forEach(function (h, j) { if (h) o[h] = normalNilai(h, b[j]); });
      return o;
    });
    return { kolom: kepala, baris: isi, pemisah: pemisah };
  }

  // Definisi berkas yang boleh diunggah. kolom wajib ditandai w.
  var BERKAS = {
    // Struktur organisasi: entitas, direktorat, divisi, departemen, cost center.
    ORGANISASI: {
      kode: "ORGANISASI", cap: "admin", urutan: 0,
      kolom: [
        { k: "entity_id", w: true }, { k: "entity_name", w: true }, { k: "country", w: true },
        { k: "currency", w: false },
        { k: "directorate_id", w: true }, { k: "directorate_name", w: true },
        { k: "division_id", w: true }, { k: "division_name", w: true },
        { k: "department_id", w: true }, { k: "department_name", w: true },
        { k: "cost_center_id", w: true }, { k: "cost_center_name", w: false }
      ],
      contoh: [{ entity_id: "ENT-KSNI", entity_name: "PT Kaldu Sari Nabati Indonesia", country: "ID",
                 currency: "IDR", directorate_id: "DIR-COM", directorate_name: "Commercial",
                 division_id: "DIV-COM", division_name: "Commercial",
                 department_id: "D-MKT", department_name: "Marketing",
                 cost_center_id: "CC-2100", cost_center_name: "Marketing" }]
    },
    POSISI: {
      kode: "POSISI", cap: "admin", urutan: 1,
      kolom: [
        { k: "position_id", w: true }, { k: "code", w: false }, { k: "title", w: true },
        { k: "grade_id", w: true }, { k: "department_id", w: true },
        { k: "is_unique", w: false }, { k: "headcount_slot", w: false }
      ],
      contoh: [{ position_id: "POS-MKT-004", code: "MKT-4A-004", title: "Digital Marketing Officer",
                 grade_id: "4A", department_id: "D-MKT", is_unique: 0, headcount_slot: 3 }]
    },
    // Karyawan dengan atasan langsung. Kolom keterbacaan manusia (legal_entity, country,
    // directorate, division, position_title, direct_report_name, direct_report_position)
    // hanya diperiksa cocok, yang dipercaya sistem adalah id-nya.
    KARYAWAN: {
      kode: "KARYAWAN", cap: "master.employee.edit", urutan: 2,
      kolom: [
        { k: "employee_id", w: true }, { k: "name", w: true }, { k: "position_id", w: true },
        { k: "position_title", w: false }, { k: "grade_id", w: true },
        { k: "legal_entity", w: false }, { k: "country", w: false },
        { k: "directorate", w: false }, { k: "division", w: false },
        { k: "department_id", w: true }, { k: "employment_status", w: false },
        { k: "join_date", w: false }, { k: "direct_report_id", w: false },
        { k: "direct_report_name", w: false }, { k: "direct_report_position", w: false },
        { k: "nik_sementara", w: false }
      ],
      contoh: [{ employee_id: "NBT2004", name: "Dimas Handayani", position_id: "POS-MKT-003",
                 position_title: "Assistant Brand Manager", grade_id: "4C",
                 legal_entity: "PT Kaldu Sari Nabati Indonesia", country: "ID",
                 directorate: "Commercial", division: "Commercial", department_id: "D-MKT",
                 employment_status: "Tetap", join_date: "2019-03-04",
                 direct_report_id: "NBT2002", direct_report_name: "Ayu Permata",
                 direct_report_position: "Brand Manager", nik_sementara: "" }]
    },
    VACANCY: {
      kode: "VACANCY", cap: "admin", urutan: 3,
      kolom: [
        { k: "vacancy_id", w: true }, { k: "position_id", w: true }, { k: "department_id", w: true },
        { k: "grade_id", w: false }, { k: "vacancy_date", w: false },
        { k: "source", w: false }, { k: "status", w: false }
      ],
      contoh: [{ vacancy_id: "VAC-001", position_id: "POS-MKT-004", department_id: "D-MKT",
                 grade_id: "4A", vacancy_date: "2025-09-15", source: "Resign", status: "Open" }]
    },
    // Pengguna non-lini saja. HOD dan manajer diturunkan otomatis dari pohon; baris yang
    // menautkan employee_id hanya menyumbang user_id, nama, dan surel.
    PENGGUNA: {
      kode: "PENGGUNA", cap: "admin", urutan: 4,
      kolom: [
        { k: "user_id", w: true }, { k: "name", w: true }, { k: "email", w: true },
        { k: "role", w: true }, { k: "title", w: false }, { k: "employee_id", w: false },
        { k: "scope_type", w: false }, { k: "scope_ids", w: false }
      ],
      contoh: [{ user_id: "U-OD-01", name: "M. Dzuhri", email: "od.lead@nabati.co.id", role: "OD",
                 title: "Organization Development Lead", employee_id: "", scope_type: "ALL", scope_ids: "" }]
    },
    // Lima angka utama diisi langsung; tiga belas rincian di sebelahnya sebagai keterangan.
    ASUMSI: {
      kode: "ASUMSI", cap: "cost.assumption", urutan: 5,
      kolom: [
        { k: "grade_id", w: true }, { k: "entity_id", w: false },
        { k: "fixed_income", w: true }, { k: "variable_income", w: true }, { k: "company_coverage", w: true },
        { k: "gaji_pokok", w: false }, { k: "tunj_grade", w: false }, { k: "tunj_jabatan", w: false },
        { k: "tunj_komunikasi", w: false }, { k: "tunj_kehadiran", w: false }, { k: "tunj_makan", w: false },
        { k: "tunj_pph21", w: false }, { k: "tunj_cop_hop", w: false },
        { k: "bpjs_kes", w: false }, { k: "jht", w: false }, { k: "jkk", w: false }, { k: "jkm", w: false },
        { k: "jp", w: false }, { k: "jkp", w: false }, { k: "asuransi_pihak_ketiga", w: false },
        { k: "accrual_thr", w: true }, { k: "accrual_bonus", w: true }
      ],
      contoh: [{ grade_id: "4A", entity_id: "", fixed_income: 14300000, variable_income: 2500000, company_coverage: 1600000,
                 gaji_pokok: 12000000, tunj_grade: 1200000, tunj_jabatan: 0, tunj_komunikasi: 350000,
                 tunj_kehadiran: 400000, tunj_makan: 600000, tunj_pph21: 1500000, tunj_cop_hop: 0,
                 bpjs_kes: 480000, jht: 488000, jkk: 71000, jkm: 40000, jp: 211000, jkp: 29000,
                 asuransi_pihak_ketiga: 250000, accrual_thr: 1100000, accrual_bonus: 1100000 }]
    },
    KURS: {
      kode: "KURS", cap: "cost.assumption", urutan: 6,
      kolom: [
        { k: "currency", w: true }, { k: "rate_to_idr", w: true },
        { k: "effective_date", w: true }, { k: "source", w: false }
      ],
      contoh: [{ currency: "MYR", rate_to_idr: 3650, effective_date: "2027-01-01", source: "Kurs tengah BI" }]
    },
    USULAN: {
      kode: "USULAN", cap: "plan.create", urutan: 7,
      kolom: [
        { k: "department_id", w: true }, { k: "action_type", w: true },
        { k: "employee_id", w: false }, { k: "position_id", w: false }, { k: "vacancy_id", w: false },
        { k: "new_position_title", w: false }, { k: "target_grade_id", w: false },
        { k: "target_department_id", w: false }, { k: "target_manager_id", w: false },
        { k: "vacancy_subtype", w: false },
        { k: "reduction_reason", w: false }, { k: "replacement_flag", w: false },
        { k: "quantity", w: false }, { k: "effective_month", w: true },
        { k: "fill_immediately", w: false }, { k: "justification", w: true }
      ],
      contoh: [{ department_id: "D-MKT", action_type: "EXTERNAL_HIRING", employee_id: "",
                 position_id: "POS-MKT-004", vacancy_id: "", new_position_title: "",
                 target_grade_id: "", target_department_id: "", target_manager_id: "", vacancy_subtype: "",
                 reduction_reason: "", replacement_flag: "Additional", quantity: 1,
                 effective_month: 3, fill_immediately: "",
                 justification: "Menambah kapasitas eksekusi kampanye digital 2027" }]
    },
    REALISASI: {
      kode: "REALISASI", cap: "actual.record", urutan: 8,
      kolom: [
        { k: "allocation_id", w: true }, { k: "quantity", w: true },
        { k: "actual_date", w: true }, { k: "employee_name", w: false }, { k: "employee_id", w: false }
      ],
      contoh: [{ allocation_id: "ALO-2027-0001", quantity: 1, actual_date: "2027-03-10",
                 employee_name: "Nama yang benar-benar masuk" }]
    }
  };

  function def(kode) { return BERKAS[kode] || null; }
  function daftar() {
    return Object.keys(BERKAS).sort(function (a, b) { return BERKAS[a].urutan - BERKAS[b].urutan; });
  }

  // Templat berisi kepala kolom dan satu baris contoh, supaya format tidak perlu ditebak.
  function templat(kode) {
    var b = def(kode);
    if (!b) return "";
    var kolom = b.kolom.map(function (k) { return { kunci: k.k, label: k.k }; });
    return NBReport.keCsv(kolom, b.contoh);
  }

  // Kolom kunci per berkas, untuk menolak kode yang muncul dua kali (F10-4).
  var KUNCI_BERKAS = { ORGANISASI: "department_id", POSISI: "position_id", KARYAWAN: "employee_id",
                       VACANCY: "vacancy_id", PENGGUNA: "user_id", ASUMSI: "grade_id" };
  function barisGanda(kode, baris) {
    var kunci = KUNCI_BERKAS[kode];
    if (!kunci) return {};
    var hitung = {}, ganda = {};
    function nilai(r) { return kode === "ASUMSI" ? (r.grade_id + "|" + (r.entity_id || "")) : r[kunci]; }
    baris.forEach(function (r) { var v = nilai(r); if (v) hitung[v] = (hitung[v] || 0) + 1; });
    baris.forEach(function (r) { var v = nilai(r); if (v && hitung[v] > 1) ganda[r._baris] = r[kunci]; });
    return ganda;
  }

  // Pemeriksaan bentuk berkas sebelum isinya diperiksa satu per satu.
  function periksaKepala(kode, kolom) {
    var b = def(kode);
    if (!b) return { ok: false, kunci: "imp.errBerkas" };
    var kurang = b.kolom.filter(function (k) { return k.w && kolom.indexOf(k.k) === -1; })
                        .map(function (k) { return k.k; });
    if (kurang.length) return { ok: false, kunci: "imp.errKolom", vars: { k: kurang.join(", ") } };
    return { ok: true };
  }

  global.NBImpor = {
    urai: urai, def: def, daftar: daftar, templat: templat, tanggalDari: tanggalDari,
    barisGanda: barisGanda, normalKepala: normalKepala,
    periksaKepala: periksaKepala, BERKAS: BERKAS
  };
})(window);
