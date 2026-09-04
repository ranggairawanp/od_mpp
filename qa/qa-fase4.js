// QA fase 4: mutasi antar tim, lingkup entitas, asumsi per entitas, larangan lintas entitas,
// konsolidasi per entitas, mata uang.
const {JSDOM}=require('jsdom'), fs=require('fs');
const FX=require(__dirname + '/fixture.js');
const w=new JSDOM(fs.readFileSync('/home/claude/mpp/dist/index.html','utf8'),
  {runScripts:'dangerously',url:'https://local.test/',pretendToBeVisual:true}).window;
w.scrollTo=()=>{};
const gagal=[]; const cek=(n,ok,i)=>{ if(!ok) gagal.push(n); console.log((ok?'PASS ':'GAGAL')+'  '+n+(!ok&&i?'  ['+i+']':'')); };
setTimeout(()=>{
FX.lengkap(w);
const d=w.document, S=w.NBStore, O=w.NBOrganisasi, I=w.NBImpor, F=w.NBFormat;

// ---------- A. Mutasi antar tim di dalam departemen (K4 nomor 7) ----------
S.masuk('U-OD-01');
const pohon=S.pohonOrganisasi();
const manajerMkt=S.semuaPengguna().filter(u=>u.role==='MANAGER'&&u.scope.department_id==='D-MKT');
const m1=manajerMkt[0];
// Atasan baru: Brand Manager 5A lain di Marketing yang belum punya bawahan.
const m2={employee_id:S.karyawanTerlihat({department_id:'D-MKT'}).find(e=>e.grade_id==='5A'&&e.employee_id!==m1.employee_id).employee_id};
m2.user_id=null;
cek('A0 ada manajer dan calon atasan baru di Marketing', !!m1 && !!m2.employee_id);
const anak=O.bawahan(m1.employee_id,pohon,'D-MKT')[0];
S.keluar(); S.masuk(m1.user_id);
let tanpa=S.tambahBaris('MPP-2027','D-MKT',{action_type:'INTERNAL_TRANSFER',employee_id:anak,effective_month:4,
  justification:'Beban kerja tim kedua lebih ringan dan cocok dengan keahliannya'});
cek('A1 tanpa atasan baru ditolak V05c', S.periksaBaris(tanpa.baris).errors.some(e=>e.kode==='V05c'));
S.hapusBaris(tanpa.baris.line_item_id);
let sama=S.tambahBaris('MPP-2027','D-MKT',{action_type:'INTERNAL_TRANSFER',employee_id:anak,target_manager_id:m1.employee_id,
  effective_month:4,justification:'Atasan baru sengaja disamakan dengan atasan sekarang'});
cek('A2 atasan baru sama dengan sekarang ditolak V05e', S.periksaBaris(sama.baris).errors.some(e=>e.kode==='V05e'));
S.hapusBaris(sama.baris.line_item_id);
let luar=S.tambahBaris('MPP-2027','D-MKT',{action_type:'INTERNAL_TRANSFER',employee_id:anak,target_manager_id:'NBT2021',
  effective_month:4,justification:'Atasan baru sengaja dari departemen lain'});
cek('A3 atasan baru di departemen lain ditolak V05d', S.periksaBaris(luar.baris).errors.some(e=>e.kode==='V05d'));
S.hapusBaris(luar.baris.line_item_id);
let sah=S.tambahBaris('MPP-2027','D-MKT',{action_type:'INTERNAL_TRANSFER',employee_id:anak,target_manager_id:m2.employee_id,
  effective_month:4,justification:'Beban kerja tim kedua lebih ringan dan cocok dengan keahliannya'});
cek('A4 mutasi internal yang sah lolos dengan peringatan menunggu HOD',
    S.periksaBaris(sah.baris).errors.length===0 && S.periksaBaris(sah.baris).warnings.some(x=>x.kode==='W05b'));
cek('A5 dampak headcount nol', w.NBActions.dampakHc(sah.baris).perusahaan===0 && w.NBActions.dampakHc(sah.baris).asal===0);
S.keluar(); S.masuk('U-HOD-MKT'); S.kirimSubmission('MPP-2027','D-MKT');
cek('A6 setelah dikirim berstatus menunggu', S.barisSubmission(sah.baris.submission_id).find(b=>b.line_item_id===sah.baris.line_item_id).transfer_status==='PENDING');
S.keluar(); S.masuk(m1.user_id);
cek('A7 manajer tidak bisa mengonfirmasi mutasi internal', !S.konfirmasiMutasi(sah.baris.line_item_id,'CONFIRM',null).ok);
cek('A8 manajer tidak melihat mutasi internal di daftar menunggu', S.mutasiMasuk('MPP-2027').every(b=>b.action_type!=='INTERNAL_TRANSFER'));
S.keluar(); S.masuk('U-HOD-MKT');
cek('A9 HOD melihat mutasi internal di daftar menunggu', S.mutasiMasuk('MPP-2027').some(b=>b.line_item_id===sah.baris.line_item_id));
cek('A10 HOD mengonfirmasi', S.konfirmasiMutasi(sah.baris.line_item_id,'CONFIRM',null).ok);
S.keluar(); S.masuk('U-OD-01'); S.reviewSubmission('SUB-2027-MKT','ACCEPT',null);
const k=S.konsolidasi('MPP-2027');
cek('A11 konsolidasi tidak terpengaruh mutasi internal', k.perDept.find(x=>x.department_id==='D-MKT').netto===2);
cek('A12 biaya mutasi internal nol', S.biayaBaris(sah.baris).annualized_cost===0);

// ---------- B. Entitas kedua, lingkup entitas, asumsi per entitas ----------
S.keluar(); S.masuk('U-ADMIN');
const orgMy=I.urai('entity_id;entity_name;country;currency;directorate_id;directorate_name;division_id;division_name;department_id;department_name;cost_center_id;cost_center_name\n'+
 'ENT-NBM;Nabati Malaysia Sdn Bhd;MY;MYR;MY-DIR;Malaysia Operations;MY-OPS;Operations Malaysia;MY-PRD;Produksi Johor;MY-CC-01;Produksi Johor\n');
S.terapkanImpor('ORGANISASI',orgMy.baris,null);
S.terapkanImpor('POSISI',I.urai('position_id;code;title;grade_id;department_id;is_unique;headcount_slot\nMY-P1;MY-P1;Plant Manager;5A;MY-PRD;1;1\nMY-P2;MY-P2;Operator;2A;MY-PRD;0;20\n').baris,null);
S.terapkanImpor('KARYAWAN',I.urai('employee_id;name;position_id;grade_id;department_id;direct_report_id\nMY001;Ahmad Faizal;MY-P1;5A;MY-PRD;\nMY002;Lim Wei;MY-P2;2A;MY-PRD;MY001\nMY003;Siti Nur;MY-P2;2A;MY-PRD;MY001\n').baris,null);
cek('B1 entitas kedua dan karyawannya masuk', S.semuaEntitas().length===2 && S.karyawan('MY002').entity_id==='ENT-NBM');
cek('B2 mata uang entitas tersimpan dari berkas struktur', S.semuaEntitas().find(e=>e.entity_id==='ENT-NBM').currency==='MYR', S.semuaEntitas().find(e=>e.entity_id==='ENT-NBM').currency);
// pengguna HCBP berlingkup entitas Malaysia
const pu=S.pratinjauImpor('PENGGUNA',I.urai('user_id;name;email;role;title;employee_id;scope_type;scope_ids\nU-HCBP-MY;Nurul Aini;hcbp.my@nabati.com;HCBP;HCBP Malaysia;;ENTITY;ENT-NBM\nU-HCBP-X;Salah;x@x;HCBP;;;ENTITY;ENT-TIDAK-ADA\nU-HCBP-Y;Kosong;y@y;HCBP;;;ENTITY;\n').baris,null);
cek('B3 lingkup entitas yang sah diterima, yang asing dan kosong ditolak',
    pu.hasil[0].ok && pu.hasil[1].kunci==='imp.vEntitasAsing' && pu.hasil[2].kunci==='imp.vEntitasLingkup');
S.terapkanImpor('PENGGUNA',[pu.hasil[0].baris],null);
S.keluar(); S.masuk('U-HCBP-MY');
cek('B4 HCBP hanya melihat departemen entitasnya', S.departemenTerlihat().length===1 && S.departemenTerlihat()[0].department_id==='MY-PRD');
cek('B5 HCBP hanya melihat karyawan entitasnya', S.karyawanTerlihat().every(e=>e.entity_id==='ENT-NBM'));
cek('B6 HCBP melihat nominal entitasnya, tidak entitas lain',
    w.NBRbac.canSeeCost(S.user(),'MY-PRD') && !w.NBRbac.canSeeCost(S.user(),'D-MKT'));
// asumsi biaya khusus Malaysia
S.keluar(); S.masuk('U-CB-01');
const asumsiMy=S.terapkanImpor('ASUMSI',I.urai('grade_id;entity_id;fixed_income;variable_income;company_coverage;accrual_thr;accrual_bonus\n2A;ENT-NBM;2000;300;250;170;170\n5A;ENT-NBM;9000;800;900;750;1100\n').baris,'MPP-2027');
cek('B7 asumsi per entitas masuk sebagai paket sendiri', asumsiMy.masuk===2 && S.semuaAsumsi().some(a=>a.entity_id==='ENT-NBM'));
cek('B8 konteks biaya departemen Malaysia memakai paket Malaysia',
    /ENT-NBM$/.test(S.konteksBiaya('MPP-2027','MY-PRD').assumption_id), S.konteksBiaya('MPP-2027','MY-PRD').assumption_id);
cek('B9 konteks biaya departemen Indonesia tetap paket umum',
    !/ENT-NBM/.test(S.konteksBiaya('MPP-2027','D-MKT').assumption_id));
const asumsiAsing=S.pratinjauImpor('ASUMSI',[{grade_id:'2A',entity_id:'ENT-XX',fixed_income:1,variable_income:0,company_coverage:0,accrual_thr:0,accrual_bonus:0}],'MPP-2027');
cek('B10 asumsi untuk entitas asing ditolak', !asumsiAsing.hasil[0].ok);

// ---------- C. Larangan mutasi lintas entitas ----------
S.keluar(); S.masuk('U-OD-01');
const lintas=S.tambahBaris('MPP-2027','D-PRD',{action_type:'TRANSFER',employee_id:'NBT2030',target_department_id:'MY-PRD',
  effective_month:6,justification:'Percobaan memindahkan orang ke entitas lain'});
cek('C1 mutasi lintas entitas ditolak V05f', S.periksaBaris(lintas.baris).errors.some(e=>e.kode==='V05f'),
    JSON.stringify(S.periksaBaris(lintas.baris).errors.map(e=>e.kode)));
S.hapusBaris(lintas.baris.line_item_id);

// ---------- D. Konsolidasi per entitas ----------
const k2=S.konsolidasi('MPP-2027');
cek('D1 konsolidasi punya tingkat entitas', k2.perEntitas.length===2, String(k2.perEntitas.length));
cek('D2 jumlah entitas sama dengan total perusahaan', k2.perEntitas.reduce((t,e)=>t+e.proposed,0)===k2.total.proposed);
w.location.hash='#konsolidasi'; w.NBApp.ulang();
cek('D3 tab per legal entity tampil bila entitas lebih dari satu', !!d.querySelector("button[data-tab='entitas']"));

// ---------- E. Mata uang mengikuti entitas ----------
S.keluar(); S.masuk('U-HCBP-MY'); w.location.hash='#dashboard'; w.NBApp.ulang();
cek('E1 lambang mata uang Malaysia dipakai untuk lingkup Malaysia',
    (()=>{ const ent=S.semuaEntitas().find(e=>e.entity_id==='ENT-NBM'); return F.rupiah(1000).indexOf(F.lambangMataUang(ent.currency))===0; })(),
    F.rupiah(1000));
S.keluar(); S.masuk('U-OD-01'); w.NBApp.ulang();
cek('E2 lingkup dua entitas kembali ke Rupiah', F.rupiah(1000)==='Rp1.000', F.rupiah(1000));

console.log('\nTOTAL GAGAL: '+gagal.length); gagal.forEach(x=>console.log(' - '+x));
},500);
