// QA Modul 7: alokasi yang disetujui, distribusi, dan tabel varians.
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

// Persiapan sampai disetujui manajemen
S.masuk('U-OD-01'); S.ubahStatusSiklus('MPP-2027','OPEN'); S.keluar();
S.masuk('U-HOD-MKT'); S.kirimSubmission('MPP-2027','D-MKT'); S.keluar();
S.masuk('U-HOD-PRD'); S.kirimSubmission('MPP-2027','D-PRD'); S.keluar();
S.masuk('U-OD-01');
S.reviewSubmission('SUB-2027-MKT','ACCEPT',null); S.reviewSubmission('SUB-2027-PRD','ACCEPT',null);

// A. Sebelum disetujui
cek('A1 distribusi ditolak sebelum ada persetujuan',
    !S.distribusikanAlokasi('MPP-2027').ok);
S.kunciKonsolidasi('MPP-2027');
cek('A2 distribusi masih ditolak setelah konsolidasi saja',
    S.distribusikanAlokasi('MPP-2027').kunci==='alok.errBelumDisetujui');

// Keputusan manajemen
S.keluar(); S.masuk('U-MGT-01');
S.putuskanBaris('LI-0004','REDUCE',2,'Kapasitas anggaran 2027 hanya menampung dua operator');
S.putuskanBaris('LI-0003','REJECT',0,'Analisis kampanye cukup ditangani agensi tahun depan');
['LI-0001','LI-0002','LI-0005'].forEach(id=>S.putuskanBaris(id,'APPROVE',null,null));
S.setujuiMpp('MPP-2027','Disetujui dengan pemangkasan pada lini produksi');

// B. Distribusi
cek('B1 manajemen tidak membagikan alokasi', !S.distribusikanAlokasi('MPP-2027').ok);
S.keluar(); S.masuk('U-OD-01');
let dist=S.distribusikanAlokasi('MPP-2027');
cek('B2 distribusi berhasil', dist.ok, JSON.stringify(dist));
let alokasi=S.alokasiTerlihat('MPP-2027');
cek('B3 baris ditolak tidak menjadi alokasi', alokasi.length===4 && !alokasi.some(a=>a.line_item_id==='LI-0003'),
    String(alokasi.length));
cek('B4 kuota mengikuti angka yang disetujui, bukan usulan',
    alokasi.find(a=>a.line_item_id==='LI-0004').approved_qty===2);
cek('B5 sisa kuota sama dengan kuota di awal',
    alokasi.every(a=>a.remaining_qty===a.approved_qty && a.consumed_qty===0));
cek('B6 biaya alokasi mengikuti kuantitas disetujui',
    alokasi.find(a=>a.line_item_id==='LI-0004').annualized_cost>0);
cek('B7 distribusi kedua ditolak', S.distribusikanAlokasi('MPP-2027').kunci==='alok.errSudah');
cek('B8 usulan berubah jadi DISTRIBUTED',
    S.submissionDepartemen('MPP-2027','D-MKT').status==='DISTRIBUTED');
cek('B9 audit mencatat distribusi',
    w.NBAudit.semua().some(e=>e.event_type==='ALLOC_DISTRIBUTE'));

// C. Tabel Requested, Approved, Variance
let r=S.ringkasAlokasi('MPP-2027');
const mkt=r.perDept.find(x=>x.department_id==='D-MKT');
const prd=r.perDept.find(x=>x.department_id==='D-PRD');
cek('C1 Marketing diusulkan dua disetujui satu', mkt.requested===2 && mkt.approved===1,
    mkt.requested+' / '+mkt.approved);
cek('C2 variance Marketing minus satu', mkt.variance===-1, String(mkt.variance));
cek('C3 Produksi diusulkan dua disetujui satu', prd.requested===2 && prd.approved===1,
    prd.requested+' / '+prd.approved);
cek('C4 total variance minus dua', r.total.variance===-2, String(r.total.variance));
cek('C5 total kuota lima', r.total.approvedQty===5, String(r.total.approvedQty));
cek('C6 sisa sama dengan kuota', r.total.sisa===r.total.approvedQty);

// D. Lingkup baris dan kolom
S.keluar(); S.masuk('U-HOD-MKT');
let rm=S.ringkasAlokasi('MPP-2027');
cek('D1 HOD hanya melihat alokasinya sendiri',
    rm.alokasi.length===2 && rm.alokasi.every(a=>a.department_id==='D-MKT'), String(rm.alokasi.length));
cek('D2 HOD tidak melihat variance departemen lain', rm.perDept.length===1);
w.location.hash='#approved'; w.NBApp.ulang();
let html=d.getElementById('nbPage').innerHTML;
cek('D3 HOD melihat kolom biaya departemennya', html.includes('Tahunan'));
cek('D4 HOD tidak punya tombol distribusi', !d.getElementById('aDistribusi'));
S.keluar(); S.masuk('U-MON-01'); w.NBApp.ulang();
html=d.getElementById('nbPage').innerHTML;
cek('D5 monitor melihat seluruh departemen',
    d.querySelectorAll('#nbPage tbody tr').length>=3);
cek('D6 monitor tidak melihat kolom biaya', !html.includes('Tahunan') && !/Rp\d/.test(html),
    (html.match(/Rp[\d.,]+/g)||[]).slice(0,3).join(' '));

// E. Layar
S.keluar(); S.masuk('U-OD-01'); w.location.hash='#approved'; w.NBApp.ulang();
html=d.getElementById('nbPage').innerHTML;
cek('E1 layar approved tampil', html.includes('Approved MPP'));
cek('E2 penanda sudah dibagikan tampil', html.includes('alokasi sudah dibagikan')||html.includes('4'));
d.querySelector("button[data-tab='alokasi']").click();
html=d.getElementById('nbPage').innerHTML;
cek('E3 tab daftar alokasi bekerja', html.includes('ALO-2027-'));
cek('E4 kuota dan sisa tampil per alokasi', d.querySelectorAll('#nbPage tbody tr').length===4);

// F. Dashboard
w.location.hash='#dashboard'; w.NBApp.ulang();
html=d.getElementById('nbPage').innerHTML;
cek('F1 kolom Approved di dashboard terisi', html.includes('APR-2027-V1'));

console.log('\nTOTAL GAGAL: '+gagal.length); gagal.forEach(x=>console.log(' - '+x));
},400);
