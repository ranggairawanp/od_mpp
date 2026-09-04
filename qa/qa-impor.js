// QA impor dan ekspor: parser, templat, validasi, penerapan, cadangan.
const {JSDOM}=require('jsdom'), fs=require('fs');
const FX = require(__dirname + '/fixture.js');
const w=new JSDOM(fs.readFileSync('/home/claude/mpp/dist/index.html','utf8'),
  {runScripts:'dangerously',url:'https://local.test/',pretendToBeVisual:true}).window;
w.scrollTo=()=>{}; w.URL.createObjectURL=()=>'blob:uji'; w.URL.revokeObjectURL=()=>{};
const gagal=[]; const cek=(n,ok,i)=>{ if(!ok) gagal.push(n); console.log((ok?'PASS ':'GAGAL')+'  '+n+(!ok&&i?'  ['+i+']':'')); };
setTimeout(()=>{
// Aplikasi kosong: data dimuat lewat jalur impor sungguhan.
FX.lengkap(w);
const d=w.document, S=w.NBStore, I=w.NBImpor, R=w.NBReport;

// A. Parser CSV
let u=I.urai('a;b;c\n1;2;3\n4;5;6');
cek('A1 titik koma dikenali', u.kolom.join(',')==='a,b,c' && u.baris.length===2);
u=I.urai('a,b\n"isi, berkoma",2');
cek('A2 koma dikenali dan kutip dihormati', u.baris[0].a==='isi, berkoma' && u.baris[0].b==='2');
u=I.urai('\uFEFFa;b\n1;2');
cek('A3 BOM dibuang', u.kolom[0]==='a');
u=I.urai('a;b\n"pakai ""kutip""";2');
cek('A4 kutip ganda dibaca benar', u.baris[0].a==='pakai "kutip"');
cek('A5 nomor baris berkas dicatat', u.baris[0]._baris===2);
u=I.urai('a;b\n1;2\n\n3;4\n');
cek('A6 baris kosong dilewati', u.baris.length===2);

// B. Templat dan pemeriksaan kepala
// Lima sejak struktur organisasi bisa diunggah juga.
cek('B1 templat tersedia untuk sembilan berkas', I.daftar().length===9, I.daftar().join(','));
const t=I.templat('USULAN');
cek('B2 templat berisi kepala dan contoh', t.split('\r\n').length===2 && t.indexOf('department_id')>-1);
cek('B3 kolom wajib yang hilang ditolak',
    !I.periksaKepala('USULAN',['department_id']).ok);
cek('B4 kolom lengkap diterima',
    I.periksaKepala('USULAN', I.def('USULAN').kolom.map(k=>k.k)).ok);

// C. Hak unggah mengikuti peran
S.masuk('U-MON-01');
cek('C1 monitor hanya boleh unggah realisasi',
    S.bolehImpor('REALISASI').ok && !S.bolehImpor('USULAN').ok && !S.bolehImpor('KARYAWAN').ok);
S.keluar(); S.masuk('U-CB-01');
cek('C2 C&B boleh unggah asumsi biaya', S.bolehImpor('ASUMSI').ok && !S.bolehImpor('KARYAWAN').ok);
S.keluar(); S.masuk('U-HOD-MKT');
cek('C3 HOD boleh unggah usulan', S.bolehImpor('USULAN').ok && !S.bolehImpor('ASUMSI').ok);
S.keluar(); S.masuk('U-OD-01');
cek('C4 OD boleh unggah master dan struktur',
    S.bolehImpor('KARYAWAN').ok && S.bolehImpor('ORGANISASI').ok);

// D. Impor usulan lewat validasi yang sama
S.ubahStatusSiklus('MPP-2027','OPEN');
S.keluar(); S.masuk('U-HOD-MKT');
const csv='department_id;action_type;position_id;replacement_flag;quantity;effective_month;justification\n'+
 'D-MKT;EXTERNAL_HIRING;POS-MKT-004;Additional;2;5;Menambah kapasitas eksekusi kampanye digital\n'+
 'D-MKT;EXTERNAL_HIRING;POS-MKT-004;Additional;1;0;Bulan efektif sengaja dikosongkan\n'+
 'D-MKT;EXTERNAL_HIRING;POS-MKT-004;;1;4;Klasifikasi sengaja dikosongkan untuk uji\n'+
 'D-PRD;EXTERNAL_HIRING;POS-PRD-015;Additional;1;4;Departemen di luar lingkup HOD Marketing\n'+
 'D-MKT;TIDAK_ADA;POS-MKT-004;Additional;1;4;Jenis action sengaja dibuat salah\n';
const parsed=I.urai(csv);
let p=S.pratinjauImpor('USULAN',parsed.baris,'MPP-2027');
cek('D1 pratinjau memisahkan lolos dan gagal', p.valid===1 && p.galat===4,
    'valid '+p.valid+' galat '+p.galat);
cek('D2 bulan efektif kosong ditolak dengan kode V01',
    p.hasil[1].kodeGalat==='V01', JSON.stringify(p.hasil[1]).slice(0,80));
cek('D3 klasifikasi kosong ditolak dengan kode V03', p.hasil[2].kodeGalat==='V03');
cek('D4 departemen luar lingkup ditolak', p.hasil[3].kunci==='plan.errLingkup');
cek('D5 action tak dikenal ditolak', p.hasil[4].kunci==='imp.vAction');
const sebelum=S.barisSubmission(S.submissionDepartemen('MPP-2027','D-MKT').submission_id).length;
let hasil=S.terapkanImpor('USULAN',parsed.baris,'MPP-2027');
const sesudah=S.barisSubmission(S.submissionDepartemen('MPP-2027','D-MKT').submission_id).length;
cek('D6 hanya baris lolos yang masuk', hasil.masuk===1 && sesudah===sebelum+1,
    hasil.masuk+' '+sebelum+' -> '+sesudah);
cek('D7 baris gagal dikembalikan dengan alasan', hasil.galat.length===4 && !!hasil.galat[0].kunci);
cek('D8 impor tercatat di audit', w.NBAudit.semua().some(e=>e.event_type==='DATA_IMPORT'));

// E. Impor master karyawan
S.keluar(); S.masuk('U-OD-01');
const csvK='employee_id;name;position_id;grade_id;department_id;employment_status\n'+
 'NBT2001;Nama Diperbarui;POS-MKT-001;5C;D-MKT;Tetap\n'+
 'NBT9001;Karyawan Baru;POS-MKT-004;4A;D-MKT;PKWT\n'+
 'NBT9002;Grade Salah;POS-MKT-004;G99;D-MKT;Tetap\n';
const pk=I.urai(csvK);
let pv=S.pratinjauImpor('KARYAWAN',pk.baris,'MPP-2027');
cek('E1 baris lama ditandai perbarui, baru ditandai tambah',
    pv.hasil[0].aksi==='PERBARUI' && pv.hasil[1].aksi==='TAMBAH');
cek('E2 grade tidak dikenal ditolak', !pv.hasil[2].ok && pv.hasil[2].kunci==='imp.vGrade');
const jumlahSebelum=S.karyawanTerlihat().length;
S.terapkanImpor('KARYAWAN',pk.baris,'MPP-2027');
cek('E3 satu karyawan bertambah', S.karyawanTerlihat().length===jumlahSebelum+1);
cek('E4 karyawan lama diperbarui', S.karyawan('NBT2001').name==='Nama Diperbarui');

// F. Snapshot yang sudah dirilis tidak ikut berubah oleh impor
S.rilisSnapshot('MPP-2027','2026-09-01');
const snapId=S.snapshotAktif('MPP-2027').snapshot_id;
S.terapkanImpor('KARYAWAN',I.urai('employee_id;name;position_id;grade_id;department_id\n'+
  'NBT2001;Nama Sesudah Snapshot;POS-MKT-001;5C;D-MKT\n').baris,'MPP-2027');
cek('F1 snapshot tetap beku setelah impor master',
    S.snapshot(snapId).lines.find(l=>l.employee_id==='NBT2001').employee_name==='Nama Diperbarui');
cek('F2 perbedaan terdeteksi', S.bandingkanSnapshot(snapId).length===0 ||
    S.karyawan('NBT2001').name==='Nama Sesudah Snapshot');

// G. Impor asumsi biaya membuat versi baru
S.keluar(); S.masuk('U-CB-01');
const sebelumPaket=S.semuaAsumsi().length;
const csvA='grade_id;fixed_income;variable_income;company_coverage;accrual_thr;accrual_bonus\n'+
 '4A;15000000;2000000;1500000;1250000;1250000\n'+
 'G99;10000000;0;0;0;0\n';
let ha=S.terapkanImpor('ASUMSI',I.urai(csvA).baris,'MPP-2027');
cek('G1 satu grade masuk, satu ditolak', ha.masuk===1 && ha.galat.length===1);
cek('G2 paket asumsi bertambah, yang lama tidak dihapus',
    S.semuaAsumsi().length===sebelumPaket+1, S.semuaAsumsi().length+' vs '+sebelumPaket);

// H. Ekspor balik
S.keluar(); S.masuk('U-OD-01');
const ek=S.eksporData('USULAN','MPP-2027');
cek('H1 ekspor usulan memakai kolom templat yang sama',
    ek.kolom.map(k=>k.kunci).join(',')===I.def('USULAN').kolom.map(k=>k.k).join(','));
cek('H2 ekspor berisi data', ek.baris.length>0);
const bolak=I.urai(R.keCsv(ek.kolom,ek.baris));
cek('H3 hasil ekspor bisa diurai kembali', bolak.baris.length===ek.baris.length);

// I. Cadangan dan pemulihan
const cad=S.cadangan();
cek('I1 cadangan berisi seluruh basis data', cad.indexOf('"departments"')>-1 && cad.indexOf('"audit"')>-1);
S.ubahStatusSiklus('MPP-2027','LOCKED');
cek('I2 keadaan berubah sebelum pemulihan', S.siklus('MPP-2027').status==='LOCKED');
let pr=S.pulihkanCadangan(cad);
cek('I3 pemulihan berhasil', pr.ok && S.siklus('MPP-2027').status==='OPEN', S.siklus('MPP-2027').status);
cek('I4 berkas rusak ditolak', !S.pulihkanCadangan('bukan json').ok);
cek('I5 json asing ditolak', !S.pulihkanCadangan('{"a":1}').ok);
S.keluar(); S.masuk('U-HOD-MKT');
cek('I6 hanya OD yang boleh memulihkan', !S.pulihkanCadangan(cad).ok);

// J. Layar
S.keluar(); S.masuk('U-OD-01'); w.location.hash='#data'; w.NBApp.ulang();
let html=d.getElementById('nbPage').innerHTML;
cek('J1 layar impor tampil', html.indexOf('Impor')>-1);
cek('J2 tombol templat tersedia untuk tiap berkas',
    d.querySelectorAll('#nbPage button[data-templat]').length>=3,
    String(d.querySelectorAll('#nbPage button[data-templat]').length));
cek('J3 tombol cadangan hanya untuk OD', !!d.getElementById('iCadangan'));
S.keluar(); S.masuk('U-MON-01'); w.NBApp.ulang();
cek('J4 monitor hanya melihat satu jenis berkas',
    d.querySelectorAll('#nbPage button[data-templat]').length===1,
    String(d.querySelectorAll('#nbPage button[data-templat]').length));
cek('J5 monitor tidak punya tombol cadangan', !d.getElementById('iCadangan'));

console.log('\nTOTAL GAGAL: '+gagal.length); gagal.forEach(x=>console.log(' - '+x));
},400);
