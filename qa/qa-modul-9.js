// QA Modul 9: laporan, ekspor, notifikasi, administrasi, penutupan siklus.
const {JSDOM}=require('jsdom'), fs=require('fs');
const F = require(__dirname + '/fixture.js');
const dom=new JSDOM(fs.readFileSync('/home/claude/mpp/dist/index.html','utf8'),
  {runScripts:'dangerously',url:'https://local.test/',pretendToBeVisual:true});
const w=dom.window; w.scrollTo=()=>{};
w.URL.createObjectURL=()=>'blob:uji'; w.URL.revokeObjectURL=()=>{};
const gagal=[]; const cek=(n,ok,i)=>{ if(!ok) gagal.push(n); console.log((ok?'PASS ':'GAGAL')+'  '+n+(!ok&&i?'  ['+i+']':'')); };
setTimeout(()=>{
// Aplikasi kosong: data dimuat lewat jalur impor sungguhan.
F.lengkap(w);
const d=w.document, S=w.NBStore, R=w.NBReport;

// A. Notifikasi mengikuti peran dan keadaan data
S.masuk('U-OD-01'); S.ubahStatusSiklus('MPP-2027','OPEN');
let n=S.notifikasi('MPP-2027');
cek('A1 OD belum punya usulan untuk direview', !n.some(x=>x.jenis==='REVIEW'));
S.keluar(); S.masuk('U-HOD-MKT');
n=S.notifikasi('MPP-2027');
cek('A2 HOD diingatkan usulannya belum dikirim', n.some(x=>x.jenis==='PLAN'), JSON.stringify(n.map(x=>x.jenis)));
S.kirimSubmission('MPP-2027','D-MKT');
S.keluar(); S.masuk('U-HOD-PRD'); S.kirimSubmission('MPP-2027','D-PRD');
S.keluar(); S.masuk('U-OD-01');
n=S.notifikasi('MPP-2027');
cek('A3 OD diingatkan ada dua usulan menunggu review',
    n.some(x=>x.jenis==='REVIEW'&&x.vars.n===2), JSON.stringify(n.map(x=>x.jenis+':'+(x.vars.n||''))));
S.reviewSubmission('SUB-2027-MKT','ACCEPT',null); S.reviewSubmission('SUB-2027-PRD','ACCEPT',null);
cek('A4 OD diingatkan siap konsolidasi', S.notifikasi('MPP-2027').some(x=>x.jenis==='KONSOLIDASI'));
S.kunciKonsolidasi('MPP-2027');
S.keluar(); S.masuk('U-MGT-01');
cek('A5 manajemen diingatkan ada baris menunggu keputusan',
    S.notifikasi('MPP-2027').some(x=>x.jenis==='KEPUTUSAN'));

// B. Laporan sebelum keputusan
S.keluar(); S.masuk('U-OD-01');
let r2=S.dataLaporan('R2','MPP-2027');
cek('B1 laporan usulan berisi lima baris', r2.baris.length===5, String(r2.baris.length));
cek('B2 kolom laporan lengkap', r2.kolom.length===8);
let r1=S.dataLaporan('R1','MPP-2027');
cek('B3 laporan struktur kosong sebelum snapshot dirilis', r1.baris.length===0);
S.rilisSnapshot('MPP-2027','2026-09-01');
cek('B4 laporan struktur terisi setelah snapshot', S.dataLaporan('R1','MPP-2027').baris.length===62,
    String(S.dataLaporan('R1','MPP-2027').baris.length));

// Lanjutkan sampai realisasi
S.keluar(); S.masuk('U-MGT-01');
S.barisReview('MPP-2027').forEach(l=>S.putuskanBaris(l.line_item_id,'APPROVE',null,null));
S.setujuiMpp('MPP-2027','Disetujui penuh untuk pengujian laporan');
S.keluar(); S.masuk('U-OD-01'); S.distribusikanAlokasi('MPP-2027');
const hire=S.alokasiTerlihat('MPP-2027').find(a=>a.action_type==='EXTERNAL_HIRING');
S.keluar(); S.masuk('U-MON-01');
const rHire=S.catatActual(hire.allocation_id,{quantity:2,actual_date:'2027-04-05',employee_name:'Rizal Saputra'});
S.keluar(); S.masuk('U-OD-01'); S.setujuiRealisasi(rHire.actual.actual_id,'SETUJU',null); S.keluar(); S.masuk('U-MON-01');

// C. Sembilan laporan terisi
S.keluar(); S.masuk('U-OD-01');
['R1','R2','R3','R4','R5','R6','R7','R9'].forEach(function(k){
  const x=S.dataLaporan(k,'MPP-2027');
  cek('C laporan '+k+' berisi data', x.baris.length>0, String(x.baris.length));
});
cek('C laporan R8 kosong karena belum ada exception', S.dataLaporan('R8','MPP-2027').baris.length===0);

// D. Ekspor CSV
const r3=S.dataLaporan('R3','MPP-2027');
const csv=R.keCsv(r3.kolom,r3.baris);
cek('D1 csv memakai titik koma', csv.split('\n')[0].indexOf(';')>-1);
cek('D2 csv memuat BOM utf-8', csv.charCodeAt(0)===0xFEFF);
cek('D3 jumlah baris csv sama dengan data', csv.trim().split('\r\n').length===r3.baris.length+1,
    csv.trim().split('\r\n').length+' vs '+(r3.baris.length+1));
const uji=R.keCsv([{kunci:'a',label:'A'}],[{a:'ada;titik koma'},{a:'ada "kutip"'}]);
cek('D4 nilai berisi pemisah dikutip', uji.indexOf('"ada;titik koma"')>-1);
cek('D5 tanda kutip digandakan', uji.indexOf('""kutip""')>-1);

// E. Hak akses laporan biaya
S.keluar(); S.masuk('U-MON-01');
w.location.hash='#laporan'; w.NBApp.ulang();
let opsi=Array.from(d.querySelectorAll('#lPilih option')).map(o=>o.value);
cek('E1 monitor tidak melihat laporan biaya', !opsi.includes('R4')&&!opsi.includes('R5'), opsi.join(','));
S.keluar(); S.masuk('U-CB-01'); w.NBApp.ulang();
opsi=Array.from(d.querySelectorAll('#lPilih option')).map(o=>o.value);
// Sepuluh sejak matriks bulanan ditambahkan sebagai laporan R10.
cek('E2 C&B melihat seluruh laporan', opsi.length===10, String(opsi.length));
S.keluar(); S.masuk('U-HOD-MKT'); w.NBApp.ulang();
cek('E3 HOD hanya melihat barisnya sendiri di laporan usulan',
    S.dataLaporan('R2','MPP-2027').baris.every(b=>b.department_id==='D-MKT'));

// F. Ekspor lewat layar
S.keluar(); S.masuk('U-OD-01'); w.location.hash='#laporan'; w.NBApp.ulang();
d.getElementById('lEkspor').click();
cek('F1 ekspor tercatat di audit', w.NBAudit.semua().some(e=>e.event_type==='REPORT_EXPORT'));

// G. Penutupan siklus
let p=S.periksaPenutupan('MPP-2027');
cek('G1 sisa kuota muncul sebagai catatan, bukan penghalang',
    p.masalah.some(x=>x.kunci==='tutup.sisa'&&!x.blokir) && p.bolehTutup, JSON.stringify(p.masalah));
// Buat exception menggantung
S.keluar(); S.masuk('U-MON-01');
const promo=S.alokasiTerlihat('MPP-2027').find(a=>a.action_type==='PROMOTION');
const rp1=S.catatActual(promo.allocation_id,{quantity:1,actual_date:'2027-04-01',employee_name:'Dimas Handayani'});
const rp2=S.catatActual(promo.allocation_id,{quantity:1,actual_date:'2027-06-01',employee_name:'Kelebihan'});
S.keluar(); S.masuk('U-OD-01');
S.setujuiRealisasi(rp1.actual.actual_id,'SETUJU',null); S.setujuiRealisasi(rp2.actual.actual_id,'SETUJU',null);
p=S.periksaPenutupan('MPP-2027');
cek('G2 exception menggantung menghalangi penutupan',
    !p.bolehTutup && p.masalah.some(x=>x.kunci==='tutup.exception'));
let tutup=S.ubahStatusSiklus('MPP-2027','CLOSED',null);
cek('G3 penutupan ditolak selama ada penghalang', !tutup.ok && tutup.kunci==='tutup.errBlokir', JSON.stringify(tutup));
const exc=S.exceptionTerlihat('MPP-2027')[0];
S.putuskanException(exc.exception_id,'ACCEPT','Kelebihan promosi disetujui sebagai pengecualian terdokumentasi');
tutup=S.ubahStatusSiklus('MPP-2027','CLOSED',null);
cek('G4 penutupan berhasil setelah dibereskan', tutup.ok);
cek('G5 ringkasan akhir tahun dibekukan',
    !!S.siklus('MPP-2027').closure_summary && S.siklus('MPP-2027').closure_summary.kuota>0,
    JSON.stringify(S.siklus('MPP-2027').closure_summary||{}).slice(0,80));
cek('G6 siklus tertutup menolak penulisan',
    !S.catatActual(hire.allocation_id,{quantity:1,actual_date:'2027-05-01'}).ok);

// H. Layar administrasi
w.location.hash='#admin'; w.NBApp.ulang();
let html=d.getElementById('nbPage').innerHTML;
cek('H1 layar administrasi tampil', html.includes('Administrasi'));
// Enam belas: admin, empat non-lini, tujuh HOD turunan, empat manajer turunan.
// Yang keempat lahir dari realisasi promosi NBT2004 ke 5A yang disetujui HC di bagian G.
cek('H2 daftar pengguna menampilkan seluruh persona termasuk turunan', d.querySelectorAll('#nbPage tbody tr').length===16,
    String(d.querySelectorAll('#nbPage tbody tr').length));
d.querySelector("button[data-tab='parameter']").click();
cek('H3 tab parameter menampilkan paket asumsi yang berlaku', d.getElementById('nbPage').innerHTML.includes('CA-2026'));
d.querySelector("button[data-tab='penutupan']").click();
html=d.getElementById('nbPage').innerHTML;
cek('H4 tab penutupan menampilkan ringkasan akhir', html.includes('Utilisasi')||html.includes('utilisasi'));
S.keluar(); S.masuk('U-HOD-MKT'); w.location.hash='#admin'; w.NBApp.ulang();
cek('H5 HOD dilempar dari administrasi', w.location.hash==='#dashboard');

// I. Notifikasi di dashboard
w.location.hash='#dashboard'; w.NBApp.ulang();
cek('I1 panel notifikasi tampil bila ada pekerjaan',
    d.getElementById('nbPage').innerHTML.indexOf('menunggu Anda')>-1 ||
    S.notifikasi('MPP-2027').length===0);

console.log('\nTOTAL GAGAL: '+gagal.length); gagal.forEach(x=>console.log(' - '+x));
},400);
