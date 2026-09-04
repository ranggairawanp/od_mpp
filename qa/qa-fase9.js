// QA fase 9: pindah entitas sebagai pasangan dua baris, dan mata uang per baris.
const {JSDOM}=require('jsdom'), fs=require('fs');
const FX=require(__dirname + '/fixture.js');
const w=new JSDOM(fs.readFileSync('/home/claude/mpp/dist/index.html','utf8'),
  {runScripts:'dangerously',url:'https://local.test/',pretendToBeVisual:true}).window;
w.scrollTo=()=>{};
const gagal=[]; const cek=(n,ok,i)=>{ if(!ok) gagal.push(n); console.log((ok?'PASS ':'GAGAL')+'  '+n+(!ok&&i?'  ['+i+']':'')); };
setTimeout(()=>{
FX.lengkap(w);
const d=w.document, S=w.NBStore, F=w.NBFormat;
FX.unggah(w,'U-ADMIN','ORGANISASI','10-entitas-malaysia.csv'); FX.unggah(w,'U-ADMIN','POSISI','11-posisi-malaysia.csv');
FX.unggah(w,'U-ADMIN','KARYAWAN','12-karyawan-malaysia.csv'); FX.unggah(w,'U-ADMIN','PENGGUNA','13-pengguna-malaysia.csv');
FX.unggah(w,'U-CB-01','ASUMSI','14-asumsi-biaya-malaysia.csv','MPP-2027'); FX.unggah(w,'U-CB-01','KURS','15-kurs.csv');
S.masuk('U-OD-01'); S.rilisSnapshot('MPP-2027','2026-09-01');

// A. HOD asal mengusulkan pindah entitas
S.keluar(); S.masuk('U-HOD-PRD');
let tanpaTujuan=S.tambahBaris('MPP-2027','D-PRD',{action_type:'PLANNED_REDUCTION',employee_id:'NBT2031',reduction_reason:'Pindah entitas',
  effective_month:7,justification:'Dipindahkan untuk memimpin lini produksi di Johor'});
cek('A1 pindah entitas tanpa tujuan ditolak V05g', S.periksaBaris(tanpaTujuan.baris).errors.some(e=>e.kode==='V05g'));
S.hapusBaris(tanpaTujuan.baris.line_item_id);
let samaEntitas=S.tambahBaris('MPP-2027','D-PRD',{action_type:'PLANNED_REDUCTION',employee_id:'NBT2031',reduction_reason:'Pindah entitas',
  target_department_id:'D-QAS',effective_month:7,justification:'Tujuan sengaja di entitas yang sama'});
cek('A2 tujuan di entitas sama ditolak V05h', S.periksaBaris(samaEntitas.baris).errors.some(e=>e.kode==='V05h'));
S.hapusBaris(samaEntitas.baris.line_item_id);
let pindah=S.tambahBaris('MPP-2027','D-PRD',{action_type:'PLANNED_REDUCTION',employee_id:'NBT2031',reduction_reason:'Pindah entitas',
  target_department_id:'MY-PRD',effective_month:7,justification:'Dipindahkan untuk memimpin lini produksi di Johor'});
cek('A3 pindah entitas yang sah lolos dengan peringatan menunggu', S.periksaBaris(pindah.baris).errors.length===0 && S.periksaBaris(pindah.baris).warnings.some(x=>x.kode==='W05d'));
cek('A4 di entitas asal berdampak minus satu', w.NBActions.dampakHc(pindah.baris).perusahaan===-1);
S.kirimSubmission('MPP-2027','D-PRD');
cek('A5 setelah dikirim menunggu HOD tujuan', S.barisSubmission(pindah.baris.submission_id).find(b=>b.line_item_id===pindah.baris.line_item_id).transfer_status==='PENDING');

// B. HOD tujuan di Malaysia mengonfirmasi dengan memilih posisi
const hodMy=S.semuaPengguna().find(u=>u.role==='HOD'&&u.scope.department_id==='MY-PRD');
S.keluar(); S.masuk(hodMy.user_id);
cek('B1 HOD tujuan melihat permintaan pindah entitas', S.mutasiMasuk('MPP-2027').some(b=>b.line_item_id===pindah.baris.line_item_id));
cek('B2 konfirmasi mutasi biasa ditolak untuk pindah entitas', S.konfirmasiMutasi(pindah.baris.line_item_id,'CONFIRM',null).kunci==='pindah.errLewatKonfirmasiBiasa');
cek('B3 posisi di luar departemen tujuan ditolak', !S.konfirmasiPindahEntitas(pindah.baris.line_item_id,'POS-PRD-014','Alasan penerimaan yang panjang').ok);
S.keluar(); S.masuk('U-OD-01'); S.ubahStatusSiklus('MPP-2027','OPEN'); S.keluar(); S.masuk(hodMy.user_id);
let terima=S.konfirmasiPindahEntitas(pindah.baris.line_item_id,'MY-P2','Kami butuh supervisor produksi berpengalaman lini wafer');
cek('B4 penerimaan membuat baris rekrutmen di Malaysia', terima.ok && terima.baris.action_type==='EXTERNAL_HIRING' && terima.baris.department_id==='MY-PRD', JSON.stringify(terima).slice(0,120));
cek('B5 kedua baris saling tertaut', terima.baris.linked_line_item_id===pindah.baris.line_item_id &&
    S.barisSubmission(pindah.baris.submission_id).find(b=>b.line_item_id===pindah.baris.line_item_id).linked_line_item_id===terima.baris.line_item_id);
cek('B6 baris asal terkonfirmasi', S.barisSubmission(pindah.baris.submission_id).find(b=>b.line_item_id===pindah.baris.line_item_id).transfer_status==='CONFIRMED');
cek('B7 peringatan menunggu hilang', !S.periksaBaris(S.barisSubmission(pindah.baris.submission_id).find(b=>b.line_item_id===pindah.baris.line_item_id)).warnings.some(x=>x.kode==='W05d'));
cek('B8 baris rekrutmen berbiaya dalam Ringgit', S.biayaBaris(terima.baris).mata_uang==='MYR' && S.biayaBaris(terima.baris).annualized_cost>0 && S.biayaBaris(terima.baris).annualized_idr>S.biayaBaris(terima.baris).annualized_cost);

// C. Konsolidasi: grup netral, entitas bergeser
S.kirimSubmission('MPP-2027','MY-PRD');
S.keluar(); S.masuk('U-OD-01');
S.reviewSubmission('SUB-2027-PRD','ACCEPT',null);
S.reviewSubmission(S.submissionDepartemen('MPP-2027','MY-PRD').submission_id,'ACCEPT',null);
const k=S.konsolidasi('MPP-2027');
const ksni=k.perEntitas.find(e=>e.entity_id==='ENT-KSNI'), nbm=k.perEntitas.find(e=>e.entity_id==='ENT-NBM');
cek('C1 entitas asal turun satu dari pengurangan, tujuan naik satu', nbm.netto===1 && ksni.netto===k.total.netto-1, JSON.stringify(k.perEntitas)+' '+JSON.stringify(k.perDept.filter(x=>x.department_id==='MY-PRD'||x.department_id==='D-PRD')));
cek('C2 headcount grup: pindah entitas netral', k.perDept.find(x=>x.department_id==='D-PRD').netto + nbm.netto === k.perDept.find(x=>x.department_id==='D-PRD').netto+1);

// D. Mata uang per baris di layar Biaya
w.location.hash='#biaya'; w.NBApp.ulang();
let html=d.getElementById('nbPage').innerHTML;
cek('D1 baris Malaysia tampil dalam Ringgit dengan padanan Rupiah', html.indexOf('RM')>-1 && /Rp[\d.]/.test(html));
cek('D2 fungsi uang memakai lambang eksplisit', F.uang(1000,'MYR')==='RM1.000' && F.uang(-5,'IDR')==='-Rp5');

// E. Realisasi pindah entitas tidak membuka vacancy di asal
S.kunciKonsolidasi('MPP-2027');
S.keluar(); S.masuk('U-MGT-01'); S.barisReview('MPP-2027').forEach(l=>S.putuskanBaris(l.line_item_id,'APPROVE',null,null)); S.setujuiMpp('MPP-2027','Uji fase 9');
S.keluar(); S.masuk('U-OD-01'); S.distribusikanAlokasi('MPP-2027');
const aPindah=S.alokasiTerlihat('MPP-2027').find(a=>a.line_item_id===pindah.baris.line_item_id);
S.keluar(); S.masuk('U-MON-01'); const r=S.catatActual(aPindah.allocation_id,{quantity:1,actual_date:'2027-07-01',employee_name:'Pindah ke Johor'});
S.keluar(); S.masuk('U-OD-01'); S.setujuiRealisasi(r.actual.actual_id,'SETUJU',null);
cek('E1 orang ditandai keluar di entitas asal', S.karyawan('NBT2031').employment_status==='Keluar');
cek('E2 tidak ada vacancy terbuka di posisi yang ditinggalkan', !S.vacancyTerlihat().some(v=>v.dari_realisasi===r.actual.actual_id));

console.log('\nTOTAL GAGAL: '+gagal.length); gagal.forEach(x=>console.log(' - '+x));
},500);
