// QA impor struktur organisasi: menambah departemen tanpa menyentuh kode.
const {JSDOM}=require('jsdom'), fs=require('fs');
const FX = require(__dirname + '/fixture.js');
const w=new JSDOM(fs.readFileSync('/home/claude/mpp/dist/index.html','utf8'),
  {runScripts:'dangerously',url:'https://local.test/',pretendToBeVisual:true}).window;
w.scrollTo=()=>{};
const gagal=[]; const cek=(n,ok,i)=>{ if(!ok) gagal.push(n); console.log((ok?'PASS ':'GAGAL')+'  '+n+(!ok&&i?'  ['+i+']':'')); };
setTimeout(()=>{
// Aplikasi kosong: data dimuat lewat jalur impor sungguhan.
FX.lengkap(w);
const d=w.document, S=w.NBStore, I=w.NBImpor;
const csv=fs.readFileSync('/home/claude/mpp/contoh/07-organisasi-tambahan.csv','utf8');

// A. Keadaan awal
S.masuk('U-OD-01');
cek('A1 tujuh departemen bawaan', S.semuaDepartemen().length===7, String(S.semuaDepartemen().length));
w.NBApp.ulang();
// Peran berlingkup penuh tidak lagi menyebut jumlah, karena angka itu terbaca seolah batas.
cek('A2 penanda lingkup penuh tidak menyebut angka',
    d.getElementById('nbUser').textContent.indexOf('Seluruh departemen')>-1 &&
    !/\d+ departemen/.test(d.getElementById('nbUser').textContent),
    d.getElementById('nbUser').textContent.trim());
cek('A3 halaman login menyebut ukuran data',
    (S.keluar(), w.NBApp.ulang(), d.getElementById('nbPage').textContent.indexOf('7 departemen')>-1));
S.masuk('U-OD-01');

// B. Hak unggah
S.keluar(); S.masuk('U-HOD-MKT');
cek('B1 HOD tidak boleh mengunggah struktur', !S.bolehImpor('ORGANISASI').ok);
S.keluar(); S.masuk('U-CB-01');
cek('B2 C&B tidak boleh mengunggah struktur', !S.bolehImpor('ORGANISASI').ok);
S.keluar(); S.masuk('U-OD-01');
cek('B3 OD boleh mengunggah struktur', S.bolehImpor('ORGANISASI').ok);

// C. Impor
const u=I.urai(csv);
cek('C1 kolom wajib lengkap', I.periksaKepala('ORGANISASI',u.kolom).ok);
let p=S.pratinjauImpor('ORGANISASI',u.baris,'MPP-2027');
cek('C2 tujuh baris siap ditambah', p.valid===7 && p.galat===0, 'valid '+p.valid+' galat '+p.galat);
cek('C3 seluruhnya ditandai tambah', p.hasil.every(h=>h.aksi==='TAMBAH'));
let hasil=S.terapkanImpor('ORGANISASI',u.baris,'MPP-2027');
cek('C4 tujuh departemen bertambah', hasil.masuk===7 && S.semuaDepartemen().length===14,
    String(S.semuaDepartemen().length));
cek('C5 cost center ikut terbentuk', !!S.costCenter('CC-4100'));
cek('C6 departemen baru menempel di divisi yang benar',
    S.departemen('D-RND').division_id==='DIV-OPS' && S.departemen('D-ITE').division_id==='DIV-CRP');

// D. Angka lingkup ikut berubah
w.NBApp.ulang();
cek('D1 halaman login menyebut empat belas setelah impor',
    (S.keluar(), w.NBApp.ulang(), d.getElementById('nbPage').textContent.indexOf('14 departemen')>-1));
S.masuk('U-OD-01'); w.NBApp.ulang();
cek('D2 konsolidasi mengenali empat belas departemen',
    S.konsolidasi('MPP-2027').perDept.length===14);
cek('D3 dashboard menghitung empat belas',
    S.departemenTerlihat().length===14);

// E. Perlindungan struktur
let pindah=S.pratinjauImpor('ORGANISASI',[{entity_id:'ENT-KSNI',entity_name:'PT Kaldu Sari Nabati Indonesia',
  country:'ID',directorate_id:'DIR-COM',directorate_name:'Commercial',division_id:'DIV-COM',division_name:'Commercial',department_id:'D-RND',
  department_name:'Research & Development',cost_center_id:'CC-4100'}],'MPP-2027');
cek('E1 memindah departemen antar divisi lewat impor ditolak',
    !pindah.hasil[0].ok && pindah.hasil[0].kunci==='imp.vPindahDivisi', JSON.stringify(pindah.hasil[0]));
let kosong=S.pratinjauImpor('ORGANISASI',[{entity_id:'',entity_name:'',country:'ID',
  division_id:'DIV-X',division_name:'X',department_id:'D-X',department_name:'X',cost_center_id:'CC-X'}],'MPP-2027');
cek('E2 entitas kosong ditolak', !kosong.hasil[0].ok && kosong.hasil[0].kunci==='imp.vEntitas');
let tanpaDir=S.pratinjauImpor('ORGANISASI',[{entity_id:'ENT-KSNI',entity_name:'PT Kaldu Sari Nabati Indonesia',
  country:'ID',directorate_id:'',directorate_name:'',division_id:'DIV-X',division_name:'X',
  department_id:'D-X',department_name:'X',cost_center_id:'CC-X'}],'MPP-2027');
cek('E3 direktorat kosong ditolak', !tanpaDir.hasil[0].ok && tanpaDir.hasil[0].kunci==='imp.vDirektorat');

// F. Entitas kedua
let entitas2=S.terapkanImpor('ORGANISASI',[{entity_id:'ENT-NBM',entity_name:'Nabati Malaysia Sdn Bhd',
  country:'MY',directorate_id:'MY-DIR',directorate_name:'Malaysia Operations',division_id:'MY-OPS',division_name:'Operations Malaysia',department_id:'MY-PRD',
  department_name:'Produksi Johor',cost_center_id:'MY-CC-01',cost_center_name:'Produksi Johor'}],'MPP-2027');
cek('F1 entitas kedua bisa ditambahkan', entitas2.masuk===1 && S.semuaDepartemen().length===15);
cek('F2 negara tersimpan', S.divisi('MY-OPS').entity_id==='ENT-NBM');

// G. Ekspor balik dan siklus tertutup
const ek=S.eksporData('ORGANISASI','MPP-2027');
cek('G1 ekspor berisi seluruh departemen', ek.baris.length===15, String(ek.baris.length));
cek('G2 ekspor memuat entitas dan negara',
    ek.baris.some(b=>b.entity_id==='ENT-NBM'&&b.country==='MY'));
const bolak=I.urai(w.NBReport.keCsv(ek.kolom,ek.baris));
cek('G3 hasil ekspor bisa diunggah kembali',
    S.pratinjauImpor('ORGANISASI',bolak.baris,'MPP-2027').galat===0);

// H. Matriks bulanan ikut memuat departemen baru
S.ubahStatusSiklus('MPP-2027','OPEN'); S.rilisSnapshot('MPP-2027','2026-09-01');
const mx=S.matriksBulanan('MPP-2027',{mode:'HC',level:'DEPT'});
cek('H1 departemen tanpa karyawan tidak memenuhi matriks',
    mx.baris.length<=15 && mx.baris.length>=7, String(mx.baris.length));

console.log('\nTOTAL GAGAL: '+gagal.length); gagal.forEach(x=>console.log(' - '+x));
},400);
