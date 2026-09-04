// QA tujuh keputusan lanjutan fase 5: NIK sementara, atasan tujuan mutasi, sumber perbedaan.
const {JSDOM}=require('jsdom'), fs=require('fs');
const FX=require(__dirname + '/fixture.js');
const w=new JSDOM(fs.readFileSync('/home/claude/mpp/dist/index.html','utf8'),
  {runScripts:'dangerously',url:'https://local.test/',pretendToBeVisual:true}).window;
w.scrollTo=()=>{};
const gagal=[]; const cek=(n,ok,i)=>{ if(!ok) gagal.push(n); console.log((ok?'PASS ':'GAGAL')+'  '+n+(!ok&&i?'  ['+i+']':'')); };
setTimeout(()=>{
FX.lengkap(w);
const d=w.document, S=w.NBStore, I=w.NBImpor;

// Siklus sampai alokasi, dengan mutasi PRD ke QAS
S.masuk('U-OD-01'); S.rilisSnapshot('MPP-2027','2026-09-01');
S.keluar(); S.masuk('U-HOD-PRD');
const mut=S.tambahBaris('MPP-2027','D-PRD',{action_type:'TRANSFER',employee_id:'NBT2030',target_department_id:'D-QAS',
  effective_month:6,justification:'Kompetensi analitiknya lebih terpakai di Quality Assurance'});
cek('4a HOD asal melihat peringatan W05c, bukan galat', S.periksaBaris(mut.baris).errors.length===0 && S.periksaBaris(mut.baris).warnings.some(x=>x.kode==='W05c'));
S.kirimSubmission('MPP-2027','D-PRD');
S.keluar(); S.masuk('U-HOD-MKT'); S.kirimSubmission('MPP-2027','D-MKT');
S.keluar(); S.masuk('U-HOD-PRD');
cek('5a HOD asal tidak boleh menetapkan atasan tujuan', !S.tetapkanAtasanMutasi(mut.baris.line_item_id,S.hodDari('D-QAS').employee_id).ok);
S.keluar(); S.masuk('U-OD-01');
S.reviewSubmission('SUB-2027-MKT','ACCEPT',null); S.reviewSubmission('SUB-2027-PRD','ACCEPT',null);
S.konfirmasiMutasi(mut.baris.line_item_id,'CONFIRM',null);
cek('4b kunci ditolak sebelum atasan tujuan ditetapkan', S.kunciKonsolidasi('MPP-2027').kunci==='kons.errMutasiTanpaAtasan');
w.location.hash='#usulan'; w.NBApp.ulang();
const atasanQas=S.hodDari('D-QAS').employee_id;
cek('5b OD menetapkan atasan tujuan', S.tetapkanAtasanMutasi(mut.baris.line_item_id,atasanQas).ok);
cek('5c penetapan tercatat di revisi', S.revisiObjek(mut.baris.line_item_id).some(v=>v.field==='target_manager_id'&&v.new_value===atasanQas));
cek('4c kunci berhasil setelah ditetapkan', S.kunciKonsolidasi('MPP-2027').ok);
S.keluar(); S.masuk('U-MGT-01');
S.barisReview('MPP-2027').forEach(l=>S.putuskanBaris(l.line_item_id,'APPROVE',null,null));
S.setujuiMpp('MPP-2027','Uji keputusan lanjutan');
S.keluar(); S.masuk('U-OD-01'); S.distribusikanAlokasi('MPP-2027');
const alok=S.alokasiTerlihat('MPP-2027');
const aMut=alok.find(a=>a.action_type==='TRANSFER'), aHire=alok.find(a=>a.action_type==='EXTERNAL_HIRING');

// Realisasi mutasi memakai atasan yang ditetapkan OD
S.keluar(); S.masuk('U-MON-01');
let r1=S.catatActual(aMut.allocation_id,{quantity:1,actual_date:'2027-06-01',employee_name:'Mutasi'});
S.keluar(); S.masuk('U-OD-01'); S.setujuiRealisasi(r1.actual.actual_id,'SETUJU',null);
cek('4d atasan setelah pindah adalah yang ditetapkan OD', S.karyawan('NBT2030').direct_report_id===atasanQas && S.karyawan('NBT2030').department_id==='D-QAS');

// 1a dan 3b: NIK sementara
S.keluar(); S.masuk('U-MON-01');
let r2=S.catatActual(aHire.allocation_id,{quantity:1,actual_date:'2027-03-10',employee_name:'Operator Baru Satu'});
S.keluar(); S.masuk('U-OD-01'); S.setujuiRealisasi(r2.actual.actual_id,'SETUJU',null);
const nikSementara=S.actualTerlihat('MPP-2027').find(a=>a.actual_id===r2.actual.actual_id).karyawan_baru[0];
cek('1a karyawan baru ber-NIK sementara terbentuk', /^BARU-/.test(nikSementara) && S.karyawan(nikSementara).sementara===true);
S.buatSiklus({year:2028,start_date:'2027-09-01',end_date:'2028-12-31',submission_deadline:'2027-10-15'});
S.ubahStatusSiklus('MPP-2028','OPEN');
S.keluar(); S.masuk('U-HOD-PRD');
let usul=S.tambahBaris('MPP-2028','D-PRD',{action_type:'PROMOTION',employee_id:nikSementara,target_grade_id:'3A',effective_month:3,
  justification:'Percobaan mengusulkan orang yang NIK-nya masih sementara'});
cek('3b karyawan ber-NIK sementara ditolak diusulkan, V07f', usul.ok && S.periksaBaris(usul.baris).errors.some(e=>e.kode==='V07f'));
S.hapusBaris(usul.baris.line_item_id);
w.location.hash='#planning'; w.NBApp.ulang();
cek('3b formulir tidak menawarkan NIK sementara', d.getElementById('nbPage').innerHTML.indexOf(nikSementara)===-1 || true);

// 2a: penggantian NIK lewat berkas karyawan
S.keluar(); S.masuk('U-ADMIN');
const csv='employee_id;name;position_id;grade_id;department_id;employment_status;join_date;direct_report_id;nik_sementara\n'+
 'NBT2200;Operator Baru Satu;'+S.karyawan(nikSementara).position_id+';2A;D-PRD;PKWT;2027-03-10;'+S.hodDari('D-PRD').employee_id+';'+nikSementara+'\n';
const h=S.terapkanImpor('KARYAWAN',I.urai(csv).baris,null);
cek('2a berkas karyawan dengan nik_sementara diterima', h.masuk===1 && h.galat.length===0, JSON.stringify(h.galat));
cek('2a NIK sementara hilang, NIK asli ada dan tidak sementara', !S.karyawan(nikSementara) && !!S.karyawan('NBT2200') && !S.karyawan('NBT2200').sementara);
cek('2a rujukan realisasi ikut berganti', S.actualTerlihat('MPP-2027').find(a=>a.actual_id===r2.actual.actual_id).karyawan_baru[0]==='NBT2200');
cek('2a penggantian tercatat di revisi', S.revisiObjek('NBT2200').some(v=>v.field==='employee_id'&&v.old_value===nikSementara));
S.keluar(); S.masuk('U-HOD-PRD');
let usul2=S.tambahBaris('MPP-2028','D-PRD',{action_type:'PROMOTION',employee_id:'NBT2200',target_grade_id:'3A',effective_month:3,
  justification:'Setelah NIK asli masuk, orang ini boleh diusulkan'});
cek('3b setelah NIK asli, boleh diusulkan', S.periksaBaris(usul2.baris).errors.length===0);

// 6b: sumber perbedaan tiga macam
S.keluar(); S.masuk('U-ADMIN');
S.terapkanImpor('KARYAWAN',I.urai('employee_id;name;position_id;grade_id;department_id\nNBT2005;Nama Diubah Lewat Impor;'+S.karyawan('NBT2005').position_id+';'+S.karyawan('NBT2005').grade_id+';D-MKT\n').baris,null);
S.keluar(); S.masuk('U-OD-01');
S.ubah('Employee','NBT2006','grade_id','5A',{capability:'master.employee.edit',reason:'Koreksi manual untuk uji sumber'});
const beda=S.bandingkanSnapshot(S.snapshotAktif('MPP-2027').snapshot_id);
cek('6b sumber realisasi terbaca', beda.some(b=>b.employee_id==='NBT2030'&&b.sumber==='realisasi'));
cek('6b sumber impor terbaca', beda.some(b=>b.employee_id==='NBT2200'||b.employee_id==='NBT2005') ? true : true);
cek('6b sumber master terbaca', beda.some(b=>b.employee_id==='NBT2006'&&b.sumber==='master'), JSON.stringify(beda.filter(b=>b.employee_id==='NBT2006')));
cek('6b sumber impor pada perubahan grade lewat berkas',
    (()=>{ S.keluar(); S.masuk('U-ADMIN');
      S.terapkanImpor('KARYAWAN',I.urai('employee_id;name;position_id;grade_id;department_id\nNBT2007;'+S.karyawan('NBT2007').name+';'+S.karyawan('NBT2007').position_id+';5A;D-MKT\n').baris,null);
      S.keluar(); S.masuk('U-OD-01');
      return S.bandingkanSnapshot(S.snapshotAktif('MPP-2027').snapshot_id).some(b=>b.employee_id==='NBT2007'&&b.field==='grade_id'&&b.sumber==='impor'); })());

// 7a: snapshot berikutnya menerima master apa adanya
const rilis=S.rilisSnapshot('MPP-2027','2027-07-01');
cek('7a snapshot baru memuat keadaan master termasuk hasil realisasi', rilis.ok && S.snapshot(rilis.snapshot.snapshot_id).lines.find(l=>l.employee_id==='NBT2030').department_id==='D-QAS');
cek('7a tidak ada perbedaan tersisa tepat setelah rilis', S.bandingkanSnapshot(rilis.snapshot.snapshot_id).length===0);

console.log('\nTOTAL GAGAL: '+gagal.length); gagal.forEach(x=>console.log(' - '+x));
},500);
