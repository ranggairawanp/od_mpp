// QA fase 8: penanda versi, ringkasan eksekutif, cache HOD.
const {JSDOM}=require('jsdom'), fs=require('fs');
const FX=require(__dirname + '/fixture.js');
const w=new JSDOM(fs.readFileSync('/home/claude/mpp/dist/index.html','utf8'),
  {runScripts:'dangerously',url:'https://local.test/',pretendToBeVisual:true}).window;
w.scrollTo=()=>{};
const gagal=[]; const cek=(n,ok,i)=>{ if(!ok) gagal.push(n); console.log((ok?'PASS ':'GAGAL')+'  '+n+(!ok&&i?'  ['+i+']':'')); };
setTimeout(()=>{
const d=w.document, S=w.NBStore;

// A. Penanda versi
cek('A1 build tertanam di berkas gabungan', !!w.NB_BUILD && w.NB_BUILD.build>0 && /^\d{4}-\d{2}-\d{2}$/.test(w.NB_BUILD.tanggal));
w.NBApp.ulang();
cek('A2 halaman login menyebut build', d.getElementById('nbPage').textContent.indexOf('Build '+w.NB_BUILD.build)>-1);

FX.lengkap(w);
// B. Ringkasan eksekutif sebelum apa pun terjadi
S.masuk('U-MGT-01');
let e=S.ringkasanEksekutif('MPP-2027');
cek('B1 rantai: current dan proposed ada, approved dan actual belum', e.rantai.current>0 && e.rantai.approved===null && e.rantai.actual===null);
cek('B2 menunggu: tujuh departemen belum mengirim, draft belum dihitung kirim', e.menunggu.belumKirim===7, String(e.menunggu.belumKirim));
w.location.hash='#eksekutif'; w.NBApp.ulang();
cek('B3 layar tampil untuk manajemen', d.getElementById('nbPage').innerHTML.indexOf('Ringkasan Eksekutif')>-1);
cek('B4 nominal tampil untuk manajemen', /Rp[\d.]/.test(d.getElementById('nbPage').innerHTML));
S.keluar(); S.masuk('U-HOD-MKT'); w.location.hash='#eksekutif'; w.NBApp.ulang();
cek('B5 HOD dilempar dari ringkasan eksekutif', w.location.hash==='#dashboard');
S.keluar(); S.masuk('U-MON-01'); w.location.hash='#eksekutif'; w.NBApp.ulang();
cek('B6 monitor dilempar', w.location.hash==='#dashboard');

// C. Setelah siklus berjalan penuh
S.keluar(); S.masuk('U-OD-01'); S.rilisSnapshot('MPP-2027','2026-09-01');
S.keluar(); S.masuk('U-HOD-MKT'); S.kirimSubmission('MPP-2027','D-MKT');
S.keluar(); S.masuk('U-HOD-PRD'); S.kirimSubmission('MPP-2027','D-PRD');
S.keluar(); S.masuk('U-OD-01');
e=S.ringkasanEksekutif('MPP-2027');
cek('C1 menunggu review OD dua', e.menunggu.reviewOd===2);
S.reviewSubmission('SUB-2027-MKT','ACCEPT',null); S.reviewSubmission('SUB-2027-PRD','ACCEPT',null);
S.kunciKonsolidasi('MPP-2027');
S.keluar(); S.masuk('U-MGT-01');
e=S.ringkasanEksekutif('MPP-2027');
cek('C2 menunggu keputusan manajemen lima baris', e.menunggu.keputusan===5, String(e.menunggu.keputusan));
S.barisReview('MPP-2027').forEach(l=>S.putuskanBaris(l.line_item_id,'APPROVE',null,null));
S.setujuiMpp('MPP-2027','Uji fase 8');
e=S.ringkasanEksekutif('MPP-2027');
cek('C3 approved terbentuk dan distribusi menunggu', e.rantai.approved===e.rantai.proposed && e.menunggu.distribusi===1);
S.keluar(); S.masuk('U-OD-01'); S.distribusikanAlokasi('MPP-2027');
const hire=S.alokasiTerlihat('MPP-2027').find(a=>a.action_type==='EXTERNAL_HIRING');
S.keluar(); S.masuk('U-MON-01'); const r=S.catatActual(hire.allocation_id,{quantity:2,actual_date:'2027-03-10',employee_name:'Dua operator'});
S.keluar(); S.masuk('U-MGT-01');
e=S.ringkasanEksekutif('MPP-2027');
cek('C4 realisasi menunggu HC terbaca', e.menunggu.persetujuanHc===1);
S.keluar(); S.masuk('U-OD-01'); S.setujuiRealisasi(r.actual.actual_id,'SETUJU',null);
e=S.ringkasanEksekutif('MPP-2027');
cek('C5 actual terbentuk', e.rantai.actual===e.rantai.current+2, e.rantai.actual+' vs '+(e.rantai.current+2));
cek('C6 pergerakan terbesar bersumber alokasi', e.gerak.length>0 && e.gerak[0].sumber==='alokasi');
cek('C7 biaya ada tiga angka', e.biaya && e.biaya.usulan>0 && e.biaya.disetujui>0 && e.biaya.realisasi>0);
cek('C8 tidak ada yang menunggu selain departemen yang belum kirim', e.menunggu.reviewOd===0 && e.menunggu.keputusan===0 && e.menunggu.persetujuanHc===0);

// D. Cache HOD
const t0=Date.now(); for(let i=0;i<2000;i++) S.hodDari('D-MKT'); const ms=Date.now()-t0;
cek('D1 dua ribu panggilan hodDari di bawah 200 ms berkat cache', ms<200, ms+' ms');
FX.unggah(w,'U-ADMIN','ORGANISASI','10-entitas-malaysia.csv'); FX.unggah(w,'U-ADMIN','POSISI','11-posisi-malaysia.csv');
FX.unggah(w,'U-ADMIN','KARYAWAN','12-karyawan-malaysia.csv');
cek('D2 cache dibersihkan setelah data berubah', !!S.hodDari('MY-PRD') && S.hodDari('MY-PRD').employee_id==='MY001');

console.log('\nTOTAL GAGAL: '+gagal.length); gagal.forEach(x=>console.log(' - '+x));
},500);
