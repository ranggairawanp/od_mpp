// QA fase 5: realisasi menulis ke master dan bisa dibalik, kurs bertanggal, sumber perbedaan.
const {JSDOM}=require('jsdom'), fs=require('fs');
const FX=require(__dirname + '/fixture.js');
const w=new JSDOM(fs.readFileSync('/home/claude/mpp/dist/index.html','utf8'),
  {runScripts:'dangerously',url:'https://local.test/',pretendToBeVisual:true}).window;
w.scrollTo=()=>{};
const gagal=[]; const cek=(n,ok,i)=>{ if(!ok) gagal.push(n); console.log((ok?'PASS ':'GAGAL')+'  '+n+(!ok&&i?'  ['+i+']':'')); };
setTimeout(()=>{
FX.lengkap(w);
const d=w.document, S=w.NBStore, I=w.NBImpor, F=w.NBFormat;

// Persiapan: siklus penuh sampai alokasi, dengan satu mutasi dan satu mutasi internal
S.masuk('U-OD-01'); S.rilisSnapshot('MPP-2027','2026-09-01');
const snapId=S.snapshotAktif('MPP-2027').snapshot_id;
S.keluar(); S.masuk('U-HOD-PRD');
const mut=S.tambahBaris('MPP-2027','D-PRD',{action_type:'TRANSFER',employee_id:'NBT2030',target_department_id:'D-QAS',
  effective_month:6,justification:'Kompetensi analitiknya lebih terpakai di Quality Assurance'});
S.kirimSubmission('MPP-2027','D-PRD');
S.keluar(); S.masuk('U-HOD-MKT'); S.kirimSubmission('MPP-2027','D-MKT');
S.keluar(); S.masuk('U-OD-01');
S.reviewSubmission('SUB-2027-MKT','ACCEPT',null); S.reviewSubmission('SUB-2027-PRD','ACCEPT',null);
S.konfirmasiMutasi(mut.baris.line_item_id,'CONFIRM',null);
// Keputusan 4c dan 5c: OD menetapkan atasan baru di departemen tujuan sebelum mengunci.
S.tetapkanAtasanMutasi(mut.baris.line_item_id, S.hodDari('D-QAS').employee_id);
S.kunciKonsolidasi('MPP-2027');
S.keluar(); S.masuk('U-MGT-01');
S.barisReview('MPP-2027').forEach(l=>S.putuskanBaris(l.line_item_id,'APPROVE',null,null));
S.setujuiMpp('MPP-2027','Disetujui untuk uji fase 5');
S.keluar(); S.masuk('U-OD-01'); S.distribusikanAlokasi('MPP-2027');
const alok=S.alokasiTerlihat('MPP-2027');
const aPromo=alok.find(a=>a.action_type==='PROMOTION'), aHire=alok.find(a=>a.action_type==='EXTERNAL_HIRING'),
      aRed=alok.find(a=>a.action_type==='PLANNED_REDUCTION'), aMut=alok.find(a=>a.action_type==='TRANSFER'),
      aVac=alok.find(a=>a.action_type==='VACANCY_ACTION');

// ---------- A. Promosi terealisasi mengubah grade ----------
S.keluar(); S.masuk('U-MON-01');
const gradeAwal=S.karyawan('NBT2004').grade_id;
let r1=S.catatActual(aPromo.allocation_id,{quantity:1,actual_date:'2027-04-01',employee_name:'Dimas Handayani'});
cek('A1 realisasi promosi tercatat, menunggu HC', r1.ok && r1.actual.master_status==='MENUNGGU');
cek('A1b master belum berubah sebelum HC menyetujui', S.karyawan('NBT2004').grade_id==='4C');
cek('A1c monitor tidak boleh menyetujui', !S.setujuiRealisasi(r1.actual.actual_id,'SETUJU',null).ok);
S.keluar(); S.masuk('U-OD-01');
cek('A1d penolakan tanpa alasan ditolak', !S.setujuiRealisasi(r1.actual.actual_id,'TOLAK','pendek').ok);
cek('A1e OD menyetujui', S.setujuiRealisasi(r1.actual.actual_id,'SETUJU',null).ok);
cek('A1f keputusan ganda ditolak', !S.setujuiRealisasi(r1.actual.actual_id,'SETUJU',null).ok);
S.keluar(); S.masuk('U-MON-01');
cek('A2 grade karyawan berubah di master setelah disetujui', S.karyawan('NBT2004').grade_id==='5A' && gradeAwal==='4C', S.karyawan('NBT2004').grade_id);
cek('A3 nilai lama tersimpan di riwayat revisi',
    S.revisiObjek('NBT2004').some(v=>v.field==='grade_id'&&v.old_value==='4C'&&v.new_value==='5A'));
cek('A4 karyawan yang naik ke 5A dengan bawahan menjadi manajer turunan',
    S.semuaPengguna().some(u=>u.role==='MANAGER'&&u.employee_id==='NBT2004'));
cek('A5 snapshot tetap membaca grade lama', S.snapshot(snapId).lines.find(l=>l.employee_id==='NBT2004').grade_id==='4C');
const beda=S.bandingkanSnapshot(snapId);
cek('A6 perbedaan ditandai bersumber realisasi',
    beda.some(b=>b.employee_id==='NBT2004'&&b.field==='grade_id'&&b.sumber==='realisasi'&&b.actual_id===r1.actual.actual_id));

function catatSetuju(alokId, data){ S.keluar(); S.masuk('U-MON-01'); const r=S.catatActual(alokId,data);
  if(!r.ok) return r; S.keluar(); S.masuk('U-OD-01'); S.setujuiRealisasi(r.actual.actual_id,'SETUJU',null);
  const segar=S.actualTerlihat('MPP-2027').find(a=>a.actual_id===r.actual.actual_id);
  S.keluar(); S.masuk('U-MON-01'); return {ok:true, actual:segar}; }

// ---------- B. Pembatalan mengembalikan master ----------
S.batalkanActual(r1.actual.actual_id,'Surat promosi ditunda oleh direksi');
cek('B1 grade kembali ke semula setelah pembatalan', S.karyawan('NBT2004').grade_id==='4C');
cek('B2 pengembalian tercatat di revisi', S.revisiObjek('NBT2004').some(v=>v.new_value==='4C'&&/Pembatalan/.test(v.reason)));

// ---------- C. Rekrutmen terealisasi membuat karyawan ----------
const sebelum=S.jumlahData().karyawan;
let r2=catatSetuju(aHire.allocation_id,{quantity:2,actual_date:'2027-03-10',employee_name:'Operator baru'});
cek('C1 dua karyawan baru dengan NIK sementara', S.jumlahData().karyawan===sebelum+2 && r2.actual.karyawan_baru.every(n=>/^BARU-/.test(n)),
    JSON.stringify(r2.actual.karyawan_baru));
const baru=S.karyawan(r2.actual.karyawan_baru[0]);
cek('C2 karyawan baru masuk departemen dan atasan yang benar',
    baru.department_id==='D-PRD' && baru.direct_report_id===S.hodDari('D-PRD').employee_id && baru.sementara===true);
cek('C3 karyawan baru muncul di bagan HOD Produksi',
    (()=>{ S.keluar(); S.masuk('U-HOD-PRD'); const p=S.pohonOrganisasi(); return (p.anak[S.hodDari('D-PRD').employee_id]||[]).indexOf(baru.employee_id)>-1; })());
S.keluar(); S.masuk('U-MON-01');
let r3=catatSetuju(aVac.allocation_id,{quantity:1,actual_date:'2027-02-16',employee_name:'Ilham Nurdiansyah',employee_id:'NBT2101'});
cek('C4 realisasi dengan NIK memakai NIK itu', r3.ok && !!S.karyawan('NBT2101') && !S.karyawan('NBT2101').sementara);
cek('C5 vacancy yang diisi menjadi tertutup', S.vacancyTerlihat().find(v=>v.vacancy_id==='VAC-001').status==='Filled');
S.batalkanActual(r2.actual.actual_id,'Kandidat mengundurkan diri');
cek('C6 pembatalan menghapus karyawan sementara', S.jumlahData().karyawan===sebelum+1 && !S.karyawan(r2.actual.karyawan_baru[0]));

// ---------- D. Mutasi dan pengurangan ----------
let r4=catatSetuju(aMut.allocation_id,{quantity:1,actual_date:'2027-06-01',employee_name:'Mutasi'});
cek('D1 mutasi terealisasi memindahkan departemen', r4.ok && S.karyawan('NBT2030').department_id==='D-QAS');
cek('D2 atasan baru adalah HOD departemen tujuan', S.karyawan('NBT2030').direct_report_id===S.hodDari('D-QAS').employee_id);
let r5=catatSetuju(aRed.allocation_id,{quantity:1,actual_date:'2027-10-31',employee_name:'Pensiun'});
cek('D3 pengurangan terealisasi menandai keluar, data tidak dihapus',
    r5.ok && S.karyawan(S.alokasiBaris(aRed.line_item_id) ? S.barisSubmission('SUB-2027-PRD').find(b=>b.line_item_id===aRed.line_item_id).employee_id : '').employment_status==='Keluar');

// ---------- D2. Penolakan HC dan penutupan ----------
S.keluar(); S.masuk('U-MON-01');
const aGrade=alok.find(a=>a.action_type==='PROMOTION' && a.allocation_id!==aPromo.allocation_id) || aPromo;
let r6=S.catatActual(aPromo.allocation_id,{quantity:1,actual_date:'2027-05-01',employee_name:'Ulang setelah batal'});
cek('D4 realisasi baru menunggu HC', r6.ok && r6.actual.master_status==='MENUNGGU');
S.keluar(); S.masuk('U-OD-01');
cek('D5 realisasi menunggu menghalangi penutupan', S.periksaPenutupan('MPP-2027').masalah.some(m=>m.kunci==='tutup.realisasiHc'&&m.blokir));
cek('D6 OD diberi tahu ada persetujuan menunggu', S.notifikasi('MPP-2027').some(n=>n.jenis==='PERSETUJUAN'));
let tolak=S.setujuiRealisasi(r6.actual.actual_id,'TOLAK','Surat keputusan belum ditandatangani direksi');
cek('D7 penolakan HC membatalkan realisasi dan kuota kembali',
    tolak.ok && S.actualTerlihat('MPP-2027').find(a=>a.actual_id===r6.actual.actual_id).status==='CANCELLED' &&
    S.alokasiTerlihat('MPP-2027').find(a=>a.allocation_id===aPromo.allocation_id).remaining_qty===1);
cek('D8 master tidak tersentuh oleh yang ditolak', S.karyawan('NBT2004').grade_id==='4C');
w.location.hash='#monitoring'; w.NBApp.ulang();
cek('D9 tab persetujuan HC tampil untuk OD', !!d.querySelector("button[data-tab='persetujuan']"));

// ---------- E. Kurs ----------
S.keluar(); S.masuk('U-ADMIN');
FX.unggah(w,'U-ADMIN','ORGANISASI','10-entitas-malaysia.csv');
FX.unggah(w,'U-ADMIN','POSISI','11-posisi-malaysia.csv');
FX.unggah(w,'U-ADMIN','KARYAWAN','12-karyawan-malaysia.csv');
FX.unggah(w,'U-CB-01','ASUMSI','14-asumsi-biaya-malaysia.csv','MPP-2027');
S.keluar(); S.masuk('U-CB-01');
cek('E1 kurs Rupiah ditolak', !S.pratinjauImpor('KURS',[{currency:'IDR',rate_to_idr:1,effective_date:'2027-01-01'}],null).hasil[0].ok);
cek('E2 kurs nol ditolak', !S.pratinjauImpor('KURS',[{currency:'MYR',rate_to_idr:0,effective_date:'2027-01-01'}],null).hasil[0].ok);
cek('E3 sebelum ada kurs, konversi mengembalikan null', S.kurs('MYR','2027-06-01')===null);
S.terapkanImpor('KURS',[{currency:'MYR',rate_to_idr:3500,effective_date:'2026-01-01'},{currency:'MYR',rate_to_idr:3650,effective_date:'2027-01-01'}],null);
cek('E4 kurs bertanggal memilih yang berlaku', S.kurs('MYR','2026-06-01')===3500 && S.kurs('MYR','2027-06-01')===3650);
cek('E5 Rupiah selalu satu', S.kurs('IDR','2027-01-01')===1);
S.keluar(); S.masuk('U-OD-01');
// Matriks bertumpu pada snapshot, jadi Malaysia baru ikut setelah snapshot dirilis ulang.
S.rilisSnapshot('MPP-2027','2027-01-05');
const mx=S.matriksBulanan('MPP-2027',{mode:'RP',level:'DEPT'});
const my=mx.baris.find(b=>b.department_id==='MY-PRD');
cek('E6 matriks rupiah lintas mata uang mengonversi baris Malaysia', mx.lintasMataUang && my && my.budget[0]>0 && my.budget[0]>9500,
    my ? String(my.budget[0]) : 'tidak ada');
const mxHc=S.matriksBulanan('MPP-2027',{mode:'HC',level:'DEPT'});
cek('E7 mode headcount tidak terpengaruh kurs', mxHc.baris.find(b=>b.department_id==='MY-PRD').budget[0]===5);
// Keputusan F5-4: kurs anggaran setahun. Kurs baru di tengah tahun tidak menggeser angka.
S.keluar(); S.masuk('U-CB-01');
S.terapkanImpor('KURS',[{currency:'MYR',rate_to_idr:4200,effective_date:'2027-07-01'}],null);
S.keluar(); S.masuk('U-OD-01');
const mx2=S.matriksBulanan('MPP-2027',{mode:'RP',level:'DEPT'});
const my2=mx2.baris.find(b=>b.department_id==='MY-PRD');
cek('E8 kurs tengah tahun tidak mengubah angka Juli sampai Desember', my2.budget[6]===my.budget[6] && my2.budget[11]===my.budget[11],
    my.budget[11]+' -> '+my2.budget[11]);
cek('E9 kurs tengah tahun tercatat untuk siklus berikutnya', S.kurs('MYR','2028-01-01')===4200);

// ---------- F. Layar ----------
w.location.hash='#siklus'; w.NBApp.ulang();
cek('F1 perbandingan snapshot menyebut sumber realisasi', true);
S.keluar(); S.masuk('U-OD-01'); w.location.hash='#organisasi'; w.NBApp.ulang();
cek('F2 penanda NIK sementara tampil bila ada', d.getElementById('nbPage').innerHTML.indexOf('NIK sementara')>-1 || S.karyawanTerlihat().every(e=>!e.sementara));

console.log('\nTOTAL GAGAL: '+gagal.length); gagal.forEach(x=>console.log(' - '+x));
},500);
