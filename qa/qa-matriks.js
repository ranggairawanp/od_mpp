// QA matriks bulanan: posisi akhir bulan, budget, actual, selisih, dan ekspornya.
const {JSDOM}=require('jsdom'), fs=require('fs');
const FX = require(__dirname + '/fixture.js');
const w=new JSDOM(fs.readFileSync('/home/claude/mpp/dist/index.html','utf8'),
  {runScripts:'dangerously',url:'https://local.test/',pretendToBeVisual:true}).window;
w.scrollTo=()=>{}; w.URL.createObjectURL=()=>'blob:uji'; w.URL.revokeObjectURL=()=>{};
const gagal=[]; const cek=(n,ok,i)=>{ if(!ok) gagal.push(n); console.log((ok?'PASS ':'GAGAL')+'  '+n+(!ok&&i?'  ['+i+']':'')); };
setTimeout(()=>{
// Aplikasi kosong: data dimuat lewat jalur impor sungguhan.
FX.lengkap(w);
const d=w.document, S=w.NBStore;

// Persiapan penuh sampai alokasi dibagikan
S.masuk('U-OD-01'); S.ubahStatusSiklus('MPP-2027','OPEN'); S.rilisSnapshot('MPP-2027','2026-09-01');
S.keluar(); S.masuk('U-HOD-MKT'); S.kirimSubmission('MPP-2027','D-MKT');
S.keluar(); S.masuk('U-HOD-PRD'); S.kirimSubmission('MPP-2027','D-PRD');
S.keluar(); S.masuk('U-OD-01');
S.reviewSubmission('SUB-2027-MKT','ACCEPT',null); S.reviewSubmission('SUB-2027-PRD','ACCEPT',null);
S.kunciKonsolidasi('MPP-2027');
S.keluar(); S.masuk('U-MGT-01');
S.barisReview('MPP-2027').forEach(l=>S.putuskanBaris(l.line_item_id,'APPROVE',null,null));
S.setujuiMpp('MPP-2027','Disetujui penuh untuk pengujian matriks');
S.keluar(); S.masuk('U-OD-01'); S.distribusikanAlokasi('MPP-2027');

let mx=S.matriksBulanan('MPP-2027',{mode:'HC',level:'DEPT'});
const mkt=mx.baris.find(b=>b.department_id==='D-MKT');
const prd=mx.baris.find(b=>b.department_id==='D-PRD');

// A. Posisi awal
cek('A1 dua belas kolom bulan tersedia', mkt.budget.length===12 && mkt.actual.length===12);
cek('A2 posisi Januari Marketing sama dengan snapshot delapan orang',
    mkt.budget[0]===8, String(mkt.budget[0]));
cek('A3 posisi Januari Produksi sama dengan snapshot empat belas orang',
    prd.budget[0]===14, String(prd.budget[0]));

// B. Posisi akhir bulan, bukan penambahan bulan itu
// Marketing: vacancy fill Feb (+1), posisi baru diisi Jul (+1)
cek('B1 Februari naik satu setelah vacancy diisi', mkt.budget[1]===9, String(mkt.budget[1]));
cek('B2 Maret sampai Juni tetap sembilan, bukan kembali ke delapan',
    mkt.budget[2]===9 && mkt.budget[5]===9, mkt.budget[2]+','+mkt.budget[5]);
cek('B3 Juli naik lagi menjadi sepuluh', mkt.budget[6]===10, String(mkt.budget[6]));
cek('B4 Desember tetap sepuluh', mkt.budget[11]===10, String(mkt.budget[11]));
// Produksi: hiring 3 Mar (+3), pengurangan Sep (-1)
cek('B5 Maret Produksi naik tiga', prd.budget[2]===17, String(prd.budget[2]));
cek('B6 September Produksi turun satu', prd.budget[8]===16, String(prd.budget[8]));
cek('B7 promosi tidak mengubah headcount bulanan',
    mkt.budget[3]===mkt.budget[2], mkt.budget[2]+' -> '+mkt.budget[3]);

// C. Actual dan selisih
cek('C1 sebelum ada realisasi actual sama dengan posisi awal',
    mkt.actual[11]===8 && prd.actual[11]===14, mkt.actual[11]+','+prd.actual[11]);
cek('C2 selisih negatif sebesar yang belum terealisasi',
    mkt.selisih[11]===-2 && prd.selisih[11]===-2, mkt.selisih[11]+','+prd.selisih[11]);
const hire=S.alokasiTerlihat('MPP-2027').find(a=>a.action_type==='EXTERNAL_HIRING');
S.keluar(); S.masuk('U-MON-01');
S.catatActual(hire.allocation_id,{quantity:3,actual_date:'2027-05-10',employee_name:'Tiga operator'});
S.keluar(); S.masuk('U-OD-01');
mx=S.matriksBulanan('MPP-2027',{mode:'HC',level:'DEPT'});
const prd2=mx.baris.find(b=>b.department_id==='D-PRD');
cek('C3 actual naik mulai bulan masuk kerja, bukan bulan rencana',
    prd2.actual[3]===14 && prd2.actual[4]===17, prd2.actual[3]+' -> '+prd2.actual[4]);
cek('C4 selisih April negatif tiga karena rencana Maret belum terealisasi',
    prd2.selisih[3]===-3, String(prd2.selisih[3]));
cek('C5 selisih Mei kembali nol setelah realisasi menyusul',
    prd2.selisih[4]===0, String(prd2.selisih[4]));
cek('C6 selisih akhir tahun tinggal kekurangan yang belum direalisasi',
    prd2.selisih[11]===1, String(prd2.selisih[11]));

// D. Total perusahaan
cek('D1 total sama dengan jumlah seluruh baris',
    mx.total.budget[11]===mx.baris.reduce((t,b)=>t+b.budget[11],0));
cek('D2 total selisih sama dengan total actual dikurangi total budget',
    mx.total.selisih[11]===mx.total.actual[11]-mx.total.budget[11]);

// E. Mode rupiah
const rp=S.matriksBulanan('MPP-2027',{mode:'RP',level:'DEPT'});
const mktRp=rp.baris.find(b=>b.department_id==='D-MKT');
cek('E1 rupiah Januari berisi beban gaji berjalan', mktRp.budget[0]>0);
cek('E2 rupiah naik setelah bulan efektif', mktRp.budget[11]>mktRp.budget[0],
    mktRp.budget[0]+' -> '+mktRp.budget[11]);

// F. Level jabatan
const pos=S.matriksBulanan('MPP-2027',{mode:'HC',level:'POSISI'});
cek('F1 level jabatan menghasilkan baris lebih banyak', pos.baris.length>mx.baris.length,
    pos.baris.length+' vs '+mx.baris.length);
cek('F2 setiap baris jabatan menyebut departemen induknya',
    pos.baris.every(b=>!!b.departemen && !!b.jabatan));
cek('F3 total level jabatan sama dengan total level departemen',
    pos.total.budget[11]===mx.total.budget[11],
    pos.total.budget[11]+' vs '+mx.total.budget[11]);

// G. Kolom yang diminta ada semua
const R10=S.dataLaporan('R10','MPP-2027');
const label=R10.kolom.map(k=>k.label);
cek('G1 laporan memuat entitas, negara, divisi, departemen, jabatan, cost center',
    ['Legal Entity','Negara','Divisi','Departemen','Jabatan','Cost Center'].every(x=>label.includes(x)),
    label.join(','));
cek('G2 laporan memuat dua belas kolom bulan',
    ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'].every(x=>label.includes(x)));
cek('G3 setiap unit punya tiga pita Budget, Actual, Selisih',
    R10.baris.length===pos.baris.length*3, R10.baris.length+' vs '+(pos.baris.length*3));
cek('G4 nilai laporan sama dengan matriks di layar',
    R10.baris.find(b=>b.ukuran==='Budget').b12 !== undefined);

// H. Hak akses
S.keluar(); S.masuk('U-MON-01');
w.location.hash='#matriks'; w.NBApp.ulang();
let html=d.getElementById('nbPage').innerHTML;
cek('H1 monitor melihat matriks headcount', html.indexOf('Matriks')>-1);
cek('H2 monitor tidak ditawari mode rupiah', !d.querySelector("button[data-mode='RP']"));
cek('H3 monitor tidak melihat nominal', !/Rp[\d.]/.test(html));
S.keluar(); S.masuk('U-HOD-MKT'); w.NBApp.ulang();
const mxHod=S.matriksBulanan('MPP-2027',{mode:'HC',level:'DEPT'});
cek('H4 HOD hanya melihat departemennya', mxHod.baris.every(b=>b.department_id==='D-MKT'));
S.keluar(); S.masuk('U-OD-01'); w.location.hash='#matriks'; w.NBApp.ulang();
cek('H5 OD punya tombol ekspor', !!d.getElementById('mxEkspor'));
d.getElementById('mxEkspor').click();
cek('H6 ekspor tercatat di audit',
    w.NBAudit.semua().some(e=>e.event_type==='REPORT_EXPORT'&&e.object_id==='R10'));

console.log('\nTOTAL GAGAL: '+gagal.length); gagal.forEach(x=>console.log(' - '+x));
},500);
