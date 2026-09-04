// QA Modul 6: keputusan manajemen, larangan menaikkan, versioning, persetujuan MPP.
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

// Persiapan sampai terkonsolidasi
S.masuk('U-OD-01'); S.ubahStatusSiklus('MPP-2027','OPEN'); S.keluar();
S.masuk('U-HOD-MKT'); S.kirimSubmission('MPP-2027','D-MKT'); S.keluar();
S.masuk('U-HOD-PRD'); S.kirimSubmission('MPP-2027','D-PRD'); S.keluar();
S.masuk('U-OD-01');
S.reviewSubmission('SUB-2027-MKT','ACCEPT',null); S.reviewSubmission('SUB-2027-PRD','ACCEPT',null);

// A. Sebelum dikunci
cek('A1 belum ada baris untuk diputuskan', S.barisReview('MPP-2027').length===0);
S.keluar(); S.masuk('U-MGT-01');
cek('A2 keputusan ditolak sebelum konsolidasi',
    !S.putuskanBaris('LI-0004','APPROVE',null,null).ok);
S.keluar(); S.masuk('U-OD-01'); S.kunciKonsolidasi('MPP-2027');
cek('A3 setelah dikunci baris siap diputuskan', S.barisReview('MPP-2027').length===5,
    String(S.barisReview('MPP-2027').length));

// B. Aturan pilihan A
S.keluar(); S.masuk('U-MGT-01');
let r=S.ringkasKeputusan('MPP-2027');
const hire=r.baris.find(x=>x.baris.line_item_id==='LI-0004');   // rekrutmen 3 operator
cek('B1 usulan rekrutmen tiga orang', hire.usulanQty===3);
let naik=S.putuskanBaris('LI-0004','REDUCE',5,'Ingin menambah kapasitas lebih banyak lagi');
cek('B2 menaikkan ditolak', !naik.ok && naik.kunci==='mgmt.errNaik', JSON.stringify(naik));
let sama=S.putuskanBaris('LI-0004','REDUCE',3,'Alasan yang cukup panjang untuk diuji');
cek('B3 mengurangi ke angka sama ditolak', !sama.ok && sama.kunci==='mgmt.errSamaSaja');
let tanpa=S.putuskanBaris('LI-0004','REDUCE',2,'pendek');
cek('B4 mengurangi tanpa alasan layak ditolak', !tanpa.ok);
let turun=S.putuskanBaris('LI-0004','REDUCE',2,'Kapasitas anggaran 2027 hanya menampung dua operator');
cek('B5 mengurangi berhasil', turun.ok && turun.baris.approved_quantity===2);
cek('B6 keputusan tercatat sebagai REDUCED', turun.baris.decision==='REDUCED');
cek('B7 versi baris naik', turun.baris.version===2, String(turun.baris.version));

// C. Dampak ke HC dan biaya
r=S.ringkasKeputusan('MPP-2027');
const h2=r.baris.find(x=>x.baris.line_item_id==='LI-0004');
cek('C1 HC usulan tiga, disetujui dua', h2.hcUsulan===3 && h2.hcSetuju===2,
    h2.hcUsulan+' / '+h2.hcSetuju);
cek('C2 biaya disetujui dua pertiga biaya usulan',
    Math.abs(h2.biayaSetuju.annualized_cost/h2.biayaUsulan.annualized_cost - 2/3)<0.001,
    h2.biayaSetuju.annualized_cost+' / '+h2.biayaUsulan.annualized_cost);
cek('C3 total biaya disetujui lebih kecil', r.disetujuiBiaya<r.usulanBiaya,
    F.rupiah(r.disetujuiBiaya)+' vs '+F.rupiah(r.usulanBiaya));

// D. Penolakan
let tolak=S.putuskanBaris('LI-0003','REJECT',0,'Analisis kampanye cukup ditangani agensi tahun depan');
cek('D1 penolakan berhasil', tolak.ok && tolak.baris.approved_quantity===0);
r=S.ringkasKeputusan('MPP-2027');
const pos=r.baris.find(x=>x.baris.line_item_id==='LI-0003');
cek('D2 baris ditolak berdampak HC nol', pos.hcSetuju===0);
cek('D3 baris ditolak berbiaya nol', pos.biayaSetuju.annualized_cost===0);

// E. Persetujuan tingkat siklus
let belum=S.setujuiMpp('MPP-2027','Catatan persetujuan paket MPP 2027');
cek('E1 persetujuan ditolak selama ada baris belum diputuskan',
    !belum.ok && belum.kunci==='mgmt.errBelumSemua', JSON.stringify(belum));
['LI-0001','LI-0002','LI-0005'].forEach(id=>S.putuskanBaris(id,'APPROVE',null,null));
S.keluar(); S.masuk('U-CB-01');
cek('E2 C&B tidak boleh menyetujui', !S.setujuiMpp('MPP-2027','Catatan dari C&B untuk pengujian').ok);
S.keluar(); S.masuk('U-MGT-01');
let apr=S.setujuiMpp('MPP-2027','Disetujui dengan pemangkasan pada lini produksi');
cek('E3 persetujuan berhasil', apr.ok && apr.approval.approval_id==='APR-2027-V1', JSON.stringify(apr).slice(0,90));
cek('E4 usulan berubah jadi APPROVED', S.submissionDepartemen('MPP-2027','D-MKT').status==='APPROVED');
const rBaru=S.ringkasKeputusan('MPP-2027');
cek('E5 netto disetujui tersimpan beku', apr.approval.netto_disetujui===rBaru.disetujuiHc,
    apr.approval.netto_disetujui+' vs ringkas '+rBaru.disetujuiHc);
cek('E6 persetujuan kedua ditolak', !S.setujuiMpp('MPP-2027','Percobaan menyetujui dua kali').ok);

// F. Riwayat revisi
const rev=S.revisiSiklus('MPP-2027');
cek('F1 revisi tercatat', rev.length>=3, String(rev.length));
cek('F2 revisi menyimpan nilai lama dan baru',
    rev.some(x=>x.object_id==='LI-0004'&&String(x.old_value)==='3'&&String(x.new_value)==='2'));
cek('F3 revisi menyimpan alasan',
    rev.some(x=>(x.reason||'').indexOf('anggaran')>-1));
cek('F4 audit mencatat persetujuan',
    w.NBAudit.semua().some(e=>e.event_type==='MGMT_APPROVE'));

// G. Jalur kenaikan lewat pengembalian
S.keluar(); S.masuk('U-OD-01'); S.ubahStatusSiklus('MPP-2027','OPEN');
S.keluar(); S.masuk('U-HOD-SLS');
S.tambahBaris('MPP-2027','D-SLS',{action_type:'EXTERNAL_HIRING',position_id:'POS-SLS-008',
  quantity:2,effective_month:4,replacement_flag:'Additional',
  justification:'Penambahan dua supervisor area untuk kanal modern trade'});
S.kirimSubmission('MPP-2027','D-SLS');
S.keluar(); S.masuk('U-OD-01'); S.reviewSubmission('SUB-2027-SLS','ACCEPT',null);
S.kunciKonsolidasi('MPP-2027');
S.keluar(); S.masuk('U-MGT-01');
let kmb=S.kembalikanKeDepartemen('MPP-2027','Silakan usulkan ulang dengan kuantitas yang berbeda');
cek('G1 pengembalian ke departemen berhasil', kmb.ok && kmb.jumlah===1, JSON.stringify(kmb));
cek('G2 usulan kembali bisa disunting',
    S.submissionDepartemen('MPP-2027','D-SLS').status==='RETURNED');
S.keluar(); S.masuk('U-HOD-SLS');
cek('G3 HOD bisa menyunting lagi', S.bolehRencana('MPP-2027','D-SLS').ok);

// H. Layar
S.keluar(); S.masuk('U-MGT-01'); w.location.hash='#review'; w.NBApp.ulang();
let html=d.getElementById('nbPage').innerHTML;
cek('H1 layar review manajemen tampil', html.includes('Management Review'));
cek('H2 aturan tidak boleh menaikkan tampil di layar', html.includes('tidak boleh menaikkan'));
d.querySelector("button[data-tab='revisi']").click();
cek('H3 tab riwayat revisi bekerja', d.getElementById('nbPage').innerHTML.includes('REV-'));
S.keluar(); S.masuk('U-HOD-MKT'); w.location.hash='#review'; w.NBApp.ulang();
cek('H4 HOD dilempar dari layar review manajemen', w.location.hash==='#dashboard');
S.keluar(); S.masuk('U-CB-01'); w.location.hash='#review'; w.NBApp.ulang();
cek('H5 C&B boleh melihat tapi tanpa tombol keputusan',
    w.location.hash==='#review' && !d.querySelector('#nbPage button[data-setuju]'));

console.log('\nTOTAL GAGAL: '+gagal.length); gagal.forEach(x=>console.log(' - '+x));
},400);
