// QA fase 10: berkas dari Excel Indonesia, kode ganda, kepala kolom lentur.
const {JSDOM}=require('jsdom'), fs=require('fs');
const FX=require(__dirname + '/fixture.js');
const w=new JSDOM(fs.readFileSync('/home/claude/mpp/dist/index.html','utf8'),
  {runScripts:'dangerously',url:'https://local.test/',pretendToBeVisual:true}).window;
w.scrollTo=()=>{};
const gagal=[]; const cek=(n,ok,i)=>{ if(!ok) gagal.push(n); console.log((ok?'PASS ':'GAGAL')+'  '+n+(!ok&&i?'  ['+i+']':'')); };
setTimeout(()=>{
FX.master(w); FX.siklus(w);
const S=w.NBStore, I=w.NBImpor;

// A. Tanggal
cek('A1 15/03/2027 menjadi 2027-03-15', I.tanggalDari('15/03/2027')==='2027-03-15');
cek('A2 5-3-2027 menjadi 2027-03-05', I.tanggalDari('5-3-2027')==='2027-03-05');
cek('A3 15.03.2027 menjadi 2027-03-15', I.tanggalDari('15.03.2027')==='2027-03-15');
cek('A4 nomor seri Excel 46461 menjadi 2027-03-15', I.tanggalDari('46461')==='2027-03-15', I.tanggalDari('46461'));
cek('A5 TTTT-BB-HH dibiarkan', I.tanggalDari('2027-03-15')==='2027-03-15');
cek('A6 teks bukan tanggal dibiarkan untuk ditolak validasi', I.tanggalDari('kemarin')==='kemarin');

// B. Kepala kolom lentur dan kode dinormalkan
const u=I.urai('Employee ID;Nama;Position ID;GRADE;Departemen;Join Date;Atasan langsung\n  nbt9101 ;Coba Excel;pos-mkt-004;4a;d-mkt;15/03/2027;NBT2002\n');
cek('B1 kepala kolom dikenali walau beda tulisan', u.kolom.join(',')==='employee_id,name,position_id,grade_id,department_id,join_date,direct_report_id', u.kolom.join(','));
cek('B2 kode dibersihkan dan dibesarkan', u.baris[0].employee_id==='NBT9101' && u.baris[0].position_id==='POS-MKT-004' && u.baris[0].grade_id==='4A' && u.baris[0].department_id==='D-MKT');
cek('B3 tanggal dinormalkan saat diurai', u.baris[0].join_date==='2027-03-15');
S.masuk('U-ADMIN');
const p=S.pratinjauImpor('KARYAWAN',u.baris,null);
cek('B4 baris dari Excel lolos validasi', p.valid===1, JSON.stringify(p.hasil[0].kunci));

// C. Kode ganda dalam satu berkas
const g=I.urai('employee_id;name;position_id;grade_id;department_id\nNBT9102;Satu;POS-MKT-004;4A;D-MKT\nNBT9102;Dua;POS-MKT-004;4A;D-MKT\nNBT9103;Tiga;POS-MKT-004;4A;D-MKT\n');
const pg=S.pratinjauImpor('KARYAWAN',g.baris,null);
cek('C1 dua baris berkode sama ditolak keduanya', !pg.hasil[0].ok && !pg.hasil[1].ok && pg.hasil[0].kunci==='imp.vGanda');
cek('C2 baris lain tetap lolos', pg.hasil[2].ok);
const ga=S.pratinjauImpor('ASUMSI',I.urai('grade_id;entity_id;fixed_income;variable_income;company_coverage;accrual_thr;accrual_bonus\n4A;;1;0;0;0;0\n4A;ENT-KSNI;1;0;0;0;0\n').baris,'MPP-2027');
S.keluar(); S.masuk('U-CB-01');
const ga2=S.pratinjauImpor('ASUMSI',I.urai('grade_id;entity_id;fixed_income;variable_income;company_coverage;accrual_thr;accrual_bonus\n4A;;1;0;0;0;0\n4A;ENT-KSNI;1;0;0;0;0\n').baris,'MPP-2027');
cek('C3 grade sama untuk entitas berbeda bukan ganda', ga2.hasil[0].ok && ga2.hasil[1].ok);

// D. Angka gaya Indonesia
S.keluar(); S.masuk('U-CB-01');
const pa=S.pratinjauImpor('ASUMSI',I.urai('grade_id;fixed_income;variable_income;company_coverage;accrual_thr;accrual_bonus\n4A;12.840.000;1.500.000,50;900.000;1.000.000;1.000.000\n').baris,'MPP-2027');
cek('D1 angka dengan titik ribuan dan koma desimal terbaca', pa.valid===1);
S.terapkanImpor('ASUMSI',I.urai('grade_id;fixed_income;variable_income;company_coverage;accrual_thr;accrual_bonus\n4A;12.840.000;1.500.000,50;900.000;1.000.000;1.000.000\n').baris,'MPP-2027');
const paket=S.semuaAsumsi(); const g4a=paket[paket.length-1].grades.find(x=>x.grade_id==='4A');
cek('D2 tersimpan sebagai angka murni', g4a.fixed_income===12840000 && Math.round(g4a.variable_income)===1500001 || g4a.variable_income===1500000.5, JSON.stringify(g4a));

// E. Realisasi dan kurs dengan tanggal Excel
S.keluar(); S.masuk('U-CB-01');
cek('E1 kurs bertanggal Excel diterima', S.pratinjauImpor('KURS',[{currency:'MYR',rate_to_idr:3650,effective_date:'01/01/2027'}],null).hasil[0].ok);

console.log('\nTOTAL GAGAL: '+gagal.length); gagal.forEach(x=>console.log(' - '+x));
},500);
