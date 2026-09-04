// QA fase 7: posisi baru terealisasi, vacancy dari kepergian, reorganisasi terkendali.
const {JSDOM}=require('jsdom'), fs=require('fs');
const FX=require(__dirname + '/fixture.js');
const w=new JSDOM(fs.readFileSync('/home/claude/mpp/dist/index.html','utf8'),
  {runScripts:'dangerously',url:'https://local.test/',pretendToBeVisual:true}).window;
w.scrollTo=()=>{};
const gagal=[]; const cek=(n,ok,i)=>{ if(!ok) gagal.push(n); console.log((ok?'PASS ':'GAGAL')+'  '+n+(!ok&&i?'  ['+i+']':'')); };
setTimeout(()=>{
FX.lengkap(w);
const d=w.document, S=w.NBStore;

// Siklus sampai alokasi, dengan satu pengurangan karena restrukturisasi di Marketing
S.masuk('U-OD-01'); S.rilisSnapshot('MPP-2027','2026-09-01');
S.keluar(); S.masuk('U-HOD-MKT');
const restruk=S.tambahBaris('MPP-2027','D-MKT',{action_type:'PLANNED_REDUCTION',employee_id:'NBT2008',reduction_reason:'Restrukturisasi',
  effective_month:11,justification:'Posisi dihapus karena fungsinya digabung ke tim digital'});
S.kirimSubmission('MPP-2027','D-MKT');
S.keluar(); S.masuk('U-HOD-PRD'); S.kirimSubmission('MPP-2027','D-PRD');
S.keluar(); S.masuk('U-OD-01');
S.reviewSubmission('SUB-2027-MKT','ACCEPT',null); S.reviewSubmission('SUB-2027-PRD','ACCEPT',null);
S.kunciKonsolidasi('MPP-2027');
S.keluar(); S.masuk('U-MGT-01');
S.barisReview('MPP-2027').forEach(l=>S.putuskanBaris(l.line_item_id,'APPROVE',null,null));
S.setujuiMpp('MPP-2027','Uji fase 7');
S.keluar(); S.masuk('U-OD-01'); S.distribusikanAlokasi('MPP-2027');
const alok=S.alokasiTerlihat('MPP-2027');
const aPos=alok.find(a=>a.action_type==='POSITION_CREATION');
const aRedPensiun=alok.find(a=>a.action_type==='PLANNED_REDUCTION'&&a.department_id==='D-PRD');
const aRedRestruk=alok.find(a=>a.action_type==='PLANNED_REDUCTION'&&a.department_id==='D-MKT');
function catatSetuju(id,data){ S.keluar(); S.masuk('U-MON-01'); const r=S.catatActual(id,data);
  S.keluar(); S.masuk('U-OD-01'); S.setujuiRealisasi(r.actual.actual_id,'SETUJU',null);
  return S.actualTerlihat('MPP-2027').find(a=>a.actual_id===r.actual.actual_id); }

// ---------- A. Posisi baru terealisasi ----------
const posSebelum=S.jumlahData().posisi;
const r1=catatSetuju(aPos.allocation_id,{quantity:1,actual_date:'2027-07-05',employee_name:'Analis Baru'});
cek('A1 posisi baru dibuat di master', S.jumlahData().posisi===posSebelum+1 && !!r1.posisi_baru, r1.posisi_baru);
const pBaru=S.posisi(r1.posisi_baru);
cek('A2 posisi memakai judul dan grade usulan', pBaru.title==='Marketing Data Analyst' && pBaru.grade_id==='4C' && pBaru.department_id==='D-MKT');
const kBaru=S.karyawan(r1.karyawan_baru[0]);
cek('A3 karyawan baru menunjuk posisi itu, bukan kosong', kBaru.position_id===r1.posisi_baru);
cek('A4 baris usulan ikut menunjuk posisi baru', S.barisSubmission('SUB-2027-MKT').find(b=>b.line_item_id===aPos.line_item_id).position_id===r1.posisi_baru);
S.keluar(); S.masuk('U-MON-01'); S.batalkanActual(r1.actual_id,'Kandidat mundur sebelum masuk');
cek('A5 pembatalan menghapus posisi dan karyawan barunya', !S.posisi(r1.posisi_baru) && !S.karyawan(r1.karyawan_baru[0]));

// ---------- B. Vacancy dari kepergian ----------
const vacSebelum=S.vacancyTerlihat().length;
const r2=catatSetuju(aRedPensiun.allocation_id,{quantity:1,actual_date:'2027-09-30',employee_name:'Pensiun'});
const vacBaru=S.vacancyTerlihat().filter(v=>v.dari_realisasi===r2.actual_id);
cek('B1 pensiun membuka vacancy di posisi yang ditinggalkan', vacBaru.length===1 && vacBaru[0].status==='Open' && vacBaru[0].source==='Pensiun');
cek('B2 vacancy memakai grade dan departemen orang yang pergi', vacBaru[0].department_id==='D-PRD');
const r3=catatSetuju(aRedRestruk.allocation_id,{quantity:1,actual_date:'2027-11-30',employee_name:'Restrukturisasi'});
cek('B3 restrukturisasi tidak membuka vacancy', S.vacancyTerlihat().filter(v=>v.dari_realisasi===r3.actual_id).length===0);
cek('B4 orangnya tetap ditandai keluar', S.karyawan('NBT2008').employment_status==='Keluar');
S.keluar(); S.masuk('U-MON-01'); S.batalkanActual(r2.actual_id,'Pensiun ditunda setahun');
cek('B5 pembatalan menutup kembali vacancy yang dibuka', S.vacancyTerlihat().filter(v=>v.dari_realisasi===r2.actual_id).length===0);

// ---------- C. Reorganisasi terkendali ----------
S.keluar(); S.masuk('U-HOD-MKT');
cek('C1 HOD tidak boleh mereorganisasi', !S.pindahkanDepartemen('D-QAS','DIV-CRP','Percobaan pemindahan tanpa hak').ok);
S.keluar(); S.masuk('U-OD-01');
cek('C2 alasan wajib', !S.pindahkanDepartemen('D-QAS','DIV-CRP','pendek').ok);
cek('C3 divisi yang sama ditolak', S.pindahkanDepartemen('D-QAS','DIV-OPS','Divisi tujuan sama dengan sekarang').kunci==='reorg.errSama');
const snapId=S.snapshotAktif('MPP-2027').snapshot_id;
const divLamaSnap=S.snapshot(snapId).lines.find(l=>l.department_id==='D-QAS').division_id;
cek('C4 pemindahan berhasil', S.pindahkanDepartemen('D-QAS','DIV-CRP','Quality Assurance dipindahkan ke bawah Corporate untuk independensi audit').ok);
cek('C5 departemen dan karyawannya berpindah divisi dan direktorat',
    S.departemen('D-QAS').division_id==='DIV-CRP' && S.karyawan('NBT2035').division_id==='DIV-CRP' && S.departemen('D-QAS').directorate_id==='DIR-CRP');
cek('C6 snapshot lama tidak berubah', S.snapshot(snapId).lines.find(l=>l.department_id==='D-QAS').division_id===divLamaSnap);
cek('C7 tercatat di riwayat reorganisasi dan audit',
    S.riwayatReorganisasi().some(r=>r.object_id==='D-QAS') && w.NBAudit.semua().some(e=>e.event_type==='REORG'));
cek('C8 matriks membaca divisi baru', S.matriksBulanan('MPP-2027',{mode:'HC',level:'DEPT'}).baris.find(b=>b.department_id==='D-QAS').divisi==='Corporate Services');
// Lintas entitas ditolak
FX.unggah(w,'U-ADMIN','ORGANISASI','10-entitas-malaysia.csv');
S.keluar(); S.masuk('U-OD-01');
cek('C9 pemindahan lintas entitas ditolak', S.pindahkanDepartemen('D-QAS','MY-OPS','Percobaan memindahkan ke entitas Malaysia').kunci==='reorg.errLintasEntitas');
w.location.hash='#admin'; w.NBApp.ulang();
d.querySelector("button[data-tab='reorg']").click();
cek('C10 tab reorganisasi tampil dengan riwayat', d.getElementById('nbPage').innerHTML.indexOf('independensi audit')>-1);

console.log('\nTOTAL GAGAL: '+gagal.length); gagal.forEach(x=>console.log(' - '+x));
},500);
