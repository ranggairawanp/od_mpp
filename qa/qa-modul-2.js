// QA Modul 2A: mesin action, validasi, dan layar perencanaan.
const {JSDOM}=require('jsdom'), fs=require('fs');
const F = require(__dirname + '/fixture.js');
const w=new JSDOM(fs.readFileSync('/home/claude/mpp/dist/index.html','utf8'),
  {runScripts:'dangerously',url:'https://local.test/',pretendToBeVisual:true}).window;
w.scrollTo=()=>{}; w.confirm=()=>true;
const gagal=[]; const cek=(n,ok,i)=>{ if(!ok) gagal.push(n); console.log((ok?'PASS ':'GAGAL')+'  '+n+(!ok&&i?'  ['+i+']':'')); };
setTimeout(()=>{
// Aplikasi kosong: data dimuat lewat jalur impor sungguhan.
F.lengkap(w);
const d=w.document, S=w.NBStore, A=w.NBActions, V=w.NBValidate;

// A. Mesin dampak headcount
const mk=o=>Object.assign({action_type:'NO_CHANGE',quantity:1,department_id:'D-MKT'},o);
cek('A1 promosi tidak menambah HC', A.dampakHc(mk({action_type:'PROMOTION'})).perusahaan===0);
cek('A2 hiring 3 menambah 3', A.dampakHc(mk({action_type:'EXTERNAL_HIRING',quantity:3})).perusahaan===3);
cek('A3 mutasi netral di perusahaan', A.dampakHc(mk({action_type:'TRANSFER'})).perusahaan===0);
cek('A4 mutasi minus di asal plus di tujuan',
    A.dampakHc(mk({action_type:'TRANSFER'})).asal===-1 && A.dampakHc(mk({action_type:'TRANSFER'})).tujuan===1);
cek('A5 vacancy fill menambah, retain tidak',
    A.dampakHc(mk({action_type:'VACANCY_ACTION',vacancy_subtype:'FILL'})).perusahaan===1 &&
    A.dampakHc(mk({action_type:'VACANCY_ACTION',vacancy_subtype:'RETAIN'})).perusahaan===0);
cek('A6 posisi baru tanpa diisi tidak menambah',
    A.dampakHc(mk({action_type:'POSITION_CREATION',quantity:2})).perusahaan===0);
cek('A7 posisi baru diisi langsung menambah',
    A.dampakHc(mk({action_type:'POSITION_CREATION',quantity:2,fill_immediately:true})).perusahaan===2);
cek('A8 pengurangan terencana mengurangi', A.dampakHc(mk({action_type:'PLANNED_REDUCTION'})).perusahaan===-1);
// Koreksi Modul 4: baris rekrutmen turunan tetap dihitung, karena itulah yang mengisi slot.
cek('A9 rekrutmen turunan tetap dihitung',
    A.dampakHc(mk({action_type:'EXTERNAL_HIRING',quantity:2,parent_line_item_id:'LI-9'})).perusahaan===2);

// B. Rekap dan anti double counting
const set=[mk({line_item_id:'X1',action_type:'POSITION_CREATION',quantity:1}),
           mk({line_item_id:'X2',action_type:'EXTERNAL_HIRING',quantity:1,parent_line_item_id:'X1'})];
cek('B1 posisi baru plus hiring turunan tetap satu tambahan', A.rekap(set,'D-MKT').tambah===1,
    JSON.stringify(A.rekap(set,'D-MKT')));
const set2=[mk({line_item_id:'X1',action_type:'POSITION_CREATION',quantity:1,fill_immediately:true})];
cek('B2 posisi baru diisi langsung dihitung satu', A.rekap(set2,'D-MKT').tambah===1);

// C. Validasi
const ctx={semuaBaris:[],levelGrade:id=>({'4B':11,'4C':12,'5A':13,'5B':14}[id]||0)};
let r=V.periksa(mk({action_type:'EXTERNAL_HIRING',effective_month:0,quantity:1,justification:'x'}),ctx);
cek('C1 bulan efektif wajib', r.errors.some(e=>e.kode==='V01'));
cek('C2 klasifikasi replacement wajib', r.errors.some(e=>e.kode==='V03'));
cek('C3 alasan pendek ditolak', r.errors.some(e=>e.kode==='V06'));
r=V.periksa(mk({action_type:'PROMOTION',effective_month:5,employee_id:'E1',target_grade_id:'4B',
  justification:'alasan yang cukup panjang'}),Object.assign({},ctx,{gradeAsal:'5A'}));
cek('C4 promosi turun grade ditolak', r.errors.some(e=>e.kode==='V04c'));
r=V.periksa(mk({action_type:'PROMOTION',effective_month:5,employee_id:'E1',target_grade_id:'5B',
  justification:'alasan yang cukup panjang'}),Object.assign({},ctx,{gradeAsal:'4C'}));
cek('C5 lompat dua grade jadi peringatan', r.errors.length===0 && r.warnings.some(g=>g.kode==='W04'));
r=V.periksa(mk({action_type:'TRANSFER',effective_month:5,employee_id:'E1',target_department_id:'D-MKT',
  justification:'alasan yang cukup panjang'}),ctx);
cek('C6 mutasi ke departemen sendiri ditolak', r.errors.some(e=>e.kode==='V05b'));
r=V.periksa(mk({action_type:'PLANNED_REDUCTION',effective_month:5,employee_id:'E1',
  justification:'alasan yang cukup panjang'}),Object.assign({},ctx,{currentHc:0,semuaBaris:[
    mk({line_item_id:'Y1',action_type:'PLANNED_REDUCTION'})]}));
cek('C7 headcount negatif ditolak', r.errors.some(e=>e.kode==='V08'));

// D. Penjaga siklus dan peran
// Siklus 2027 sudah dibuka oleh fixture, jadi aturan DRAFT diuji pada siklus baru.
S.masuk('U-OD-01');
S.buatSiklus({year:2028,start_date:'2027-09-01',end_date:'2028-12-31',submission_deadline:'2027-10-15'});
S.keluar(); S.masuk('U-HOD-MKT');
let g=S.bolehRencana('MPP-2028','D-MKT');
cek('D1 siklus DRAFT menolak penyusunan', !g.ok && g.kunci==='plan.errBelumBuka', JSON.stringify(g));
S.keluar(); S.masuk('U-OD-01'); S.ubahStatusSiklus('MPP-2027','OPEN');
S.keluar(); S.masuk('U-HOD-MKT');
cek('D2 setelah dibuka diizinkan', S.bolehRencana('MPP-2027','D-MKT').ok);
cek('D3 departemen lain ditolak', S.bolehRencana('MPP-2027','D-PRD').kunci==='plan.errLingkup');
S.keluar(); S.masuk('U-MON-01');
cek('D4 monitor tidak boleh menyusun', S.bolehRencana('MPP-2027','D-MKT').kunci==='plan.errPeran');

// E. CRUD baris lewat store
S.keluar(); S.masuk('U-HOD-MKT');
const sub=S.submissionDepartemen('MPP-2027','D-MKT');
cek('E1 seed usulan Marketing ada', !!sub && S.barisSubmission(sub.submission_id).length===3);
let add=S.tambahBaris('MPP-2027','D-MKT',{action_type:'PLANNED_REDUCTION',employee_id:'NBT2008',
  effective_month:10,reduction_reason:'Resign',justification:'Tidak diganti karena beban kerja turun'});
cek('E2 tambah baris berhasil', add.ok, JSON.stringify(add).slice(0,80));
cek('E3 jumlah baris bertambah', S.barisSubmission(sub.submission_id).length===4);
cek('E4 validasi baris seed lolos',
    S.barisSubmission(sub.submission_id).every(b=>S.periksaBaris(b).errors.length===0),
    JSON.stringify(S.barisSubmission(sub.submission_id).map(b=>[b.line_item_id,S.periksaBaris(b).errors])));
let del=S.hapusBaris(add.baris.line_item_id);
cek('E5 hapus baris berhasil', del.ok && S.barisSubmission(sub.submission_id).length===3);
// Lima baris fixture juga masuk lewat tambahBaris, jadi yang dihitung entri setelahnya.
cek('E6 audit mencatat tambah dan hapus',
    w.NBAudit.semua().filter(e=>e.event_type==='PLAN_LINE_ADD').length>=6 &&
    w.NBAudit.semua().filter(e=>e.event_type==='PLAN_LINE_DELETE').length===1);

// F. Layar
w.location.hash='#planning'; w.NBApp.ulang();
let html=d.getElementById('nbPage').innerHTML;
cek('F1 layar planning tampil', html.includes('MPP Planning'));
cek('F2 tiga baris usulan tampil', d.querySelectorAll('#nbPage tbody tr').length===3,
    d.querySelectorAll('#nbPage tbody tr').length+'');
cek('F3 Proposed HC dihitung benar', html.includes('>10<'), 'current 8 tambah 2');
d.getElementById('pTambah').click();
cek('F4 modal tambah terbuka', !!d.getElementById('mPlan'));
d.getElementById('fSimpan').click();
cek('F5 simpan tanpa isi menampilkan galat', d.getElementById('fPesan').innerHTML.length>0);
d.querySelector('[data-tutup]').click();
cek('F6 modal tertutup', !d.getElementById('mPlan'));

// G. Lingkup pada layar
S.keluar(); S.masuk('U-HOD-PRD'); w.NBApp.ulang();
html=d.getElementById('nbPage').innerHTML;
cek('G1 HOD Produksi melihat usulannya sendiri', d.querySelectorAll('#nbPage tbody tr').length===2);
cek('G2 tidak ada baris Marketing', !html.includes('LI-0001'));
S.keluar(); S.masuk('U-MON-01'); w.NBApp.ulang();
cek('G3 monitor tidak melihat tombol tambah', !d.getElementById('pTambah'));

console.log('\nTOTAL GAGAL: '+gagal.length); gagal.forEach(x=>console.log(' - '+x));
},400);
