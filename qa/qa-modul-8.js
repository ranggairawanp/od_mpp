// QA Modul 8: pencatatan realisasi, blokir kelebihan, exception, utilisasi.
const {JSDOM}=require('jsdom'), fs=require('fs');
const FX = require(__dirname + '/fixture.js');
const w=new JSDOM(fs.readFileSync('/home/claude/mpp/dist/index.html','utf8'),
  {runScripts:'dangerously',url:'https://local.test/',pretendToBeVisual:true}).window;
w.scrollTo=()=>{};
const gagal=[]; const cek=(n,ok,i)=>{ if(!ok) gagal.push(n); console.log((ok?'PASS ':'GAGAL')+'  '+n+(!ok&&i?'  ['+i+']':'')); };
setTimeout(()=>{
// Aplikasi kosong: data dimuat lewat jalur impor sungguhan.
FX.lengkap(w);
const d=w.document, S=w.NBStore, F=w.NBFormat;

// Persiapan sampai alokasi dibagikan
S.masuk('U-OD-01'); S.ubahStatusSiklus('MPP-2027','OPEN'); S.keluar();
S.masuk('U-HOD-MKT'); S.kirimSubmission('MPP-2027','D-MKT'); S.keluar();
S.masuk('U-HOD-PRD'); S.kirimSubmission('MPP-2027','D-PRD'); S.keluar();
S.masuk('U-OD-01');
S.reviewSubmission('SUB-2027-MKT','ACCEPT',null); S.reviewSubmission('SUB-2027-PRD','ACCEPT',null);
S.kunciKonsolidasi('MPP-2027'); S.keluar();
S.masuk('U-MGT-01');
S.barisReview('MPP-2027').forEach(l=>S.putuskanBaris(l.line_item_id,'APPROVE',null,null));
S.setujuiMpp('MPP-2027','Disetujui penuh untuk pengujian modul monitoring'); S.keluar();
S.masuk('U-OD-01'); S.distribusikanAlokasi('MPP-2027');
const alok=S.alokasiTerlihat('MPP-2027');
const hire=alok.find(a=>a.action_type==='EXTERNAL_HIRING');   // kuota 3
cek('A1 alokasi rekrutmen berkuota tiga', hire.approved_qty===3, String(hire.approved_qty));

// A. Hak dan validasi dasar
S.keluar(); S.masuk('U-HOD-MKT');
cek('A2 HOD tidak mencatat realisasi',
    S.catatActual(hire.allocation_id,{quantity:1,actual_date:'2027-03-01'}).kunci==='mon.errPeran');
S.keluar(); S.masuk('U-MON-01');
cek('A3 tanggal wajib diisi', !S.catatActual(hire.allocation_id,{quantity:1}).ok);
cek('A4 tanggal di luar tahun siklus ditolak',
    S.catatActual(hire.allocation_id,{quantity:1,actual_date:'2026-03-01'}).kunci==='mon.errTahun');
cek('A5 jumlah nol ditolak',
    !S.catatActual(hire.allocation_id,{quantity:0,actual_date:'2027-03-01'}).ok);

// B. Pencatatan normal
let r1=S.catatActual(hire.allocation_id,{quantity:2,actual_date:'2027-04-05',employee_name:'Rizal Saputra'});
cek('B1 realisasi dua orang tercatat', r1.ok && !r1.exception);
let a2=S.alokasiTerlihat('MPP-2027').find(a=>a.allocation_id===hire.allocation_id);
cek('B2 kuota terpakai bertambah', a2.consumed_qty===2 && a2.remaining_qty===1,
    a2.consumed_qty+' / '+a2.remaining_qty);
cek('B3 status alokasi jadi terpakai sebagian', a2.status==='PARTIAL');
cek('B4 bulan realisasi diambil dari tanggal masuk kerja',
    S.actualTerlihat('MPP-2027')[0].effective_month===4);

// C. Blokir kelebihan pada penambahan headcount
let blok=S.catatActual(hire.allocation_id,{quantity:3,actual_date:'2027-05-01',employee_name:'Uji Blokir'});
cek('C1 realisasi melebihi sisa diblokir', !blok.ok && blok.kunci==='mon.errMelebihi', JSON.stringify(blok));
cek('C2 kuota tidak berubah setelah blokir',
    S.alokasiTerlihat('MPP-2027').find(a=>a.allocation_id===hire.allocation_id).consumed_qty===2);
cek('C3 penolakan tercatat di audit',
    w.NBAudit.semua().some(e=>e.event_type==='ACTUAL_BLOCKED'));

// D. Exception pada jenis bukan penambahan
const promo=alok.find(a=>a.action_type==='PROMOTION');   // kuota 1
S.catatActual(promo.allocation_id,{quantity:1,actual_date:'2027-04-01',employee_name:'Dimas Handayani'});
let exc=S.catatActual(promo.allocation_id,{quantity:1,actual_date:'2027-06-01',employee_name:'Kelebihan promosi'});
cek('D1 kelebihan pada promosi tetap dicatat', exc.ok && exc.exception===true, JSON.stringify(exc).slice(0,80));
let ex=S.exceptionTerlihat('MPP-2027');
cek('D2 exception terbentuk menunggu OD', ex.length===1 && ex[0].status==='PENDING' && ex[0].kelebihan===1,
    JSON.stringify(ex[0]||{}).slice(0,90));
let ap=S.alokasiTerlihat('MPP-2027').find(a=>a.allocation_id===promo.allocation_id);
cek('D3 alokasi ditandai melebihi', ap.status==='OVER' && ap.over_qty===1);

// E. Keputusan exception
cek('E1 MPP Monitor tidak memutuskan exception',
    S.putuskanException(ex[0].exception_id,'ACCEPT','Alasan yang cukup panjang').kunci==='mon.errPeranException');
S.keluar(); S.masuk('U-OD-01');
cek('E2 keputusan tanpa alasan ditolak', !S.putuskanException(ex[0].exception_id,'REJECT','pendek').ok);
let tolak=S.putuskanException(ex[0].exception_id,'REJECT','Promosi kedua tidak pernah diusulkan pada siklus ini');
cek('E3 penolakan exception berhasil', tolak.ok);
let ap2=S.alokasiTerlihat('MPP-2027').find(a=>a.allocation_id===promo.allocation_id);
cek('E4 realisasi pemicu ikut dibatalkan dan kuota kembali cocok',
    ap2.consumed_qty===1 && ap2.over_qty===0 && ap2.status==='FULFILLED',
    ap2.consumed_qty+' '+ap2.over_qty+' '+ap2.status);
cek('E5 keputusan ulang ditolak', !S.putuskanException(ex[0].exception_id,'ACCEPT','Alasan lain yang panjang').ok);

// F. Pembatalan realisasi
S.keluar(); S.masuk('U-MON-01');
const act=S.actualTerlihat('MPP-2027').find(a=>a.allocation_id===hire.allocation_id&&a.status==='RECORDED');
cek('F1 pembatalan tanpa alasan ditolak', !S.batalkanActual(act.actual_id,'pendek').ok);
let btl=S.batalkanActual(act.actual_id,'Kandidat mengundurkan diri sebelum tanggal masuk');
cek('F2 pembatalan berhasil', btl.ok);
let a3=S.alokasiTerlihat('MPP-2027').find(a=>a.allocation_id===hire.allocation_id);
cek('F3 kuota kembali setelah pembatalan', a3.consumed_qty===0 && a3.remaining_qty===3,
    a3.consumed_qty+' / '+a3.remaining_qty);
cek('F4 catatan tidak dihapus, hanya ditandai batal',
    S.actualTerlihat('MPP-2027').some(a=>a.actual_id===act.actual_id&&a.status==='CANCELLED'));
cek('F5 pembatalan ganda ditolak', !S.batalkanActual(act.actual_id,'Alasan lain yang cukup panjang').ok);

// G. Utilisasi dan sebaran bulan
S.catatActual(hire.allocation_id,{quantity:3,actual_date:'2027-03-10',employee_name:'Tiga operator'});
let r=S.ringkasMonitoring('MPP-2027');
const prd=r.perDept.find(x=>x.department_id==='D-PRD');
cek('G1 utilisasi Produksi terhitung', prd.terpakai===3 && prd.kuota===4,
    prd.terpakai+' / '+prd.kuota);
cek('G2 persentase utilisasi benar', prd.utilisasi===75, String(prd.utilisasi));
cek('G3 sebaran bulan memisahkan rencana dan realisasi',
    r.perBulan[2].realisasi===3 && r.perBulan[2].rencana===3,
    JSON.stringify(r.perBulan[2]));
cek('G4 biaya realisasi memakai bulan masuk kerja, bukan bulan rencana',
    r.total.biayaActual>0 && r.total.biayaActual<=r.total.biayaAlokasi,
    F.rupiah(r.total.biayaActual)+' vs '+F.rupiah(r.total.biayaAlokasi));

// H. Layar
w.location.hash='#monitoring'; w.NBApp.ulang();
let html=d.getElementById('nbPage').innerHTML;
cek('H1 layar monitoring tampil', html.includes('Monitoring Realisasi'));
cek('H2 monitor tidak melihat kolom biaya', !/Rp[\d.]/.test(html), (html.match(/Rp[\d.,]+/g)||[]).slice(0,2).join(' '));
d.querySelector("button[data-tab='alokasi']").click();
cek('H3 tab alokasi menampilkan tombol catat', !!d.querySelector('button[data-catat]'));
d.querySelector('button[data-catat]').click();
cek('H4 dialog pencatatan terbuka', !!d.getElementById('mCatat'));
d.getElementById('cTanggal').value='2027-02-15';
d.getElementById('cNama').value='Uji Lewat Layar';
d.getElementById('cOk').click();
cek('H5 pencatatan lewat layar berhasil',
    S.actualTerlihat('MPP-2027').some(a=>a.employee_name==='Uji Lewat Layar'));
d.querySelector("button[data-tab='exception']").click();
cek('H6 tab exception menampilkan riwayat', d.getElementById('nbPage').innerHTML.includes('EXC-2027-'));
S.keluar(); S.masuk('U-HOD-MKT'); w.location.hash='#monitoring'; w.NBApp.ulang();
cek('H7 HOD melihat monitoring tanpa tombol catat', !d.querySelector('button[data-catat]'));

console.log('\nTOTAL GAGAL: '+gagal.length); gagal.forEach(x=>console.log(' - '+x));
},400);
