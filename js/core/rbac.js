// Kendali akses tiga sumbu: kapabilitas (RBAC), baris (row level), kolom biaya (column level).
// Referensi: bab 23. Prinsip yang tidak boleh dilanggar nomor 2 dan 3.
// Sumbu kolom biaya tidak tertulis di dokumen. Saya tambahkan karena tanpa itu,
// MPP Monitor dan HOD lintas departemen akan melihat nominal yang bukan haknya.
(function (global) {
  "use strict";

  // Kapabilitas diturunkan langsung dari matriks bab 23.
  var CAPS = {
    OD: ["exec.view", "cycle.create", "snapshot.upload", "view.own", "view.all", "plan.create", "plan.submit",
         "plan.review", "consolidate", "cost.view", "approved.distribute", "monitor.all",
         "audit.all", "admin", "dept.note.edit", "master.employee.edit", "actual.record", "actual.approve",
         "cycle.manage", "snapshot.view"],
    HOD: ["view.own", "plan.create", "plan.submit", "plan.review.own", "cost.view.own",
          "monitor.own", "audit.own", "dept.note.edit"],
    CB: ["exec.view", "view.all", "cost.assumption", "cost.import", "cost.calculate", "cost.view", "review.support",
         "monitor.cost", "audit.relevant"],
    MANAGEMENT: ["exec.view", "view.all", "cost.view", "review.decide", "approve", "adjust.approved",
                 "monitor.company", "audit.relevant"],
    MONITOR: ["view.all", "monitor.all", "audit.all", "actual.record"],
    // Manajer 5A ke atas menyusun baris untuk timnya, tetapi tidak mengirim dan tidak
    // melihat nominal (K4 nomor 3 dan 5). Diturunkan otomatis dari pohon, bukan dari berkas.
    MANAGER: ["view.own", "plan.create", "audit.own"],
    // HC Business Partner per entitas: seperti OD tetapi dibatasi entitasnya, tanpa admin.
    HCBP: ["exec.view", "view.own", "plan.create", "plan.submit", "plan.review", "cost.view",
           "monitor.all", "audit.own", "actual.record", "actual.approve", "master.employee.edit", "snapshot.view"],
    // Akun bawaan satu-satunya di aplikasi kosong. Hanya boleh mengunggah struktur dan
    // pengguna, supaya ada jalan masuk pertama tanpa membuka segalanya (K7).
    ADMIN: ["view.all", "admin", "audit.all", "master.employee.edit"]
  };

  var ROLE_LABEL = {
    OD: "Organization Development", HOD: "Head of Department",
    CB: "Compensation & Benefit", MANAGEMENT: "Management", MONITOR: "MPP Monitor",
    MANAGER: "Manager", ADMIN: "Administrator", HCBP: "HC Business Partner"
  };

  function can(user, cap) {
    if (!user) return false;
    return (CAPS[user.role] || []).indexOf(cap) !== -1;
  }

  // Daftar department_id yang boleh dilihat pengguna. Ini satu-satunya sumber
  // kebenaran untuk penyaringan baris. Layar tidak boleh menyaring sendiri.
  function scopeDepartments(user, allDepartments) {
    if (!user) return [];
    if (user.scope.type === "ALL") return allDepartments.map(function (d) { return d.department_id; });
    if (user.scope.type === "DEPARTMENT") return user.scope.ids.slice();
    // Lingkup pohon: departemen tempat karyawan yang dijadikan jangkar berada (K4 nomor 1).
    if (user.scope.type === "TREE") return user.scope.department_id ? [user.scope.department_id] : [];
    // Lingkup entitas: seluruh departemen di bawah entitas yang disebut (HC Business Partner per negara).
    if (user.scope.type === "ENTITY") {
      var ids = user.scope.ids || [];
      return allDepartments.filter(function (d) { return ids.indexOf(d.entity_id) !== -1; })
                           .map(function (d) { return d.department_id; });
    }
    if (user.scope.type === "DIVISION") {
      return allDepartments.filter(function (d) { return user.scope.ids.indexOf(d.division_id) !== -1; })
                           .map(function (d) { return d.department_id; });
    }
    return [];
  }

  function inScope(user, allDepartments, departmentId) {
    return scopeDepartments(user, allDepartments).indexOf(departmentId) !== -1;
  }

  // Penyaring baris generik. Dipakai setiap kali data menyentuh layar.
  function filterRows(user, allDepartments, rows, key) {
    var izin = scopeDepartments(user, allDepartments);
    var k = key || "department_id";
    return rows.filter(function (r) { return izin.indexOf(r[k]) !== -1; });
  }

  // Penyaring tingkat orang. Untuk lingkup pohon, hanya diri sendiri dan bawahan berjenjang
  // di dalam departemen yang terlihat (K4 nomor 1 dan 2). Lingkup lain memakai departemen.
  function filterEmployees(user, allDepartments, employees, pohon) {
    var rows = filterRows(user, allDepartments, employees, "department_id");
    if (!user || user.scope.type !== "TREE" || !pohon) return rows;
    var izin = {};
    izin[user.scope.employee_id] = true;
    NBOrganisasi.bawahan(user.scope.employee_id, pohon, user.scope.department_id)
      .forEach(function (id) { izin[id] = true; });
    return rows.filter(function (e) { return izin[e.employee_id]; });
  }

  function employeeInScope(user, allDepartments, employeeId, pohon) {
    if (!user) return false;
    if (user.scope.type !== "TREE") return true;
    if (employeeId === user.scope.employee_id) return true;
    return NBOrganisasi.bawahan(user.scope.employee_id, pohon, user.scope.department_id)
      .indexOf(employeeId) !== -1;
  }

  // Kolom biaya. MPP Monitor tidak pernah melihat nominal.
  // HOD hanya melihat nominal departemennya sendiri.
  function canSeeCost(user, departmentId) {
    if (!user) return false;
    if (user.role === "MONITOR") return false;
    if (user.role === "MANAGER") return false;
    // HC Business Partner berlingkup entitas melihat nominal entitasnya sendiri.
    if (user.role === "HCBP") {
      if (!departmentId) return true;
      var semuaDept = global.NBRbac && global.NBRbac.daftarDepartemen ? global.NBRbac.daftarDepartemen() : [];
      return inScope(user, semuaDept, departmentId);
    }
    if (user.role === "HOD") {
      if (!departmentId) return false;
      if (user.scope.type === "TREE") return user.scope.department_id === departmentId;
      return user.scope.ids.indexOf(departmentId) !== -1;
    }
    return can(user, "cost.view");
  }

  global.NBRbac = {
    can: can, scopeDepartments: scopeDepartments, inScope: inScope,
    filterRows: filterRows, canSeeCost: canSeeCost,
    filterEmployees: filterEmployees, employeeInScope: employeeInScope,
    roleLabel: function (r) { return ROLE_LABEL[r] || r; },
    caps: CAPS
  };
})(window);
