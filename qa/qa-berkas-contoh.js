// QA berkas contoh: seluruh berkas di folder contoh harus terunggah bersih ke aplikasi
// kosong lewat jalur yang sama dengan yang dipakai pengguna, sampai matriks bulanan terisi.
const {JSDOM}=require('jsdom'), fs=require('fs');
const FX=require(__dirname + '/fixture.js');
const w=new JSDOM(fs.readFileSync('/home/claude/mpp/dist/index.html','utf8'),
  {runScripts:'dangerously',url:'https://local.test/',pretendToBeVisual:true}).window;
w.scrollTo=()=>{};
const gagal=[]; const cek=(n,ok,i)=>{ if(!ok) gagal.push(n); console.log((ok?'PASS ':'GAGAL')+'  '+n+(!ok&&i?'  ['+i+']':'')); };
setTimeout(()=>{
const S=w.NBStore, I=w.NBImpor;

// A. Aplikasi benar-benar kosong
cek('A1 tidak ada karyawan bawaan', S.jumlahData().karyawan===0);
cek('A2 tidak ada departemen bawaan', S.jumlahData().departemen===0);
cek('A3 tidak ada siklus bawaan', S.semuaSiklus().length===0);
cek('A4 hanya akun admin', S.semuaPengguna().length===1 && S.semuaPengguna()[0].user_id==='U-ADMIN');
cek('A5 delapan belas grade tertanam sebagai struktur', S.semuaGrade().length===18);
S.masuk('U-ADMIN');
cek('A6 admin hanya boleh mengunggah struktur dan pengguna',
    S.bolehImpor('ORGANISASI').ok && S.bolehImpor('KARYAWAN').ok && !S.bolehImpor('USULAN').ok && !S.bolehImpor('ASUMSI').ok);

// B. Setiap berkas contoh terunggah bersih
[['U-ADMIN','ORGANISASI','00-organisasi.csv',7],['U-ADMIN','POSISI','01-posisi.csv',32],
 ['U-ADMIN','KARYAWAN','02-karyawan.csv',62],['U-ADMIN','VACANCY','03-vacancy.csv',6],
 ['U-ADMIN','PENGGUNA','04-pengguna.csv',7]].forEach(([u,k,f,n])=>{
  const h=FX.unggah(w,u,k,f); cek('B '+f+' masuk '+n+' baris', h.masuk===n, String(h.masuk)); });
let h=FX.unggah(w,'U-CB-01','ASUMSI','05-asumsi-biaya.csv');
cek('B 05-asumsi-biaya.csv masuk 18 grade', h.masuk===18, String(h.masuk));

// C. Turunan dari pohon
const pengguna=S.semuaPengguna();
cek('C1 tujuh HOD diturunkan dari pohon', pengguna.filter(u=>u.role==='HOD').length===7);
cek('C2 tiga manajer 5A ke atas diturunkan', pengguna.filter(u=>u.role==='MANAGER').length===3,
    pengguna.filter(u=>u.role==='MANAGER').map(u=>u.user_id).join(','));
cek('C3 HOD dari berkas pengguna memakai nama dari berkas',
    pengguna.find(u=>u.user_id==='U-HOD-MKT').name==='Ratna Puspita');
cek('C4 HOD tanpa baris pengguna mendapat identitas turunan',
    /^EMP-/.test(pengguna.find(u=>u.role==='HOD'&&u.scope.department_id==='D-QAS').user_id));

// D. Alur penuh sampai matriks
FX.siklus(w); FX.usulan(w);
S.masuk('U-OD-01'); S.rilisSnapshot('MPP-2027','2026-09-01');
cek('D1 lima baris usulan masuk', S.barisSiklusTerlihat('MPP-2027').length===5);
['D-MKT','D-PRD'].forEach(dep=>S.kirimSubmission('MPP-2027',dep));
S.daftarSubmission('MPP-2027').forEach(s=>S.reviewSubmission(s.submission_id,'ACCEPT',null));
cek('D2 konsolidasi bisa dikunci', S.kunciKonsolidasi('MPP-2027').ok);
S.keluar(); S.masuk('U-MGT-01');
S.barisReview('MPP-2027').forEach(l=>S.putuskanBaris(l.line_item_id,'APPROVE',null,null));
cek('D3 manajemen bisa menyetujui', S.setujuiMpp('MPP-2027','Disetujui untuk uji berkas contoh').ok);
S.keluar(); S.masuk('U-OD-01');
cek('D4 alokasi bisa dibagikan', S.distribusikanAlokasi('MPP-2027').ok);
const mx=S.matriksBulanan('MPP-2027',{mode:'HC',level:'DEPT'});
cek('D5 matriks bulanan terisi', mx.baris.length===7 && mx.total.budget[11]>0, mx.baris.length+' '+mx.total.budget[11]);

// E. Berkas tambahan
h=FX.unggah(w,'U-ADMIN','ORGANISASI','07-organisasi-tambahan.csv');
cek('E1 tujuh departemen tambahan masuk', h.masuk===7 && S.semuaDepartemen().length===14);

// F. Galat yang disengaja tetap ditolak, diuji pada siklus baru yang masih terbuka
S.keluar(); S.masuk('U-OD-01');
S.buatSiklus({year:2028,start_date:'2027-09-01',end_date:'2028-12-31',submission_deadline:'2027-10-15'});
S.ubahStatusSiklus('MPP-2028','OPEN');
const galat=I.urai(fs.readFileSync('/home/claude/mpp/contoh/08-usulan-bergalat.csv','utf8'));
const p=S.pratinjauImpor('USULAN',galat.baris,'MPP-2028');
cek('F1 seluruh baris bergalat ditolak', p.valid===0 && p.galat===galat.baris.length, 'valid '+p.valid+' galat '+p.galat);
cek('F2 alasan penolakan berbeda-beda', new Set(p.hasil.map(x=>x.kodeGalat||x.kunci)).size>=5,
    p.hasil.map(x=>x.kodeGalat||x.kunci).join(','));

console.log('\nTOTAL GAGAL: '+gagal.length); gagal.forEach(x=>console.log(' - '+x));
},500);
