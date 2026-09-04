// QA fase 6: permintaan di luar siklus dengan distribusi bertahap, dan kisi perencanaan.
const {JSDOM}=require('jsdom'), fs=require('fs');
const FX=require(__dirname + '/fixture.js');
const w=new JSDOM(fs.readFileSync('/home/claude/mpp/dist/index.html','utf8'),
  {runScripts:'dangerously',url:'https://local.test/',pretendToBeVisual:true}).window;
w.scrollTo=()=>{};
const gagal=[]; const cek=(n,ok,i)=>{ if(!ok) gagal.push(n); console.log((ok?'PASS ':'GAGAL')+'  '+n+(!ok&&i?'  ['+i+']':'')); };
setTimeout(()=>{
FX.lengkap(w);
const d=w.document, S=w.NBStore;

// ---------- A. Kisi perencanaan ----------
S.masuk('U-HOD-MKT'); w.location.hash='#planning'; w.NBApp.ulang();
const qty=d.querySelector("input[data-kisi-qty]");
cek('A1 sel kuantitas tersedia untuk baris berkuantitas', !!qty);
const idQty=qty.dataset.kisiQty;
qty.value='3'; qty.onchange();
cek('A2 perubahan kuantitas tersimpan lewat store', S.barisSubmission('SUB-2027-MKT').find(b=>b.line_item_id===idQty).quantity===3);
const bulan=d.querySelector("select[data-kisi-bulan]");
const idBulan=bulan.dataset.kisiBulan;
bulan.value='9'; bulan.onchange();
cek('A3 perubahan bulan tersimpan', S.barisSubmission('SUB-2027-MKT').find(b=>b.line_item_id===idBulan).effective_month===9);
cek('A4 audit mencatat perubahan sel', w.NBAudit.semua().filter(e=>e.event_type==='PLAN_LINE_EDIT').length>=2);
S.kirimSubmission('MPP-2027','D-MKT'); w.NBApp.ulang();
cek('A5 setelah dikirim, sel tidak bisa disunting', !d.querySelector("input[data-kisi-qty]"));

// ---------- B. Permintaan di luar siklus ----------
cek('B1 belum boleh membuka sebelum dibagikan', S.bukaPermintaanLuarSiklus('MPP-2027','D-MKT','Kebutuhan mendadak dari pelanggan baru').kunci==='luar.errBelumDibagikan');
S.keluar(); S.masuk('U-HOD-PRD'); S.kirimSubmission('MPP-2027','D-PRD');
S.keluar(); S.masuk('U-OD-01');
S.reviewSubmission('SUB-2027-MKT','ACCEPT',null); S.reviewSubmission('SUB-2027-PRD','ACCEPT',null);
S.kunciKonsolidasi('MPP-2027');
S.keluar(); S.masuk('U-MGT-01');
S.barisReview('MPP-2027').forEach(l=>S.putuskanBaris(l.line_item_id,'APPROVE',null,null));
S.setujuiMpp('MPP-2027','Paket reguler');
S.keluar(); S.masuk('U-OD-01'); S.distribusikanAlokasi('MPP-2027');
const alokAwal=S.alokasiTerlihat('MPP-2027').length;
const m=S.semuaPengguna().find(u=>u.role==='MANAGER'&&u.scope.department_id==='D-MKT');
S.keluar(); S.masuk(m.user_id);
cek('B2 manajer tidak boleh membuka permintaan luar siklus', S.bukaPermintaanLuarSiklus('MPP-2027','D-MKT','Kebutuhan mendadak dari pelanggan baru').kunci==='luar.errPeran');
S.keluar(); S.masuk('U-HOD-MKT');
cek('B3 alasan wajib', !S.bukaPermintaanLuarSiklus('MPP-2027','D-MKT','pendek').ok);
w.location.hash='#planning'; w.NBApp.ulang();
cek('B4 tombol permintaan luar siklus tampil untuk HOD', !!d.getElementById('pLuar'));
const buka=S.bukaPermintaanLuarSiklus('MPP-2027','D-MKT','Pelanggan modern trade baru menuntut dua orang tambahan sebelum Q4');
cek('B5 paket luar siklus terbuka dengan id tersendiri', buka.ok && buka.submission.submission_id==='SUB-2027-MKT-A1' && buka.submission.off_cycle);
cek('B6 submission aktif departemen kini paket luar siklus', S.submissionDepartemen('MPP-2027','D-MKT').off_cycle===true);
cek('B7 paket reguler tetap terdistribusi', S.daftarSubmission('MPP-2027').find(s=>s.submission_id==='SUB-2027-MKT').status==='DISTRIBUTED');
const tambah=S.tambahBaris('MPP-2027','D-MKT',{action_type:'EXTERNAL_HIRING',position_id:'POS-MKT-004',quantity:2,effective_month:10,
  replacement_flag:'Additional',justification:'Dua digital marketing officer untuk pelanggan modern trade baru'});
cek('B8 baris masuk ke paket luar siklus', tambah.ok && tambah.baris.submission_id==='SUB-2027-MKT-A1');
cek('B9 paket luar siklus bisa dikirim', S.kirimSubmission('MPP-2027','D-MKT').ok);

// Alur yang sama sampai alokasi tambahan
S.keluar(); S.masuk('U-OD-01');
const k=S.konsolidasi('MPP-2027');
cek('B10 konsolidasi menyebut paket luar siklus yang belum diterima', k.exceptions.some(e=>e.jenis==='LUARSIKLUS'));
cek('B11 departemen tetap dianggap ikut karena paket regulernya sudah masuk', k.perDept.find(x=>x.department_id==='D-MKT').ikut);
S.reviewSubmission('SUB-2027-MKT-A1','ACCEPT',null);
cek('B12 konsolidasi kedua bisa dikunci', S.kunciKonsolidasi('MPP-2027').ok);
S.keluar(); S.masuk('U-MGT-01');
const belum=S.barisReview('MPP-2027').filter(l=>!l.decision);
cek('B13 hanya baris baru yang menunggu keputusan', belum.length===1 && belum[0].line_item_id===tambah.baris.line_item_id);
S.putuskanBaris(tambah.baris.line_item_id,'REDUCE',1,'Cukup satu orang untuk pelanggan baru itu');
const apr=S.setujuiMpp('MPP-2027','Persetujuan tambahan');
cek('B14 persetujuan menjadi versi kedua', apr.ok && apr.approval.version===2 && apr.approval.approval_id==='APR-2027-V2');
S.keluar(); S.masuk('U-OD-01');
const dist=S.distribusikanAlokasi('MPP-2027');
cek('B15 distribusi bertahap hanya membuat alokasi baru', dist.ok && dist.jumlah===1 && S.alokasiTerlihat('MPP-2027').length===alokAwal+1, JSON.stringify(dist));
const baru=S.alokasiTerlihat('MPP-2027').find(a=>a.line_item_id===tambah.baris.line_item_id);
cek('B16 alokasi baru bernomor lanjut dengan kuota yang dikurangi', baru && baru.approved_qty===1 && baru.approval_id==='APR-2027-V2' && baru.allocation_id==='ALO-2027-000'+(alokAwal+1));
cek('B17 alokasi lama tidak tergandakan', S.alokasiTerlihat('MPP-2027').filter(a=>a.line_item_id==='LI-0001').length===1);
cek('B18 distribusi ketiga ditolak karena tidak ada yang baru', !S.distribusikanAlokasi('MPP-2027').ok);
w.location.hash='#usulan'; w.NBApp.ulang();
cek('B19 review menandai paket luar siklus', d.getElementById('nbPage').innerHTML.indexOf('Di luar siklus')>-1);

console.log('\nTOTAL GAGAL: '+gagal.length); gagal.forEach(x=>console.log(' - '+x));
},500);
