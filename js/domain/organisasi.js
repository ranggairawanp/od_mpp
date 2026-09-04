// Pohon organisasi dari kolom atasan langsung. Murni, tanpa DOM, tanpa penyimpanan.
//
// Keputusan yang dipegang di sini:
// 1. Lingkup manajer adalah pohon atasan langsung di dalam departemennya sendiri (K4 nomor 1).
// 2. Manajer diturunkan otomatis: grade 5A ke atas yang punya bawahan (nomor 6).
// 3. HOD diturunkan otomatis: orang di departemen itu yang atasannya berada di luar
//    departemen, atau tidak punya atasan sama sekali.
// 4. Pelaporan melingkar ditolak sebelum masuk data, karena pohon tidak bisa digambar dan
//    lingkup tidak bisa dihitung dari data yang berputar (K8).
(function (global) {
  "use strict";

  var LEVEL_MANAJER = 13;   // grade 5A

  function petaKaryawan(employees) {
    var peta = {};
    employees.forEach(function (e) { peta[e.employee_id] = e; });
    return peta;
  }

  // Peta anak per atasan. Karyawan tanpa atasan yang sah masuk ke daftar puncak.
  function bangunPohon(employees) {
    var anak = {}, puncak = [];
    var peta = petaKaryawan(employees);
    employees.forEach(function (e) {
      var atas = e.direct_report_id;
      if (atas && peta[atas] && atas !== e.employee_id) {
        (anak[atas] = anak[atas] || []).push(e.employee_id);
      } else {
        puncak.push(e.employee_id);
      }
    });
    return { anak: anak, puncak: puncak, peta: peta };
  }

  // Seluruh bawahan berjenjang. batasDept membatasi pohon di dalam satu departemen.
  function bawahan(employeeId, pohon, batasDept) {
    var hasil = [], antre = (pohon.anak[employeeId] || []).slice(), sudah = {};
    while (antre.length) {
      var id = antre.shift();
      if (sudah[id]) continue;
      sudah[id] = true;
      var e = pohon.peta[id];
      if (!e) continue;
      if (batasDept && e.department_id !== batasDept) continue;
      hasil.push(id);
      (pohon.anak[id] || []).forEach(function (c) { antre.push(c); });
    }
    return hasil;
  }

  // Mendeteksi lingkaran pelaporan. Mengembalikan daftar lingkaran, tiap lingkaran daftar id.
  function deteksiSiklus(employees) {
    var peta = petaKaryawan(employees);
    var warna = {}, lingkaran = [];
    employees.forEach(function (mulai) {
      if (warna[mulai.employee_id]) return;
      var jejak = [], id = mulai.employee_id;
      while (id && peta[id] && !warna[id]) {
        warna[id] = "abu";
        jejak.push(id);
        id = peta[id].direct_report_id;
      }
      if (id && warna[id] === "abu") {
        lingkaran.push(jejak.slice(jejak.indexOf(id)));
      }
      jejak.forEach(function (j) { warna[j] = "hitam"; });
    });
    return lingkaran;
  }

  // Atasan yang ditunjuk tetapi tidak ada di data.
  function atasanHilang(employees) {
    var peta = petaKaryawan(employees);
    return employees.filter(function (e) {
      return e.direct_report_id && !peta[e.direct_report_id];
    }).map(function (e) { return { employee_id: e.employee_id, direct_report_id: e.direct_report_id }; });
  }

  // HOD sebuah departemen: orang di dalamnya yang atasannya di luar departemen atau kosong.
  // Bila lebih dari satu, dipilih yang gradenya tertinggi.
  function hodDepartemen(departmentId, employees, levelGrade) {
    var peta = petaKaryawan(employees);
    var calon = employees.filter(function (e) {
      if (e.department_id !== departmentId) return false;
      var atas = e.direct_report_id ? peta[e.direct_report_id] : null;
      return !atas || atas.department_id !== departmentId;
    });
    calon.sort(function (a, b) { return levelGrade(b.grade_id) - levelGrade(a.grade_id); });
    return calon[0] || null;
  }

  // Manajer otomatis: grade 5A ke atas yang punya bawahan langsung.
  function manajerOtomatis(employees, levelGrade) {
    var pohon = bangunPohon(employees);
    return employees.filter(function (e) {
      return levelGrade(e.grade_id) >= LEVEL_MANAJER && (pohon.anak[e.employee_id] || []).length > 0;
    });
  }

  // Tingkat awal yang ditampilkan di bagan: dilipat sampai manajer 5A (K4 nomor 2).
  function bolehDilipat(e, levelGrade) {
    return levelGrade(e.grade_id) >= LEVEL_MANAJER;
  }

  global.NBOrganisasi = {
    LEVEL_MANAJER: LEVEL_MANAJER,
    bangunPohon: bangunPohon, bawahan: bawahan, deteksiSiklus: deteksiSiklus,
    atasanHilang: atasanHilang, hodDepartemen: hodDepartemen,
    manajerOtomatis: manajerOtomatis, bolehDilipat: bolehDilipat
  };
})(window);
