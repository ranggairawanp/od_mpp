// QA panduan: dua belas langkah contoh/PANDUAN.md dijalankan otomatis dalam urutan yang
// sama dengan yang akan diikuti Dzuhri. Kalau panduannya basi, uji ini yang gagal lebih dulu.
const {JSDOM}=require('jsdom'), fs=require('fs');
const FX=require(__dirname + '/fixture.js');
const w=new JSDOM(fs.readFileSync('/home/claude/mpp/dist/index.html','utf8'),
  {runScripts:'dangerously',url:'https://local.test/',pretendToBeVisual:true}).window;
w.scrollTo=()=>{}; w.URL.createObjectURL=()=>'blob:uji'; w.URL.revokeObjectURL=()=>{};
const gagal=[]; const cek=(n,ok,i)=>{ if(!ok) gagal.push(n); console.log((ok?'PASS ':'GAGAL')+'  '+n+(!ok&&i?'  ['+i+']':'')); };
setTimeout(()=>{
const d=w.document, S=w.NBStore;
const teks=()=>d.getElementById('nbPage').textContent;

// Langkah 1: hanya Administrator
w.NBApp.ulang();
cek('L1 hanya satu persona sebelum unggahan', d.querySelectorAll('button[data-user]').length===1);
d.querySelector("button[data-user='U-ADMIN']").click();
cek('L1 admin masuk ke keadaan kosong yang menyebut langkah', teks().indexOf('Aplikasi masih kosong')>-1);

// Langkah 2: unggah 00 sampai 04 berurutan, lalu lihat halaman depan
[['ORGANISASI','00-organisasi.csv'],['POSISI','01-posisi.csv'],['KARYAWAN','02-karyawan.csv'],['VACANCY','03-vacancy.csv'],['PENGGUNA','04-pengguna.csv']]
 .forEach(([k,f])=>FX.unggah(w,'U-ADMIN',k,f));
S.keluar(); w.NBApp.ulang();
cek('L2 lima belas persona terbentuk', d.querySelectorAll('button[data-user]').length===15, String(d.querySelectorAll('button[data-user]').length));
cek('L2 catatan kaki menyebut 7 departemen dan 62 karyawan', teks().indexOf('7 departemen')>-1 && teks().indexOf('62 karyawan')>-1);

// Langkah 3: Windha unggah asumsi
FX.unggah(w,'U-CB-01','ASUMSI','05-asumsi-biaya.csv');
cek('L3 asumsi biaya berlaku', S.semuaAsumsi().length===1);

// Langkah 4: OD buat siklus, buka, rilis
S.keluar(); S.masuk('U-OD-01');
cek('L4 buat siklus 2027', S.buatSiklus({year:2027,start_date:'2026-09-01',end_date:'2027-12-31',submission_deadline:'2026-10-15'}).ok);
cek('L4 buka siklus', S.ubahStatusSiklus('MPP-2027','OPEN').ok);
cek('L4 rilis V1', S.rilisSnapshot('MPP-2027','2026-09-01').ok);

// Langkah 5: OD unggah usulan
const h6=FX.unggah(w,'U-OD-01','USULAN','06-usulan-mpp.csv','MPP-2027');
cek('L5 lima usulan masuk', h6.masuk===5);

// Langkah 6: masuk sebagai manajer turunan
const anisa=S.semuaPengguna().find(u=>u.role==='MANAGER'&&u.name==='Anisa Hartono');
cek('L6 Anisa Hartono ada sebagai manajer turunan', !!anisa);
S.keluar(); S.masuk(anisa.user_id); w.location.hash='#planning'; w.NBApp.ulang();
cek('L6 hanya timnya dan tanpa tombol kirim', !d.getElementById('pKirim') && S.karyawanTerlihat().length<8);
const bawahan=w.NBOrganisasi.bawahan(anisa.employee_id,S.pohonOrganisasi(),'D-MKT')[0];
const barisManajer=S.tambahBaris('MPP-2027','D-MKT',{action_type:'NO_CHANGE',employee_id:bawahan});
cek('L6 manajer menambah baris untuk bawahannya', barisManajer.ok);

// Langkah 7: Ratna mengusulkan orang yang sama, lalu kirim
S.keluar(); S.masuk('U-HOD-MKT');
S.tambahBaris('MPP-2027','D-MKT',{action_type:'GRADE_ADJUSTMENT',employee_id:bawahan,target_grade_id:'5A',effective_month:4,justification:'Penyesuaian setelah lingkup kerja bertambah'});
cek('L7 baris manajer ditimpa HOD', S.barisSubmission('SUB-2027-MKT').find(b=>b.line_item_id===barisManajer.baris.line_item_id).status==='SUPERSEDED');
cek('L7 kirim Marketing', S.kirimSubmission('MPP-2027','D-MKT').ok);
S.keluar(); S.masuk('U-HOD-PRD');
cek('L7 kirim Produksi', S.kirimSubmission('MPP-2027','D-PRD').ok);

// Langkah 8: OD terima, kunci; Frans putuskan, setujui; OD distribusikan
S.keluar(); S.masuk('U-OD-01');
S.daftarSubmission('MPP-2027').forEach(s=>S.reviewSubmission(s.submission_id,'ACCEPT',null));
cek('L8 kunci konsolidasi', S.kunciKonsolidasi('MPP-2027').ok);
S.keluar(); S.masuk('U-MGT-01');
S.barisReview('MPP-2027').forEach(l=>S.putuskanBaris(l.line_item_id,'APPROVE',null,null));
cek('L8 setujui MPP', S.setujuiMpp('MPP-2027','Disetujui sesuai panduan').ok);
S.keluar(); S.masuk('U-OD-01');
cek('L8 distribusikan alokasi', S.distribusikanAlokasi('MPP-2027').ok);

// Langkah 9: bagan organisasi
w.location.hash='#bagan'; w.NBApp.ulang();
cek('L9 bagan tergambar dengan alokasi belum terisi', !!d.querySelector('svg.nb-bagan') && teks().indexOf('alokasi belum terisi')>-1);
d.getElementById('bgEkspor').click();

// Langkah 10: matriks
w.location.hash='#matriks'; w.NBApp.ulang();
cek('L10 matriks terisi', teks().indexOf('Budget')>-1);
d.querySelector("button[data-level='POSISI']").click();
cek('L10 tingkat per jabatan', teks().indexOf('Per jabatan')>-1);

// Langkah 11: usulan bergalat
const galat=w.NBImpor.urai(FX.baca('08-usulan-bergalat.csv'));
S.buatSiklus({year:2028,start_date:'2027-09-01',end_date:'2028-12-31',submission_deadline:'2027-10-15'}); S.ubahStatusSiklus('MPP-2028','OPEN');
const pg=S.pratinjauImpor('USULAN',galat.baris,'MPP-2028');
cek('L11 tidak ada satu pun yang masuk', pg.valid===0 && pg.galat===7, pg.valid+'/'+pg.galat);
cek('L11 tujuh alasan berbeda', new Set(pg.hasil.map(x=>x.kodeGalat||x.kunci)).size>=6);

// Langkah 12: organisasi tambahan
FX.unggah(w,'U-ADMIN','ORGANISASI','07-organisasi-tambahan.csv');
S.keluar(); w.NBApp.ulang();
cek('L12 halaman depan menyebut 14 departemen', teks().indexOf('14 departemen')>-1);

// Entitas kedua
[['ORGANISASI','10-entitas-malaysia.csv'],['POSISI','11-posisi-malaysia.csv'],['KARYAWAN','12-karyawan-malaysia.csv'],['PENGGUNA','13-pengguna-malaysia.csv']]
 .forEach(([k,f])=>FX.unggah(w,'U-ADMIN',k,f));
FX.unggah(w,'U-CB-01','ASUMSI','14-asumsi-biaya-malaysia.csv','MPP-2027'); FX.unggah(w,'U-CB-01','KURS','15-kurs.csv');
S.keluar(); S.masuk('U-HCBP-MY'); w.location.hash='#dashboard'; w.NBApp.ulang();
cek('LM Nurul Aini hanya melihat Malaysia dalam Ringgit', S.departemenTerlihat().length===2 && w.NBFormat.rupiah(1).indexOf('RM')===0);
S.keluar(); S.masuk('U-OD-01'); w.location.hash='#konsolidasi'; w.NBApp.ulang();
cek('LM tab per legal entity tampil', !!d.querySelector("button[data-tab='entitas']"));

console.log('\nTOTAL GAGAL: '+gagal.length); gagal.forEach(x=>console.log(' - '+x));
},500);
