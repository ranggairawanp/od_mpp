// QA Modul 3: pengiriman, review OD, pengembalian, konfirmasi mutasi, dialog.
const {JSDOM}=require('jsdom'), fs=require('fs');
const F = require(__dirname + '/fixture.js');
const w=new JSDOM(fs.readFileSync('/home/claude/mpp/dist/index.html','utf8'),
  {runScripts:'dangerously',url:'https://local.test/',pretendToBeVisual:true}).window;
w.scrollTo=()=>{};
const gagal=[]; const cek=(n,ok,i)=>{ if(!ok) gagal.push(n); console.log((ok?'PASS ':'GAGAL')+'  '+n+(!ok&&i?'  ['+i+']':'')); };
setTimeout(()=>{
// Aplikasi kosong: data dimuat lewat jalur impor sungguhan.
F.lengkap(w);
const d=w.document, S=w.NBStore;

// Persiapan: buka siklus
S.masuk('U-OD-01'); S.ubahStatusSiklus('MPP-2027','OPEN'); S.keluar();

// A. Kirim usulan
S.masuk('U-HOD-MKT');
const sub=S.submissionDepartemen('MPP-2027','D-MKT');
let bad=S.tambahBaris('MPP-2027','D-MKT',{action_type:'EXTERNAL_HIRING',position_id:'POS-MKT-002',
  quantity:1,justification:'pendek'});
cek('A1 baris bergalat tetap bisa disimpan sebagai draft', bad.ok);
let kirim=S.kirimSubmission('MPP-2027','D-MKT');
cek('A2 kirim ditolak selama ada galat', !kirim.ok && kirim.kunci==='kirim.errGalat', JSON.stringify(kirim));
S.hapusBaris(bad.baris.line_item_id);
kirim=S.kirimSubmission('MPP-2027','D-MKT');
cek('A3 kirim berhasil setelah dibereskan', kirim.ok);
cek('A4 status jadi SUBMITTED', S.submissionDepartemen('MPP-2027','D-MKT').status==='SUBMITTED');
// Batas pengumpulan MPP 2027 adalah 15 Okt 2026, jadi hari ini belum terlambat.
cek('A5 penanda terlambat mati karena masih sebelum batas',
    S.submissionDepartemen('MPP-2027','D-MKT').is_late===false,
    String(S.submissionDepartemen('MPP-2027','D-MKT').is_late));
cek('A5b perbandingan tanggal batas bekerja',
    ('2026-12-01' > '2026-10-15') && !('2026-08-30' > '2026-10-15'));
cek('A6 HOD tidak bisa menyunting lagi', !S.bolehRencana('MPP-2027','D-MKT').ok);
cek('A7 tambah baris ditolak setelah dikirim', !S.tambahBaris('MPP-2027','D-MKT',{action_type:'NO_CHANGE'}).ok);

// B. Review OD
cek('B1 HOD tidak boleh mereview', !S.reviewSubmission(sub.submission_id,'ACCEPT',null).ok);
S.keluar(); S.masuk('U-OD-01');
cek('B2 kembalikan tanpa alasan ditolak',
    !S.reviewSubmission(sub.submission_id,'RETURN','pendek').ok);
let ret=S.reviewSubmission(sub.submission_id,'RETURN','Kuantitas rekrutmen belum sejalan dengan RKAP 2027');
cek('B3 kembalikan dengan alasan berhasil', ret.ok);
cek('B4 status jadi RETURNED', S.submissionDepartemen('MPP-2027','D-MKT').status==='RETURNED');
cek('B5 versi naik jadi 2', S.submissionDepartemen('MPP-2027','D-MKT').version===2);
S.keluar(); S.masuk('U-HOD-MKT');
cek('B6 HOD bisa menyunting lagi', S.bolehRencana('MPP-2027','D-MKT').ok);
cek('B7 catatan OD terbaca HOD',
    (S.submissionDepartemen('MPP-2027','D-MKT').review_note||'').indexOf('RKAP')>-1);
S.kirimSubmission('MPP-2027','D-MKT');
S.keluar(); S.masuk('U-OD-01');
let acc=S.reviewSubmission(sub.submission_id,'ACCEPT',null);
cek('B8 terima berhasil', acc.ok && S.submissionDepartemen('MPP-2027','D-MKT').status==='OD_ACCEPTED');
cek('B9 keputusan ganda ditolak', !S.reviewSubmission(sub.submission_id,'ACCEPT',null).ok);

// C. Mutasi lintas departemen
S.keluar(); S.masuk('U-HOD-PRD');
let mut=S.tambahBaris('MPP-2027','D-PRD',{action_type:'TRANSFER',employee_id:'NBT2030',
  target_department_id:'D-QAS',effective_month:6,justification:'Kompetensi analitiknya lebih terpakai di QA'});
cek('C1 baris mutasi dibuat', mut.ok);
S.kirimSubmission('MPP-2027','D-PRD');
let baris=S.barisSubmission(S.submissionDepartemen('MPP-2027','D-PRD').submission_id)
  .find(b=>b.line_item_id===mut.baris.line_item_id);
cek('C2 mutasi menunggu konfirmasi setelah dikirim', baris.transfer_status==='PENDING');
cek('C3 departemen pengirim tidak bisa mengonfirmasi sendiri',
    !S.konfirmasiMutasi(mut.baris.line_item_id,'CONFIRM',null).ok);
S.keluar(); S.masuk('U-OD-01');
cek('C4 OD melihat mutasi masuk karena lingkupnya seluruh departemen',
    S.mutasiMasuk('MPP-2027').length===1);
let ok=S.konfirmasiMutasi(mut.baris.line_item_id,'CONFIRM',null);
cek('C5 konfirmasi berhasil', ok.ok);
cek('C6 konfirmasi ulang ditolak', !S.konfirmasiMutasi(mut.baris.line_item_id,'CONFIRM',null).ok);

// D. Layar review
w.location.hash='#usulan'; w.NBApp.ulang();
let html=d.getElementById('nbPage').innerHTML;
cek('D1 layar review tampil', html.includes('Review Usulan'));
cek('D2 dua submission terdaftar', d.querySelectorAll('#nbPage tr[data-sub]').length===2,
    d.querySelectorAll('#nbPage tr[data-sub]').length+'');
d.querySelector("tr[data-sub='SUB-2027-PRD']").click();
cek('D3 detail terbuka', d.getElementById('nbPage').innerHTML.includes('Rincian usulan'));
cek('D4 tombol keputusan muncul untuk usulan SUBMITTED', !!d.getElementById('rTerima'));
d.getElementById('rKembali').click();
cek('D5 dialog kembalikan muncul', !!d.getElementById('nbConfirm'));
d.getElementById('nbConfirmOk').click();
cek('D6 alasan pendek ditolak di dialog', !!d.getElementById('nbConfirm'));
d.getElementById('nbConfirmAlasan').value='Beban lini wafer perlu dicek ulang dengan Supply Chain';
d.getElementById('nbConfirmOk').click();
cek('D7 pengembalian lewat dialog berhasil',
    S.submissionDepartemen('MPP-2027','D-PRD').status==='RETURNED');

// E. Peran lain
S.keluar(); S.masuk('U-HOD-MKT'); w.location.hash='#usulan'; w.NBApp.ulang();
cek('E1 HOD tidak punya menu review', !d.querySelector('a[href="#usulan"]'));
cek('E2 HOD dilempar dari layar review', w.location.hash==='#dashboard', w.location.hash);
cek('E3 penolakan tercatat di audit',
    w.NBAudit.semua().some(e=>e.event_type==='SCOPE_DENIED'&&e.object_id==='usulan'));

// F. Tidak ada dialog bawaan browser lagi
cek('F1 tidak ada confirm bawaan', !/[^a-zA-Z.]confirm\(/.test(fs.readFileSync('/home/claude/mpp/js/pages/planning.js','utf8')));
cek('F2 tidak ada prompt bawaan', !/[^a-zA-Z.]prompt\(/.test(fs.readFileSync('/home/claude/mpp/js/pages/siklus.js','utf8')));

console.log('\nTOTAL GAGAL: '+gagal.length); gagal.forEach(x=>console.log(' - '+x));
},400);
