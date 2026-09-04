// QA Modul 4: konsolidasi perusahaan, anti double counting, mutasi, penguncian.
const {JSDOM}=require('jsdom'), fs=require('fs');
const F = require(__dirname + '/fixture.js');
const w=new JSDOM(fs.readFileSync('/home/claude/mpp/dist/index.html','utf8'),
  {runScripts:'dangerously',url:'https://local.test/',pretendToBeVisual:true}).window;
w.scrollTo=()=>{};
const gagal=[]; const cek=(n,ok,i)=>{ if(!ok) gagal.push(n); console.log((ok?'PASS ':'GAGAL')+'  '+n+(!ok&&i?'  ['+i+']':'')); };
setTimeout(()=>{
// Aplikasi kosong: data dimuat lewat jalur impor sungguhan.
F.lengkap(w);
const d=w.document, S=w.NBStore;
S.masuk('U-OD-01'); S.ubahStatusSiklus('MPP-2027','OPEN'); S.keluar();

// A. Sebelum ada yang diterima
S.masuk('U-OD-01');
let k=S.konsolidasi('MPP-2027');
cek('A1 belum ada baris yang ikut', k.total.baris===0);
cek('A2 Proposed sama dengan Current saat kosong', k.total.proposed===k.total.current, k.total.proposed+' vs '+k.total.current);
cek('A3 pengecualian menyebut usulan draft dan departemen kosong',
    k.exceptions.filter(e=>e.jenis==='SUBMISSION').length===2 &&
    k.exceptions.filter(e=>e.jenis==='KOSONG').length===5,
    JSON.stringify(k.exceptions.map(e=>e.jenis)));
cek('A4 kunci ditolak saat belum ada yang diterima', !S.kunciKonsolidasi('MPP-2027').ok);

// B. Alur sampai diterima OD
S.keluar(); S.masuk('U-HOD-MKT'); S.kirimSubmission('MPP-2027','D-MKT');
S.keluar(); S.masuk('U-HOD-PRD');
const mut=S.tambahBaris('MPP-2027','D-PRD',{action_type:'TRANSFER',employee_id:'NBT2030',
  target_department_id:'D-QAS',effective_month:6,justification:'Kompetensinya lebih terpakai di QA'});
S.kirimSubmission('MPP-2027','D-PRD');
S.keluar(); S.masuk('U-OD-01');
S.reviewSubmission('SUB-2027-MKT','ACCEPT',null);
S.reviewSubmission('SUB-2027-PRD','ACCEPT',null);
k=S.konsolidasi('MPP-2027');
cek('B1 baris ikut setelah diterima', k.total.baris===6, k.total.baris+'');
const mkt=k.perDept.find(x=>x.department_id==='D-MKT');
const prd=k.perDept.find(x=>x.department_id==='D-PRD');
const qas=k.perDept.find(x=>x.department_id==='D-QAS');
cek('B2 Marketing netto +2', mkt.netto===2, String(mkt.netto));
cek('B3 mutasi belum dikonfirmasi tidak mengurangi Produksi', prd.netto===2, String(prd.netto));
cek('B4 QA tidak bertambah selama mutasi menunggu', qas.netto===0, String(qas.netto));
cek('B5 mutasi menunggu muncul sebagai pengecualian',
    k.exceptions.some(e=>e.jenis==='MUTASI'));
const nettoSebelumMutasi=k.total.netto;

// C. Setelah mutasi dikonfirmasi
S.konfirmasiMutasi(mut.baris.line_item_id,'CONFIRM',null);
// Keputusan 4c dan 5c: penguncian ditolak sampai OD menetapkan atasan baru di departemen tujuan.
cek('C0 kunci ditolak selama mutasi tanpa atasan tujuan', S.kunciKonsolidasi('MPP-2027').kunci==='kons.errMutasiTanpaAtasan');
cek('C0b atasan dari departemen lain ditolak', !S.tetapkanAtasanMutasi(mut.baris.line_item_id,'NBT2001').ok);
cek('C0c atasan di bawah 5A ditolak', !S.tetapkanAtasanMutasi(mut.baris.line_item_id,'NBT2037').ok);
cek('C0d OD menetapkan atasan yang sah', S.tetapkanAtasanMutasi(mut.baris.line_item_id, S.hodDari('D-QAS').employee_id).ok);
k=S.konsolidasi('MPP-2027');
const prd2=k.perDept.find(x=>x.department_id==='D-PRD');
const qas2=k.perDept.find(x=>x.department_id==='D-QAS');
cek('C1 Produksi berkurang satu', prd2.netto===1, String(prd2.netto));
cek('C2 QA bertambah satu', qas2.netto===1, String(qas2.netto));
// Netto perusahaan sebelum konfirmasi sudah dicatat di B, harus sama setelah konfirmasi.
cek('C3 total perusahaan tidak berubah oleh mutasi', k.total.netto===nettoSebelumMutasi,
    k.total.netto+' vs '+nettoSebelumMutasi);
cek('C4 mutasi tidak dihitung sebagai tambahan perusahaan',
    k.total.mutasi===1 && k.total.tambah===5, 'tambah '+k.total.tambah);
cek('C5 pengecualian mutasi hilang', !k.exceptions.some(e=>e.jenis==='MUTASI'));

// D. Anti double counting di tingkat perusahaan, memakai departemen Sales
S.keluar(); S.masuk('U-HOD-SLS');
const induk=S.tambahBaris('MPP-2027','D-SLS',{action_type:'POSITION_CREATION',
  new_position_title:'Trade Marketing Analyst',target_grade_id:'G9',quantity:1,effective_month:8,
  justification:'Kanal modern trade butuh analisis harga mingguan'});
const anak=S.tambahBaris('MPP-2027','D-SLS',{action_type:'EXTERNAL_HIRING',position_id:'POS-SLS-009',
  quantity:1,effective_month:9,replacement_flag:'Additional',parent_line_item_id:induk.baris.line_item_id,
  justification:'Mengisi posisi Trade Marketing Analyst yang baru dibuat'});
cek('D1 induk dan anak tersimpan', induk.ok && anak.ok, JSON.stringify(induk).slice(0,90));
S.kirimSubmission('MPP-2027','D-SLS');
S.keluar(); S.masuk('U-OD-01'); S.reviewSubmission('SUB-2027-SLS','ACCEPT',null);
k=S.konsolidasi('MPP-2027');
const sls=k.perDept.find(x=>x.department_id==='D-SLS');
cek('D2 posisi baru plus rekrutmen turunan tetap satu tambahan', sls.netto===1, String(sls.netto));
cek('D3 dua baris masuk hitungan tapi hanya satu berdampak', sls.baris===2, String(sls.baris));
// Jalur double counting yang sesungguhnya dicegah validasi, bukan oleh perhitungan.
S.keluar(); S.masuk('U-HOD-QAS_TIDAK_ADA');
S.keluar(); S.masuk('U-OD-01');
const uji=w.NBValidate.periksa(
  {action_type:'EXTERNAL_HIRING',department_id:'D-SLS',quantity:1,effective_month:9,
   replacement_flag:'Additional',position_id:'P1',justification:'alasan yang cukup panjang',
   parent_line_item_id:'IND-1'},
  {semuaBaris:[{line_item_id:'IND-1',action_type:'POSITION_CREATION',fill_immediately:true}],
   levelGrade:function(){return 0;}});
cek('D4 induk yang sudah diisi langsung menolak baris turunan',
    uji.errors.some(e=>e.kode==='V09c'), JSON.stringify(uji.errors));

// E. Sebaran bulan
const bulan=k.perBulan;
cek('E1 dua belas bulan tersedia', bulan.length===12);
cek('E2 Februari berisi satu penambahan dari vacancy fill', bulan[1].tambah===1, JSON.stringify(bulan[1]));
cek('E3 September berisi satu pengurangan terencana', bulan[8].kurang===1, JSON.stringify(bulan[8]));
cek('E4 mutasi tidak masuk sebaran bulan',
    bulan.reduce((a,b)=>a+b.tambah,0)===k.total.tambah, 'jumlah bulan '+bulan.reduce((a,b)=>a+b.tambah,0));

// F. Penguncian
S.keluar(); S.masuk('U-HOD-MKT');
cek('F1 HOD tidak boleh mengunci', !S.kunciKonsolidasi('MPP-2027').ok);
S.keluar(); S.masuk('U-OD-01');
const lock=S.kunciKonsolidasi('MPP-2027');
cek('F2 penguncian berhasil', lock.ok && lock.konsolidasi.consolidation_id==='KONS-2027-V1',
    JSON.stringify(lock).slice(0,80));
cek('F3 usulan berubah jadi CONSOLIDATED',
    S.submissionDepartemen('MPP-2027','D-MKT').status==='CONSOLIDATED');
cek('F4 angka beku tersimpan di catatan', lock.konsolidasi.proposed===k.total.proposed,
    lock.konsolidasi.proposed+' vs '+k.total.proposed);
cek('F5 HOD tidak bisa menyunting lagi setelah dikonsolidasikan',
    !S.bolehRencana('MPP-2027','D-MKT').ok);
cek('F6 audit mencatat konsolidasi',
    w.NBAudit.semua().some(e=>e.event_type==='CONSOLIDATE'));

// G. Layar
w.location.hash='#konsolidasi'; w.NBApp.ulang();
let html=d.getElementById('nbPage').innerHTML;
cek('G1 layar konsolidasi tampil', html.includes('Konsolidasi MPP'));
cek('G2 tujuh departemen plus baris total',
    d.querySelector('#nbPage tbody').querySelectorAll('tr').length===8,
    String(d.querySelector('#nbPage tbody').querySelectorAll('tr').length));
d.querySelector("button[data-tab='action']").click();
cek('G3 tab per action bekerja', d.getElementById('nbPage').innerHTML.includes('Dampak HC'));
d.querySelector("button[data-tab='bulan']").click();
cek('G4 tab sebaran bulan bekerja', d.getElementById('nbPage').innerHTML.includes('Des'));
cek('G5 riwayat konsolidasi muncul', d.getElementById('nbPage').innerHTML.includes('KONS-2027-V1'));
S.keluar(); S.masuk('U-HOD-MKT'); w.location.hash='#konsolidasi'; w.NBApp.ulang();
cek('G6 HOD dilempar dari layar konsolidasi', w.location.hash==='#dashboard');

console.log('\nTOTAL GAGAL: '+gagal.length); gagal.forEach(x=>console.log(' - '+x));
},400);
