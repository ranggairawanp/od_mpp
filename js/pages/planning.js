// Layar MPP Planning (FR-03). Modul 2A: tabel usulan, tambah, ubah, hapus, validasi langsung.
// Modul 2B akan mengubahnya menjadi editor mirip spreadsheet dengan kolom bulan.
(function (global) {
  "use strict";

  var T = function (k, v) { return NBi18n.t(k, v); };
  var state = { department_id: null, edit: null };

  function deptAktif() {
    var deps = NBStore.departemenTerlihat();
    if (state.department_id && deps.filter(function (d) { return d.department_id === state.department_id; }).length) {
      return state.department_id;
    }
    return deps.length ? deps[0].department_id : null;
  }

  function labelAction(kode) { return T("act." + kode); }

  // Deskripsi sasaran baris dalam satu kalimat pendek.
  function sasaran(b) {
    if (b.employee_id) {
      var e = NBStore.karyawan(b.employee_id);
      if (!e) return "-";
      var p = NBStore.posisi(e.position_id);
      return "<div class='nb-cell-title'>" + NBUi.esc(e.name) + "</div>" +
             "<div class='nb-cell-sub'>" + NBUi.esc(p ? p.title : "") + " &middot; " + NBUi.esc(e.grade_id) + "</div>";
    }
    if (b.vacancy_id) {
      var v = NBStore.vacancyTerlihat().filter(function (x) { return x.vacancy_id === b.vacancy_id; })[0];
      return "<div class='nb-cell-title'>" + NBUi.esc(v ? v.position_title : b.vacancy_id) + "</div>" +
             "<div class='nb-cell-sub nb-mono'>" + NBUi.esc(b.vacancy_id) + "</div>";
    }
    if (b.new_position_title) {
      return "<div class='nb-cell-title'>" + NBUi.esc(b.new_position_title) + "</div>" +
             "<div class='nb-cell-sub'>" + NBUi.esc(T("plan.posisiBaru")) + "</div>";
    }
    if (b.position_id) {
      var pos = NBStore.posisi(b.position_id);
      return "<div class='nb-cell-title'>" + NBUi.esc(pos ? pos.title : b.position_id) + "</div>" +
             "<div class='nb-cell-sub'>" + NBUi.esc(pos ? pos.grade_id : "") + "</div>";
    }
    return "-";
  }

  function rincian(b) {
    var bagian = [];
    if (b.target_grade_id) bagian.push(T("plan.keGrade", { g: b.target_grade_id }));
    if (b.target_department_id) {
      var d = NBStore.departemen(b.target_department_id);
      bagian.push(T("plan.keDept", { d: d ? d.name : b.target_department_id }));
    }
    if (b.vacancy_subtype) bagian.push(T("vsub." + b.vacancy_subtype));
    if (b.replacement_flag) bagian.push(T("rep." + b.replacement_flag));
    if (b.reduction_reason) bagian.push(b.reduction_reason);
    if (b.fill_immediately) bagian.push(T("plan.isiLangsung"));
    if (b.parent_line_item_id) bagian.push(T("plan.turunanDari", { id: b.parent_line_item_id }));
    return bagian.length
      ? bagian.map(function (x) { return NBUi.esc(x); }).join(" &middot; ")
      : "<span class='nb-muted'>-</span>";
  }

  function barisTabel(b, bolehUbah) {
    var hasil = NBStore.periksaBaris(b);
    var d = NBActions.dampakHc(b);
    var ditimpa = b.status === "SUPERSEDED";
    var pengusul = b.proposed_by ? (NBStore.pengguna(b.proposed_by) || {}).name : null;
    var tanda = ditimpa
      ? NBUi.badge(T("plan.statusSUPERSEDED"), "is-plain")
      : hasil.errors.length
      ? NBUi.badge(T("plan.errorN", { n: hasil.errors.length }), "is-red")
      : (hasil.warnings.length
          ? NBUi.badge(T("plan.warnN", { n: hasil.warnings.length }), "is-amber")
          : NBUi.badge(T("plan.siap"), "is-emerald"));

    var pesan = (pengusul && b.proposed_role === "MANAGER"
      ? "<div class='nb-cell-sub'>" + NBUi.esc(T("plan.diusulkanOleh", { n: pengusul })) + "</div>" : "") +
      hasil.errors.concat(hasil.warnings).map(function (g) {
      return "<div class='nb-cell-sub'>" + NBUi.esc(g.kode + " " + T(g.kunci, g.vars)) + "</div>";
    }).join("");

    return "<tr" + (ditimpa ? " style='opacity:.55'" : "") + ">" +
      "<td><span class='nb-code'>" + NBUi.esc(b.line_item_id) + "</span></td>" +
      "<td>" + NBUi.badge(labelAction(b.action_type), (NBActions.def(b.action_type) || {}).badge) + "</td>" +
      "<td>" + sasaran(b) + "</td>" +
      "<td>" + rincian(b) + "</td>" +
      "<td>" + (bolehUbah && !ditimpa && NBActions.def(b.action_type).perluBulan
          ? "<select class='nb-select nb-kisi' data-kisi-bulan='" + b.line_item_id + "' style='width:96px;padding:6px 28px 6px 10px'>" +
            "<option value=''>-</option>" + [1,2,3,4,5,6,7,8,9,10,11,12].map(function (m) {
              return "<option value='" + m + "'" + (Number(b.effective_month) === m ? " selected" : "") + ">" +
                NBUi.esc(NBFormat.bulanPendek(m)) + "</option>"; }).join("") + "</select>"
          : (b.effective_month ? NBUi.esc(NBFormat.bulanPendek(b.effective_month))
                               : "<span class='nb-muted'>-</span>")) + "</td>" +
      "<td class='nb-num'>" + (bolehUbah && !ditimpa && NBActions.def(b.action_type).perluKuantitas
          ? "<input class='nb-input nb-kisi' type='number' min='1' data-kisi-qty='" + b.line_item_id + "' value='" +
            NBUi.esc(String(b.quantity)) + "' style='width:70px;padding:6px 8px;text-align:right'>"
          : (NBActions.def(b.action_type).perluKuantitas ? b.quantity : "1")) + "</td>" +
      "<td class='nb-num'>" + (d.perusahaan === 0
          ? "<span class='nb-muted'>0</span>"
          : "<b>" + NBFormat.delta(d.perusahaan) + "</b>") + "</td>" +
      "<td>" + tanda + pesan + "</td>" +
      (bolehUbah
        ? "<td class='nb-num' style='white-space:nowrap'>" +
          "<button class='nb-btn nb-btn-outline' data-ubah='" + b.line_item_id + "'>" +
            NBUi.esc(T("umum.ubah")) + "</button> " +
          "<button class='nb-btn nb-btn-ghost-danger' data-hapus='" + b.line_item_id + "'>" +
            NBUi.esc(T("plan.hapus")) + "</button></td>"
        : "") +
    "</tr>";
  }

  // Formulir baris. Bidang yang tampil mengikuti definisi action, bukan daftar tetap,
  // supaya menambah action type baru tidak perlu menyentuh layar ini.
  // baris: data tersimpan, null kalau baris baru. nilai: isi formulir saat ini,
  // dipakai saat pengguna mengganti jenis action sehingga bidangnya digambar ulang.
  function formulir(deptId, baris, nilai) {
    var b = nilai || baris || { action_type: "PROMOTION", quantity: 1, effective_month: "" };
    var a = NBActions.def(b.action_type);
    // Keputusan 3b: karyawan ber-NIK sementara tidak ditawarkan sampai NIK aslinya masuk.
    var karyawan = NBStore.karyawanTerlihat({ department_id: deptId }).filter(function (e) { return !e.sementara; });
    var vacancy = NBStore.vacancyTerlihat().filter(function (v) {
      return v.department_id === deptId && (v.status === "Open" || v.vacancy_id === b.vacancy_id);
    });
    var posisi = NBStore.posisiTerlihat().filter(function (p) { return p.department_id === deptId; });
    var induk = NBStore.barisSubmission(b.submission_id || "").filter(function (x) {
      return x.action_type === "POSITION_CREATION" && !x.fill_immediately && x.line_item_id !== b.line_item_id;
    });

    function opsi(list, nilai, kunci, label) {
      return "<option value=''>" + NBUi.esc(T("plan.pilih")) + "</option>" + list.map(function (x) {
        return "<option value='" + x[kunci] + "'" + (nilai === x[kunci] ? " selected" : "") + ">" +
               NBUi.esc(label(x)) + "</option>";
      }).join("");
    }
    function bidang(judul, isi) {
      return "<div><div class='nb-field-label'>" + NBUi.esc(judul) + "</div>" + isi + "</div>";
    }

    var f = [];
    f.push(bidang(T("plan.fAction"),
      "<select class='nb-select' id='fAction'>" + NBActions.daftar().map(function (k) {
        return "<option value='" + k + "'" + (b.action_type === k ? " selected" : "") + ">" +
               NBUi.esc(labelAction(k)) + "</option>";
      }).join("") + "</select>"));

    if (a.basis === "employee") {
      f.push(bidang(T("umum.karyawan"),
        "<select class='nb-select' id='fEmployee'>" + opsi(karyawan, b.employee_id, "employee_id",
          function (e) { return e.name + " (" + e.grade_id + ")"; }) + "</select>"));
    }
    if (a.basis === "vacancy") {
      f.push(bidang(T("snap.thVacancy"),
        "<select class='nb-select' id='fVacancy'>" + opsi(vacancy, b.vacancy_id, "vacancy_id",
          function (v) { return v.position_title + " (" + v.grade_id + ", " + v.source + ")"; }) + "</select>"));
    }
    if (a.basis === "position") {
      f.push(bidang(T("umum.posisi"),
        "<select class='nb-select' id='fPosition'>" + opsi(posisi, b.position_id, "position_id",
          function (p) { return p.title + " (" + p.grade_id + ")"; }) + "</select>"));
    }
    if (a.perluJudulPosisi) {
      f.push(bidang(T("plan.fJudulPosisi"),
        "<input class='nb-input' id='fTitle' value='" + NBUi.esc(b.new_position_title || "") + "'>"));
    }
    if (a.perluGrade) {
      f.push(bidang(T("plan.fGrade"),
        "<select class='nb-select' id='fGrade'>" + opsi(NBStore.semuaGrade(), b.target_grade_id, "grade_id",
          function (g) { return g.grade_id + " " + g.label; }) + "</select>"));
    }
    if (a.perluDeptTujuan) {
      f.push(bidang(T("plan.fDeptTujuan"),
        "<select class='nb-select' id='fDeptTujuan'>" +
          opsi(NBStore.semuaDepartemen(), b.target_department_id, "department_id",
               function (d) { return d.name; }) + "</select>"));
    }
    if (a.perluAtasanTujuan) {
      // Calon atasan baru: manajer 5A ke atas di departemen yang sama, selain atasan sekarang.
      var calonAtasan = NBStore.karyawanTerlihat({ department_id: deptId }).filter(function (e) {
        return NBStore.levelGrade(e.grade_id) >= NBOrganisasi.LEVEL_MANAJER && e.employee_id !== b.employee_id;
      });
      f.push(bidang(T("plan.fAtasanTujuan"),
        "<select class='nb-select' id='fAtasanTujuan'>" +
          opsi(calonAtasan, b.target_manager_id, "employee_id",
               function (e) { return e.name + " (" + e.grade_id + ")"; }) + "</select>"));
    }
    if (a.perluSubtipe) {
      f.push(bidang(T("plan.fSubtipe"),
        "<select class='nb-select' id='fSubtipe'>" +
          opsi(Object.keys(NBActions.VACANCY_SUB).map(function (k) { return { k: k }; }),
               b.vacancy_subtype, "k", function (x) { return T("vsub." + x.k); }) + "</select>"));
    }
    if (a.perluSebabKurang) {
      f.push(bidang(T("plan.fSebab"),
        "<select class='nb-select' id='fSebab'>" +
          opsi(NBActions.SEBAB_KURANG.map(function (x) { return { k: x }; }),
               b.reduction_reason, "k", function (x) { return x.k; }) + "</select>"));
    }
    if (a.perluSebabKurang) {
      // Pindah entitas: departemen tujuan di legal entity lain (F9-1). Selalu ditawarkan,
      // validasi yang menentukan wajib atau tidak sesuai sebab yang dipilih.
      var deptLain = NBStore.semuaDepartemen().filter(function (d) {
        return NBStore.entitasDepartemen(d.department_id) !== NBStore.entitasDepartemen(deptId);
      });
      if (deptLain.length) {
        f.push(bidang(T("plan.fDeptEntitasLain"),
          "<select class='nb-select' id='fDeptTujuan'><option value=''>-</option>" +
            opsi(deptLain, b.target_department_id, "department_id",
                 function (d) { return d.name + " (" + (NBStore.entitasDepartemen(d.department_id) || "") + ")"; }) + "</select>"));
      }
    }
    if (a.perluReplacement) {
      f.push(bidang(T("plan.fReplacement"),
        "<select class='nb-select' id='fReplacement'>" +
          opsi([{ k: "Replacement" }, { k: "Additional" }], b.replacement_flag, "k",
               function (x) { return T("rep." + x.k); }) + "</select>"));
    }
    if (a.perluKuantitas) {
      f.push(bidang(T("plan.fKuantitas"),
        "<input class='nb-input' id='fQty' type='number' min='1' value='" + (b.quantity || 1) + "'>"));
    }
    if (a.perluBulan) {
      f.push(bidang(T("plan.fBulan"),
        "<select class='nb-select' id='fBulan'>" + opsi(
          [1,2,3,4,5,6,7,8,9,10,11,12].map(function (m) { return { m: String(m) }; }),
          b.effective_month ? String(b.effective_month) : "", "m",
          function (x) { return NBFormat.bulanNama(Number(x.m)) + " (" +
            T("plan.nBulanBiaya", { n: NBFormat.bulanBerlaku(Number(x.m)) }) + ")"; }) + "</select>"));
    }
    if (a.bisaIsiLangsung) {
      f.push(bidang(T("plan.fIsiLangsung"),
        "<label style='display:flex;gap:8px;align-items:center;font-size:14px'>" +
        "<input type='checkbox' class='nb-check' id='fIsiLangsung'" + (b.fill_immediately ? " checked" : "") + ">" +
        NBUi.esc(T("plan.fIsiLangsungKet")) + "</label>"));
    }
    if (induk.length && (b.action_type === "EXTERNAL_HIRING")) {
      f.push(bidang(T("plan.fInduk"),
        "<select class='nb-select' id='fInduk'>" + opsi(induk, b.parent_line_item_id, "line_item_id",
          function (x) { return x.line_item_id + " " + (x.new_position_title || ""); }) + "</select>"));
    }

    return "<div class='nb-overlay' id='mPlan'><div class='nb-modal' style='max-width:720px'>" +
      "<div class='nb-modal-head'><div><div class='nb-modal-title'><h2>" +
        NBUi.esc(baris ? T("plan.ubahBaris") : T("plan.tambahBaris")) + "</h2></div>" +
        "<div class='nb-metachips'><span class='nb-metachip'>" +
          NBUi.esc((NBStore.departemen(deptId) || {}).name) + "</span>" +
        (baris && baris.line_item_id
          ? "<span class='nb-metachip is-code'>" + NBUi.esc(baris.line_item_id) + "</span>" : "") +
        "</div></div>" +
        "<button class='nb-iconbtn' data-tutup='1'>&times;</button></div>" +
      "<div class='nb-modal-body'><div class='nb-section'>" +
        "<div class='nb-section-head'><span class='nb-roman'>I</span><h4>" +
          NBUi.esc(T("plan.seksiAction")) + "</h4></div>" +
        "<div class='nb-fields'>" + f.join("") + "</div>" +
        "<div style='margin-top:16px'><div class='nb-field-label'>" + NBUi.esc(T("plan.fAlasan")) + "</div>" +
        "<textarea class='nb-input' id='fAlasan' rows='2' style='resize:vertical' placeholder='" +
          NBUi.esc(T("plan.fAlasanPlaceholder")) + "'>" + NBUi.esc(b.justification || "") + "</textarea></div>" +
        "<div id='fPesan' style='margin-top:12px'></div>" +
      "</div></div>" +
      "<div class='nb-modal-foot'><button class='nb-btn nb-btn-quiet' data-tutup='1'>" +
        NBUi.esc(T("umum.batal")) + "</button>" +
      "<div class='nb-group'><button class='nb-btn nb-btn-primary' id='fSimpan'>" +
        NBUi.esc(T("umum.simpan")) + "</button></div></div>" +
    "</div></div>";
  }

  // Riwayat singkat status usulan. Catatan pengembalian dari OD ditampilkan apa adanya,
  // karena itu satu-satunya cara HOD tahu apa yang harus diperbaiki.
  function panelStatus(sub) {
    if (!sub) return "";
    var peta = { DRAFT: "is-plain", SUBMITTED: "is-blue", RETURNED: "is-amber", OD_ACCEPTED: "is-emerald" };
    // Paket reguler sudah dibagikan: HOD boleh membuka permintaan di luar siklus (F6-1).
    var bolehLuar = ["APPROVED", "DISTRIBUTED"].indexOf(sub.status) !== -1 &&
      NBRbac.can(NBStore.user(), "plan.submit") && NBStore.siklusAktif().status === "OPEN";
    if (sub.status === "DRAFT" && !sub.review_note && !sub.off_cycle) return "";
    return "<div class='nb-card nb-card-pad' style='margin-bottom:24px'>" +
      "<div class='nb-note' style='align-items:center'>" +
      (sub.off_cycle ? NBUi.badge(T("luar.badge"), "is-violet") + " " : "") +
      NBUi.badge(T("plan.status" + sub.status), peta[sub.status] || "") +
      "<div><div style='font-weight:600'>" + NBUi.esc(T("kirim.status" + sub.status)) + "</div>" +
      (sub.review_note
        ? "<div class='nb-cell-sub'>" + NBUi.esc(T("review.catatanTerakhir", { c: sub.review_note })) + "</div>"
        : "") +
      (sub.submitted_at
        ? "<div class='nb-cell-sub'>" + NBUi.esc(T("kirim.dikirimPada",
            { t: NBFormat.tanggal(sub.submitted_at) })) +
          (sub.is_late ? " " + NBUi.esc(T("review.terlambat")) : "") + "</div>"
        : "") +
      (sub.off_cycle_reason ? "<div class='nb-cell-sub'>" + NBUi.esc(sub.off_cycle_reason) + "</div>" : "") +
      "</div>" +
      (bolehLuar ? "<button class='nb-btn nb-btn-outline' id='pLuar' style='margin-left:auto'>" +
        NBUi.esc(T("luar.tombol")) + "</button>" : "") +
      "</div></div>";
  }

  // Mutasi masuk dari departemen lain. BR-D menuntut persetujuan departemen penerima,
  // jadi baris ini muncul di layar penerima, bukan hanya di layar pengirim.
  function panelMutasi(c, deptId) {
    var masuk = NBStore.mutasiMasuk(c.cycle_id).filter(function (b) {
      return b.transfer_status && (b.target_department_id === deptId ||
        (b.action_type === "INTERNAL_TRANSFER" && b.department_id === deptId));
    });
    if (!masuk.length) return "";
    return "<div class='nb-card' style='margin-bottom:24px'>" +
      "<div class='nb-toolbar'><div><div style='font-weight:600'>" + NBUi.esc(T("mutasi.judul")) + "</div>" +
      "<div class='nb-cell-sub'>" + NBUi.esc(T("mutasi.sub")) + "</div></div></div>" +
      "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
      "<th>" + NBUi.esc(T("umum.karyawan")) + "</th>" +
      "<th>" + NBUi.esc(T("mutasi.thAsal")) + "</th>" +
      "<th>" + NBUi.esc(T("plan.thBulan")) + "</th>" +
      "<th>" + NBUi.esc(T("umum.status")) + "</th>" +
      "<th class='nb-num'>" + NBUi.esc(T("umum.aksi")) + "</th>" +
      "</tr></thead><tbody>" + masuk.map(function (b) {
        var e = NBStore.karyawan(b.employee_id);
        var asal = NBStore.departemen(b.department_id);
        return "<tr><td><div class='nb-cell-title'>" + NBUi.esc(e ? e.name : b.employee_id) + "</div>" +
          "<div class='nb-cell-sub'>" + NBUi.esc(b.justification || "") + "</div></td>" +
          "<td>" + NBUi.esc(asal ? asal.name : b.department_id) + "</td>" +
          "<td>" + NBUi.esc(NBFormat.bulanPendek(b.effective_month)) + "</td>" +
          "<td>" + (b.reduction_reason === "Pindah entitas" ? NBUi.badge(T("pindah.badge"), "is-indigo") + " " : "") +
            NBUi.badge(T("mutasi.st" + b.transfer_status),
              b.transfer_status === "CONFIRMED" ? "is-emerald"
              : (b.transfer_status === "REJECTED" ? "is-red" : "is-amber")) +
            (b.transfer_note ? "<div class='nb-cell-sub'>" + NBUi.esc(b.transfer_note) + "</div>" : "") + "</td>" +
          "<td class='nb-num' style='white-space:nowrap'>" +
            (b.transfer_status === "PENDING"
              ? (b.reduction_reason === "Pindah entitas"
                  ? "<select class='nb-select' data-pindah-posisi='" + b.line_item_id + "' style='width:200px;display:inline-block'>" +
                    NBStore.posisiTerlihat().filter(function (p) { return p.department_id === deptId; }).map(function (p) {
                      return "<option value='" + p.position_id + "'>" + NBUi.esc(p.title + " (" + p.grade_id + ")") + "</option>"; }).join("") +
                    "</select> <button class='nb-btn nb-btn-outline' data-pindah-ok='" + b.line_item_id + "'>" +
                    NBUi.esc(T("pindah.terima")) + "</button> "
                  : "<button class='nb-btn nb-btn-outline' data-mutasi-ok='" + b.line_item_id + "'>" +
                    NBUi.esc(T("mutasi.terima")) + "</button> ") +
                "<button class='nb-btn nb-btn-ghost-danger' data-mutasi-no='" + b.line_item_id + "'>" +
                NBUi.esc(T("mutasi.tolak")) + "</button>"
              : "<span class='nb-muted'>-</span>") + "</td></tr>";
      }).join("") + "</tbody></table></div></div>";
  }

  function render() {
    var u = NBStore.user();
    var c = NBStore.siklusAktif();
    var deps = NBStore.departemenTerlihat();
    var deptId = deptAktif();
    if (!c || !deptId) {
      return "<div class='nb-card'>" + NBUi.kosong(T("dash.siklusKosong"), T("dash.siklusKosongSub")) + "</div>";
    }
    state.department_id = deptId;

    var sub = NBStore.submissionDepartemen(c.cycle_id, deptId);
    var baris = sub ? NBStore.barisSubmission(sub.submission_id) : [];
    var jaga = NBStore.bolehRencana(c.cycle_id, deptId);
    var bolehUbah = jaga.ok;

    var current = NBStore.currentHc(c.cycle_id, deptId);
    var rekap = NBActions.rekap(baris, deptId);
    var proposed = current + rekap.netto;
    var galat = baris.filter(function (b) { return NBStore.periksaBaris(b).errors.length; }).length;

    var pilihDept = deps.length > 1
      ? "<select class='nb-select' id='pDept' style='width:260px'>" + deps.map(function (d) {
          return "<option value='" + d.department_id + "'" +
                 (d.department_id === deptId ? " selected" : "") + ">" + NBUi.esc(d.name) + "</option>";
        }).join("") + "</select>"
      : "<span class='nb-badge is-plain'>" + NBUi.esc((NBStore.departemen(deptId) || {}).name) + "</span>";

    var isi = baris.length
      ? "<div class='nb-tablewrap'><table class='nb-table'><thead><tr>" +
        "<th>" + NBUi.esc(T("plan.thId")) + "</th>" +
        "<th>" + NBUi.esc(T("plan.thAction")) + "</th>" +
        "<th>" + NBUi.esc(T("plan.thSasaran")) + "</th>" +
        "<th>" + NBUi.esc(T("plan.thRincian")) + "</th>" +
        "<th>" + NBUi.esc(T("plan.thBulan")) + "</th>" +
        "<th class='nb-num'>" + NBUi.esc(T("plan.thQty")) + "</th>" +
        "<th class='nb-num'>" + NBUi.esc(T("plan.thHc")) + "</th>" +
        "<th>" + NBUi.esc(T("plan.thValidasi")) + "</th>" +
        (bolehUbah ? "<th class='nb-num'>" + NBUi.esc(T("umum.aksi")) + "</th>" : "") +
        "</tr></thead><tbody>" +
        baris.map(function (b) { return barisTabel(b, bolehUbah); }).join("") +
        "</tbody></table></div>"
      : NBUi.kosong(T("plan.kosong"), T("plan.kosongSub"), NBUi.svg("layers"));

    return "" +
    "<div class='nb-pagehead'><div>" +
      "<h1>" + NBUi.esc(T("plan.judul")) + "</h1>" +
      "<p>" + NBUi.esc(T("plan.sub", { name: c.name })) + "</p></div>" +
      (bolehUbah
        ? "<div style='display:flex;gap:8px'>" +
          "<button class='nb-btn nb-btn-outline' id='pTambah'>" + NBUi.esc(T("plan.tambahBaris")) + "</button>" +
          (baris.length && NBRbac.can(NBStore.user(), "plan.submit")
            ? "<button class='nb-btn nb-btn-primary' id='pKirim'" + (galat ? " disabled" : "") + ">" +
              NBUi.esc(T("kirim.tombol")) + "</button>"
            : (baris.length ? NBUi.badge(T("plan.hodYangKirim"), "is-plain") : "")) + "</div>"
        : NBUi.badge(T(jaga.kunci || "plan.errTutup",
            jaga.kunci === "plan.errTerkunci" && sub
              ? { s: T("plan.status" + sub.status) } : (jaga.vars || {})), "is-amber")) +
    "</div>" +
    panelStatus(sub) +
    panelMutasi(c, deptId) +

    "<div class='nb-kpigrid'>" +
      NBUi.kpi(T("plan.kpiCurrent"), NBFormat.angka(current), "users", "",
               T("plan.kpiCurrentKet")) +
      NBUi.kpi(T("plan.kpiTambah"), NBFormat.delta(rekap.tambah + rekap.masuk), "chart", "is-emerald",
               T("plan.kpiTambahKet", { m: rekap.masuk })) +
      NBUi.kpi(T("plan.kpiKurang"), NBFormat.delta(-(rekap.kurang + rekap.keluar)), "chart", "is-red",
               T("plan.kpiKurangKet", { k: rekap.keluar })) +
      NBUi.kpi(T("plan.kpiProposed"), NBFormat.angka(proposed), "layers", "is-blue",
               T("plan.kpiProposedKet", { n: NBFormat.delta(rekap.netto) })) +
    "</div>" +

    (galat
      ? "<div class='nb-card nb-card-pad' style='margin-bottom:24px;border-color:var(--nb-red-200);" +
        "background:var(--nb-red-50)'><b>" + NBUi.esc(T("plan.adaGalat", { n: galat })) + "</b> " +
        NBUi.esc(T("plan.adaGalatKet")) + "</div>"
      : "") +

    "<div class='nb-card'>" +
      "<div class='nb-toolbar'>" +
        "<div style='display:flex;gap:12px;align-items:center'>" + pilihDept +
        (sub ? NBUi.badge(T("plan.status" + sub.status), sub.status === "DRAFT" ? "is-plain" : "is-blue") : "") +
        "</div>" +
        "<div class='nb-cell-sub'>" + NBUi.esc(T("plan.jumlahBaris", { n: baris.length })) + "</div>" +
      "</div>" + isi +
    "</div>";
  }

  function ambilForm(deptId) {
    function v(id) { var el = document.getElementById(id); return el ? el.value : null; }
    function c(id) { var el = document.getElementById(id); return el ? el.checked : false; }
    return {
      action_type: v("fAction"),
      employee_id: v("fEmployee"), vacancy_id: v("fVacancy"), position_id: v("fPosition"),
      new_position_title: v("fTitle"), target_grade_id: v("fGrade"),
      target_department_id: v("fDeptTujuan"), target_manager_id: v("fAtasanTujuan"),
      vacancy_subtype: v("fSubtipe"),
      reduction_reason: v("fSebab"), replacement_flag: v("fReplacement"),
      quantity: v("fQty") || 1, effective_month: v("fBulan") || 0,
      fill_immediately: c("fIsiLangsung"), parent_line_item_id: v("fInduk"),
      justification: v("fAlasan") || "", department_id: deptId
    };
  }

  function pasangModal(deptId, baris, nilai) {
    var host = document.createElement("div");
    host.innerHTML = formulir(deptId, baris, nilai);
    document.body.appendChild(host.firstChild);
    var modal = document.getElementById("mPlan");

    function tutup() { modal.remove(); }
    modal.querySelectorAll("[data-tutup]").forEach(function (b) { b.onclick = tutup; });
    modal.onclick = function (e) { if (e.target === modal) tutup(); };

    // Mengganti action type menggambar ulang formulir, karena bidang yang perlu diisi berbeda.
    document.getElementById("fAction").onchange = function () {
      var data = ambilForm(deptId);
      if (baris) { data.line_item_id = baris.line_item_id; data.submission_id = baris.submission_id; }
      tutup();
      pasangModal(deptId, baris, data);
    };

    document.getElementById("fSimpan").onclick = function () {
      var c = NBStore.siklusAktif();
      var data = ambilForm(deptId);
      var uji = Object.assign({}, baris || {}, data);
      uji.submission_id = (baris && baris.submission_id) ||
        ((NBStore.submissionDepartemen(c.cycle_id, deptId) || {}).submission_id || "");
      var hasil = NBValidate.periksa(uji, {
        semuaBaris: uji.submission_id ? NBStore.barisSubmission(uji.submission_id) : [],
        gradeAsal: data.employee_id ? (NBStore.karyawan(data.employee_id) || {}).grade_id : null,
        currentHc: null,
        levelGrade: function (id) { return (NBStore.grade(id) || {}).level || 0; }
      });
      if (hasil.errors.length) {
        document.getElementById("fPesan").innerHTML = hasil.errors.map(function (g) {
          return "<div class='nb-badge is-red' style='margin:2px 4px 2px 0'>" +
                 NBUi.esc(g.kode + " " + T(g.kunci, g.vars)) + "</div>";
        }).join("");
        return;
      }
      var res = baris
        ? NBStore.ubahBaris(baris.line_item_id, data)
        : NBStore.tambahBaris(c.cycle_id, deptId, data);
      if (!res.ok) { NBUi.toast(res.kunci ? T(res.kunci, res.vars || {}) : res.alasan, "error"); return; }
      tutup();
      NBUi.toast(T(baris ? "plan.barisDiubah" : "plan.barisDitambah"));
      NBApp.ulang();
    };
  }

  function mount() {
    var deptId = deptAktif();

    var pd = document.getElementById("pDept");
    if (pd) pd.onchange = function () { state.department_id = this.value; NBApp.ulang(); };

    var tambah = document.getElementById("pTambah");
    if (tambah) tambah.onclick = function () { pasangModal(deptId, null); };

    document.querySelectorAll("button[data-ubah]").forEach(function (b) {
      b.onclick = function () {
        var c = NBStore.siklusAktif();
        var sub = NBStore.submissionDepartemen(c.cycle_id, deptId);
        var baris = NBStore.barisSubmission(sub.submission_id).filter(function (x) {
          return x.line_item_id === b.dataset.ubah;
        })[0];
        if (baris) pasangModal(deptId, baris);
      };
    });

    document.querySelectorAll("button[data-hapus]").forEach(function (b) {
      b.onclick = function () {
        NBUi.konfirmasi({
          judul: T("plan.hapusJudul"), pesan: T("plan.hapusTanya", { id: b.dataset.hapus }),
          ok: T("plan.hapus"), batal: T("umum.batal"), gaya: "nb-btn-soft-danger"
        }, function () {
          var res = NBStore.hapusBaris(b.dataset.hapus);
          NBUi.toast(res.ok ? T("plan.barisDihapus") : T(res.kunci || "plan.errTutup", res.vars || {}),
                     res.ok ? "ok" : "error");
          if (res.ok) NBApp.ulang();
        });
      };
    });

    // Kisi (F6-3): perubahan sel tersimpan begitu ditinggalkan, lewat jalur ubahBaris yang sama.
    function simpanSel(el, field) {
      var res = NBStore.ubahBaris(el.dataset.kisiBulan || el.dataset.kisiQty, (function () {
        var o = {}; o[field] = el.value; return o; })());
      if (!res.ok) { NBUi.toast(T(res.kunci, res.vars || {}), "error"); }
      NBApp.ulang();
    }
    document.querySelectorAll("select[data-kisi-bulan]").forEach(function (el) {
      el.onchange = function () { simpanSel(el, "effective_month"); };
    });
    document.querySelectorAll("input[data-kisi-qty]").forEach(function (el) {
      el.onchange = function () { simpanSel(el, "quantity"); };
      el.onkeydown = function (e) { if (e.key === "Enter") { el.blur(); } };
    });
    var luar = document.getElementById("pLuar");
    if (luar) luar.onclick = function () {
      var c = NBStore.siklusAktif();
      NBUi.konfirmasi({
        judul: T("luar.judul"), pesan: T("luar.pesan"),
        perluAlasan: true, labelAlasan: T("luar.alasanLabel"), pesanAlasan: T("review.errAlasan"),
        ok: T("luar.tombol"), batal: T("umum.batal")
      }, function (alasan) {
        var res = NBStore.bukaPermintaanLuarSiklus(c.cycle_id, state.department_id, alasan);
        NBUi.toast(res.ok ? T("luar.dibuka") : T(res.kunci, res.vars || {}), res.ok ? "ok" : "error");
        if (res.ok) NBApp.ulang();
      });
    };
    var kirim = document.getElementById("pKirim");
    if (kirim) kirim.onclick = function () {
      var c = NBStore.siklusAktif();
      NBUi.konfirmasi({
        judul: T("kirim.judul"), pesan: T("kirim.pesan"),
        ok: T("kirim.tombol"), batal: T("umum.batal")
      }, function () {
        var res = NBStore.kirimSubmission(c.cycle_id, deptId);
        NBUi.toast(res.ok ? T("kirim.berhasil") : T(res.kunci, res.vars || {}), res.ok ? "ok" : "error");
        if (res.ok) NBApp.ulang();
      });
    };

    document.querySelectorAll("button[data-mutasi-ok]").forEach(function (b) {
      b.onclick = function () {
        NBUi.konfirmasi({
          judul: T("mutasi.terimaJudul"), pesan: T("mutasi.terimaPesan"),
          ok: T("mutasi.terima"), batal: T("umum.batal")
        }, function () {
          var res = NBStore.konfirmasiMutasi(b.dataset.mutasiOk, "CONFIRM", null);
          NBUi.toast(res.ok ? T("mutasi.diterima") : T(res.kunci, res.vars || {}), res.ok ? "ok" : "error");
          if (res.ok) NBApp.ulang();
        });
      };
    });

    document.querySelectorAll("button[data-pindah-ok]").forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.pindahOk;
        var sel = document.querySelector("select[data-pindah-posisi='" + id + "']");
        NBUi.konfirmasi({
          judul: T("pindah.terimaJudul"), pesan: T("pindah.terimaPesan"),
          perluAlasan: true, labelAlasan: T("review.alasanLabel"), pesanAlasan: T("review.errAlasan"),
          ok: T("pindah.terima"), batal: T("umum.batal")
        }, function (alasan) {
          var res = NBStore.konfirmasiPindahEntitas(id, sel ? sel.value : "", alasan);
          NBUi.toast(res.ok ? T("pindah.diterima", { id: res.baris.line_item_id }) : T(res.kunci, res.vars || {}), res.ok ? "ok" : "error");
          if (res.ok) NBApp.ulang();
        });
      };
    });
    document.querySelectorAll("button[data-mutasi-no]").forEach(function (b) {
      b.onclick = function () {
        NBUi.konfirmasi({
          judul: T("mutasi.tolakJudul"), pesan: T("mutasi.tolakPesan"),
          perluAlasan: true, labelAlasan: T("review.alasanLabel"),
          placeholder: T("mutasi.tolakPlaceholder"), pesanAlasan: T("review.errAlasan"),
          ok: T("mutasi.tolak"), batal: T("umum.batal"), gaya: "nb-btn-soft-danger"
        }, function (alasan) {
          var res = NBStore.konfirmasiMutasi(b.dataset.mutasiNo, "REJECT", alasan);
          NBUi.toast(res.ok ? T("mutasi.ditolak") : T(res.kunci, res.vars || {}), res.ok ? "ok" : "error");
          if (res.ok) NBApp.ulang();
        });
      };
    });
  }

  global.NBPages = global.NBPages || {};
  global.NBPages.planning = { render: render, mount: mount };
})(window);
