// QA bahasa: setiap layar harus bersih dari kata Indonesia saat mode EN.
const {JSDOM}=require('jsdom'), fs=require('fs');
const F = require(__dirname + '/fixture.js');
const w=new JSDOM(fs.readFileSync('/home/claude/mpp/dist/index.html','utf8'),
  {runScripts:'dangerously',url:'https://local.test/',pretendToBeVisual:true}).window;
w.scrollTo=()=>{}; w.confirm=()=>true;
const KATA=/\b(Departemen|departemen|Karyawan|Seluruh|Lingkup|Belum|Siklus|siklus|Ubah|Simpan|Tutup|Cari|Aktif|Ditutup|Terbuka|dirilis|dibekukan|Tidak ada|Rincian|Pengguna|Waktu|Perubahan|Rentang|Gaji|Baris|Bukti|Alasan|Koreksi|Prototipe|Batas)\b/;
setTimeout(()=>{
// Aplikasi kosong: data dimuat lewat jalur impor sungguhan.
F.master(w); F.siklus(w);
  const d=w.document, gagal=[];
  function bersih(nama){
    const teks=d.getElementById('nbPage').innerText || d.getElementById('nbPage').textContent;
    const m=teks.match(KATA);
    console.log((m?'GAGAL':'PASS ')+'  '+nama+(m?'  ['+m[0]+']':''));
    if(m) gagal.push(nama+': '+m[0]);
  }
  w.NBi18n.set('en');
  w.NBApp.ulang(); bersih('login EN');
  d.querySelector("button[data-user='U-OD-01']").click(); bersih('dashboard EN');
  w.location.hash='#organisasi'; w.NBApp.ulang(); bersih('organisasi EN');
  w.location.hash='#siklus'; w.NBApp.ulang(); bersih('siklus EN');
  d.querySelector("button[data-status='OPEN']").click();
  d.getElementById('snapRilis').click(); bersih('siklus EN setelah rilis');
  d.querySelector('button[data-lihat]').click(); bersih('isi snapshot EN');
  w.location.hash='#audit'; w.NBApp.ulang(); bersih('audit EN');
  w.location.hash='#planning'; w.NBApp.ulang(); bersih('planning EN');
  d.getElementById('pTambah').click(); 
  { const m=d.getElementById('mPlan').textContent; const x=m.match(KATA);
    console.log((x?'GAGAL':'PASS ')+'  form planning EN'+(x?'  ['+x[0]+']':'')); if(x) gagal.push('form'); 
    d.querySelector('#mPlan [data-tutup]').click(); }
  // Modul 3: layar review dan dialog
  w.NBStore.keluar(); w.NBStore.masuk('U-HOD-MKT');
  w.NBStore.kirimSubmission('MPP-2027','D-MKT');
  w.NBStore.keluar(); w.NBStore.masuk('U-OD-01');
  w.location.hash='#usulan'; w.NBApp.ulang(); bersih('review usulan EN');
  { const tr=d.querySelector('#nbPage tr[data-sub]'); if(tr){ tr.click(); bersih('detail usulan EN'); } }
  { const btn=d.getElementById('rKembali');
    if(btn){ btn.click(); const m=d.getElementById('nbConfirm').textContent; const x=m.match(KATA);
      console.log((x?'GAGAL':'PASS ')+'  dialog konfirmasi EN'+(x?'  ['+x[0]+']':'')); if(x) gagal.push('dialog');
      d.querySelector('#nbConfirm [data-batal]').click(); } }
  // Modul 4: konsolidasi
  w.NBStore.reviewSubmission('SUB-2027-MKT','ACCEPT',null);
  w.location.hash='#konsolidasi'; w.NBApp.ulang(); bersih('konsolidasi EN');
  { const t=d.querySelector("button[data-tab='action']"); if(t){ t.click(); bersih('konsolidasi per action EN'); } }
  { const t=d.querySelector("button[data-tab='bulan']"); if(t){ t.click(); bersih('konsolidasi bulan EN'); } }
  // Modul 5: biaya
  w.NBStore.keluar(); w.NBStore.masuk('U-CB-01');
  w.location.hash='#biaya'; w.NBApp.ulang(); bersih('biaya EN');
  { const t=d.querySelector("button[data-tab='asumsi']"); if(t){ t.click(); bersih('asumsi biaya EN'); } }
  w.NBStore.keluar(); w.NBStore.masuk('U-OD-01');
  // Modul 6: management review
  w.NBStore.keluar(); w.NBStore.masuk('U-OD-01'); w.NBStore.kunciKonsolidasi('MPP-2027');
  w.NBStore.keluar(); w.NBStore.masuk('U-MGT-01');
  w.location.hash='#review'; w.NBApp.ulang(); bersih('management review EN');
  { const b=d.querySelector('#nbPage button[data-kurangi]');
    if(b){ b.click(); const m=d.getElementById('mKurangi').textContent; const x=m.match(KATA);
      console.log((x?'GAGAL':'PASS ')+'  dialog kurangi EN'+(x?'  ['+x[0]+']':'')); if(x) gagal.push('kurangi');
      d.querySelector('#mKurangi [data-batal]').click(); }
    else { console.log('LEWAT  dialog kurangi EN, tombol tidak tersedia'); } }
  { const t=d.querySelector("button[data-tab='revisi']"); if(t){ t.click(); bersih('riwayat revisi EN'); } }
  // Modul 7: alokasi
  { const baris=w.NBStore.barisReview('MPP-2027');
    baris.forEach(function(l){ w.NBStore.putuskanBaris(l.line_item_id,'APPROVE',null,null); });
    w.NBStore.setujuiMpp('MPP-2027','Catatan persetujuan untuk pengujian bahasa');
    w.NBStore.keluar(); w.NBStore.masuk('U-OD-01');
    w.NBStore.distribusikanAlokasi('MPP-2027'); }
  w.location.hash='#approved'; w.NBApp.ulang(); bersih('approved MPP EN');
  { const t=d.querySelector("button[data-tab='alokasi']"); if(t){ t.click(); bersih('daftar alokasi EN'); } }
  // Modul 8: monitoring
  w.NBStore.keluar(); w.NBStore.masuk('U-MON-01');
  w.location.hash='#monitoring'; w.NBApp.ulang(); bersih('monitoring EN');
  { const t=d.querySelector("button[data-tab='alokasi']"); if(t){ t.click(); bersih('alokasi monitoring EN'); } }
  { const b=d.querySelector('#nbPage button[data-catat]');
    if(b){ b.click(); const m=d.getElementById('mCatat').textContent; const x=m.match(KATA);
      console.log((x?'GAGAL':'PASS ')+'  dialog catat realisasi EN'+(x?'  ['+x[0]+']':'')); if(x) gagal.push('catat');
      d.querySelector('#mCatat [data-batal]').click(); } }
  { const t=d.querySelector("button[data-tab='bulan']"); if(t){ t.click(); bersih('kurva monitoring EN'); } }
  // Modul 9: laporan dan administrasi
  w.NBStore.keluar(); w.NBStore.masuk('U-OD-01');
  w.location.hash='#laporan'; w.NBApp.ulang(); bersih('laporan EN');
  { const sel=d.getElementById('lPilih');
    if(sel){ sel.value='R7'; sel.onchange(); bersih('laporan realisasi EN'); } }
  w.location.hash='#admin'; w.NBApp.ulang(); bersih('administrasi EN');
  { const t=d.querySelector("button[data-tab='penutupan']"); if(t){ t.click(); bersih('penutupan siklus EN'); } }
  w.location.hash='#data'; w.NBApp.ulang(); bersih('impor ekspor EN');
  const bar=d.querySelector('.nb-appbar').textContent;
  console.log((KATA.test(bar)?'GAGAL':'PASS ')+'  app bar EN'+(KATA.test(bar)?'  ['+bar.match(KATA)[0]+']':''));
  console.log('\nTOTAL GAGAL: '+gagal.length);
},400);
