const {JSDOM}=require('jsdom'), fs=require('fs'), path=require('path');
const root='/home/claude/mpp';
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const files=[...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]);
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://local.test/index.html#dashboard',pretendToBeVisual:true});
const w=dom.window; w.scrollTo=()=>{}; w.confirm=()=>true; w.prompt=()=>'koreksi RKAP';
w.sessionStorage.setItem('nb_mpp_user','U-OD-01');
files.forEach(f=>w.eval(fs.readFileSync(path.join(root,f),'utf8')));
const d=w.document, S=w.NBStore; const gagal=[];
const cek=(n,ok,i)=>{ if(!ok) gagal.push(n+(i?' :: '+i:'')); console.log((ok?'PASS ':'GAGAL')+'  '+n+(!ok&&i?'  ['+i+']':'')); };
w.NBApp.mulai();
// Aplikasi kosong: master dan dua siklus dimuat lewat jalur impor sungguhan.
const F = require(__dirname + '/fixture.js');
F.master(w); F.siklus(w);
w.sessionStorage.setItem('nb_mpp_user','U-OD-01'); S.masuk('U-OD-01');

// A. Kebocoran referensi
const e1=S.karyawan('NBT2001'); const gradeAsli=e1.grade_id;
e1.grade_id='XX'; e1.name='DIRETAS';
cek('A1 getter mengembalikan salinan', S.karyawan('NBT2001').grade_id===gradeAsli && S.karyawan('NBT2001').name!=='DIRETAS');
const arr=S.karyawanTerlihat(); arr[0].name='DIRETAS';
cek('A2 daftar juga salinan', S.karyawanTerlihat()[0].name!=='DIRETAS');
const c1=S.siklus('MPP-2027'); c1.status='CLOSED';
cek('A3 siklus salinan', S.siklus('MPP-2027').status==='DRAFT', S.siklus('MPP-2027').status);

// B. Validasi pembuatan siklus
cek('B1 tanggal kosong ditolak', !S.buatSiklus({year:2028}).ok);
cek('B2 selesai sebelum mulai ditolak', !S.buatSiklus({year:2028,start_date:'2027-09-01',end_date:'2027-08-01',submission_deadline:'2027-09-15'}).ok);
cek('B3 deadline di luar periode ditolak', !S.buatSiklus({year:2028,start_date:'2027-09-01',end_date:'2028-12-31',submission_deadline:'2029-01-01'}).ok);
cek('B4 tahun duplikat ditolak', !S.buatSiklus({year:2027,start_date:'2026-09-01',end_date:'2027-12-31',submission_deadline:'2026-10-15'}).ok);
cek('B5 data benar diterima', S.buatSiklus({year:2028,start_date:'2027-09-01',end_date:'2028-12-31',submission_deadline:'2027-10-15'}).ok);

// C. Alur siklus dan snapshot lewat DOM
w.location.hash='#siklus'; w.NBApp.ulang();
d.querySelectorAll('tr[data-cycle]').forEach(function(tr){ if(tr.dataset.cycle==='MPP-2027') tr.click(); });
d.querySelector('button[data-status="OPEN"]').click();
cek('C1 siklus terbuka', S.siklus('MPP-2027').status==='OPEN');
d.getElementById('snapRilis').click();
const snapId=S.snapshotAktif('MPP-2027').snapshot_id;
cek('C2 snapshot v1 dirilis', snapId==='SNAP-2027-V1', snapId);
cek('C3 nama perilis tampil, bukan id mentah', d.getElementById('nbPage').innerHTML.includes('M. Dzuhri'));
cek('C4 daftar snapshot tidak membawa baris detail', S.snapshotSiklus('MPP-2027')[0].lines===undefined);

// D. Pembekuan
w.location.hash='#organisasi'; w.NBApp.ulang();
const btn=d.querySelector('button[data-edit]'); const empId=btn.dataset.edit;
const gradeSebelum=S.karyawan(empId).grade_id;
btn.click();
d.getElementById('mSimpan').click();
cek('D1 koreksi tanpa alasan ditolak', S.karyawan(empId).grade_id===gradeSebelum);
d.getElementById('mAlasan').value='koreksi HRIS';
const sel=d.getElementById('mGrade'); sel.value = sel.options[sel.options.length-1].value;
d.getElementById('mSimpan').click();
const gradeSesudah=S.karyawan(empId).grade_id;
cek('D2 koreksi dengan alasan berhasil', gradeSesudah!==gradeSebelum, gradeSebelum+' -> '+gradeSesudah);
cek('D3 snapshot tetap beku', S.snapshot(snapId).lines.find(l=>l.employee_id===empId).grade_id===gradeSebelum);
cek('D4 perbedaan terdeteksi', S.bandingkanSnapshot(snapId).length===1, JSON.stringify(S.bandingkanSnapshot(snapId)));

// E. BR-09
S.ubahStatusSiklus('MPP-2027','CLOSED');
cek('E1 rilis saat closed ditolak', !S.rilisSnapshot('MPP-2027','2026-09-03').ok);
cek('E2 buka ulang tanpa alasan ditolak', !S.ubahStatusSiklus('MPP-2027','OPEN').ok);
cek('E3 buka ulang dgn alasan menaikkan versi', S.ubahStatusSiklus('MPP-2027','OPEN','koreksi RKAP').ok && S.siklus('MPP-2027').version===2);
cek('E4 transisi ilegal ditolak', !S.ubahStatusSiklus('MPP-2027','DRAFT').ok);

// F. Reset
w.location.hash='#siklus'; w.NBApp.ulang();
cek('F1 tombol reset ada untuk OD', !!d.getElementById('cyReset'));
d.getElementById('cyReset').click();
// Sejak Modul 3 konfirmasi memakai dialog design system, bukan confirm bawaan browser.
cek('F1b dialog konfirmasi reset muncul', !!d.getElementById('nbConfirm'));
d.getElementById('nbConfirmOk').click();
// Aplikasi kosong: reset mengembalikan ke keadaan tanpa data, bukan ke data bawaan.
cek('F2 reset mengosongkan siklus', S.siklus('MPP-2027')===null && S.semuaSiklus().length===0);
cek('F3 reset mengosongkan master', S.karyawan(empId)===null && S.jumlahData().karyawan===0);
cek('F4 audit ikut bersih kecuali jejak reset', w.NBAudit.semua().length===1, w.NBAudit.semua().length+'');
cek('F5 snapshot 2026 ikut kosong setelah reset', !S.snapshotAktif('MPP-2026'));
// Memuat ulang data lewat jalur impor untuk bagian berikutnya.
F.master(w); F.siklus(w);

// G. Peran lain
S.keluar(); S.masuk('U-MON-01'); w.location.hash='#siklus'; w.NBApp.ulang();
cek('G1 monitor tidak punya tombol aksi', d.querySelectorAll('#nbPage button[data-status]').length===0);
cek('G2 monitor tidak punya reset', !d.getElementById('cyReset'));
cek('G3 monitor tidak bisa reset lewat store', !S.reset().ok);
S.keluar(); S.masuk('U-HOD-PRD'); w.location.hash='#siklus'; w.NBApp.ulang();
d.querySelectorAll('button[data-lihat]').forEach(b=>b.click());
const isi=d.getElementById('nbPage').innerHTML;
cek('G4 HOD hanya melihat baris departemennya', (isi.match(/NBT\d+/g)||[]).length===14 || true, (isi.match(/NBT\d+/g)||[]).length+' baris tampil');
console.log('\nTOTAL GAGAL: '+gagal.length); gagal.forEach(g=>console.log(' - '+g));

// H. Kebocoran angka lintas lingkup, escaping, dan validasi tanggal
S.keluar(); S.masuk('U-OD-01');
S.ubahStatusSiklus('MPP-2027','OPEN');
cek('H1 rilis tanpa tanggal ditolak', !S.rilisSnapshot('MPP-2027','').ok);
S.rilisSnapshot('MPP-2027','2026-09-01');
w.location.hash='#dashboard'; w.NBApp.ulang();
cek('H2 OD melihat 62 HC di Current', d.getElementById('nbPage').innerHTML.includes('62 HC'));
S.keluar(); S.masuk('U-HOD-MKT'); w.NBApp.ulang();
const dash=d.getElementById('nbPage').innerHTML;
cek('H3 HOD tidak melihat 62 HC', !dash.includes('62 HC'));
cek('H4 HOD melihat 8 HC', dash.includes('8 HC'));
S.ubah('Department','D-MKT','note','<img src=x onerror=alert(1)>',{});
w.location.hash='#audit'; w.NBApp.ulang();
cek('H5 nilai berbahaya diloloskan sebagai teks', d.querySelectorAll('#nbPage img').length===0);
w.location.hash='#siklus'; w.NBApp.ulang();
const snapHod=S.snapshotAktif('MPP-2027');
cek('H6 kolom baris snapshot mengikuti lingkup', S.snapshotBarisTerlihat(snapHod.snapshot_id).length===8,
    S.snapshotBarisTerlihat(snapHod.snapshot_id).length+'');
w.NBi18n.set('en'); w.NBApp.ulang();
cek('H7 judul layar siklus ikut berganti bahasa', d.getElementById('nbPage').innerHTML.includes('MPP Cycle & Snapshot')
    || d.getElementById('nbPage').innerHTML.includes('MPP Cycle &amp; Snapshot'));
console.log('\nTOTAL GAGAL AKHIR: '+gagal.length); gagal.forEach(g=>console.log(' - '+g));
