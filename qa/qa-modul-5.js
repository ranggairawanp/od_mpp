// QA Modul 5: mesin biaya, asumsi bertanggal, prorata bulan efektif.
const {JSDOM}=require('jsdom'), fs=require('fs');
const FX = require(__dirname + '/fixture.js');
const w=new JSDOM(fs.readFileSync('/home/claude/mpp/dist/index.html','utf8'),
  {runScripts:'dangerously',url:'https://local.test/',pretendToBeVisual:true}).window;
w.scrollTo=()=>{};
const gagal=[]; const cek=(n,ok,i)=>{ if(!ok) gagal.push(n); console.log((ok?'PASS ':'GAGAL')+'  '+n+(!ok&&i?'  ['+i+']':'')); };
setTimeout(()=>{
// Aplikasi kosong: data dimuat lewat jalur impor sungguhan.
FX.lengkap(w);
const d=w.document, S=w.NBStore, C=w.NBCosting, F=w.NBFormat;
S.masuk('U-CB-01');

// A. Asumsi bertanggal. Fixture memuat satu paket saat belum ada siklus, jadi tanggalnya
// tahun berjalan. Paket kedua diunggah saat siklus 2027 ada, jadi berlaku 1 Januari 2027.
const paketAwal=S.semuaAsumsi()[0];
cek('A1 paket awal berlaku tahun berjalan', /^CA-2026/.test(paketAwal.assumption_id), paketAwal.assumption_id);
const ulang=w.NBImpor.urai(FX.baca('05-asumsi-biaya.csv'));
// Menaikkan seluruh fixed_income 7 persen supaya paket 2027 terbukti berbeda.
ulang.baris.forEach(r=>{ r.fixed_income=Math.round(Number(r.fixed_income)*1.07); });
S.terapkanImpor('ASUMSI',ulang.baris,'MPP-2027');
const a26=S.asumsiBiaya('2026-06-01'), a27=S.asumsiBiaya('2027-06-01');
cek('A2 asumsi mengikuti tanggal berlaku', a26.assumption_id!==a27.assumption_id && /2027/.test(a27.assumption_id),
    a26.assumption_id+' / '+a27.assumption_id);
cek('A3 siklus 2027 memakai paket 2027', S.konteksBiaya('MPP-2027').assumption_id===a27.assumption_id);
cek('A4 siklus 2026 memakai paket 2026', S.konteksBiaya('MPP-2026').assumption_id===a26.assumption_id);
const g26=S.biayaGrade('4B','MPP-2026'), g27=S.biayaGrade('4B','MPP-2027');
cek('A5 paket 2027 lebih mahal dari 2026', g27.total>g26.total, g26.total+' -> '+g27.total);
cek('A6 paket lama tidak dihapus', S.semuaAsumsi().length===2);

// B. Lima angka utama menjadi biaya, rincian hanya keterangan
const k=g27.komponen;
const utama=['fixed_income','variable_income','company_coverage','accrual_thr','accrual_bonus'];
const rincian=['gaji_pokok','tunj_grade','tunj_jabatan','tunj_komunikasi','tunj_kehadiran','tunj_makan',
  'tunj_pph21','tunj_cop_hop','asuransi_pihak_ketiga','bpjs_kes','jht','jkk','jkm','jp','jkp'];
cek('B1 lima angka utama tersedia', utama.every(x=>k[x]!==undefined));
cek('B2 lima belas rincian tersedia sebagai keterangan', rincian.every(x=>k[x]!==undefined),
    rincian.filter(x=>k[x]===undefined).join(','));
cek('B3 total sama dengan jumlah lima angka utama',
    g27.total===utama.reduce((a,x)=>a+k[x],0), g27.total+' vs '+utama.reduce((a,x)=>a+k[x],0));
cek('B4 rincian tidak ikut dijumlahkan',
    g27.total!==utama.concat(rincian).reduce((a,x)=>a+k[x],0));
cek('B5 fixed income nol ditolak saat impor',
    !S.pratinjauImpor('ASUMSI',[{grade_id:'4A',fixed_income:0,variable_income:1,company_coverage:1,
      accrual_thr:1,accrual_bonus:1}],'MPP-2027').hasil[0].ok);
cek('B6 angka negatif ditolak saat impor',
    !S.pratinjauImpor('ASUMSI',[{grade_id:'4A',fixed_income:10,variable_income:-1,company_coverage:1,
      accrual_thr:1,accrual_bonus:1}],'MPP-2027').hasil[0].ok);
const p=null;

// C. Prorata bulan efektif (BR-E)
cek('C1 bulan berlaku Juni adalah tujuh', F.bulanBerlaku(6)===7);
cek('C2 bulan berlaku Januari adalah dua belas', F.bulanBerlaku(1)===12);
const ctx={param:null, asumsi:(g)=>a27.grades.find(x=>x.grade_id===g), gradeAsal:'4B', gradeTujuan:'4B'};
const hire=C.baris({action_type:'EXTERNAL_HIRING',quantity:1,effective_month:6},ctx);
cek('C3 rekrutmen Juni dihitung tujuh bulan', hire.applicable_months===7);
cek('C4 tahunan sama dengan bulanan kali tujuh',
    hire.annualized_cost===hire.monthly_cost*7);
cek('C5 bukan bulanan kali dua belas', hire.annualized_cost!==hire.monthly_cost*12);

// D. Promosi hanya selisih grade
const promo=C.baris({action_type:'PROMOTION',effective_month:6},
  {param:null,asumsi:ctx.asumsi,gradeAsal:'4B',gradeTujuan:'4C'});
const t9=C.bulanan(ctx.asumsi('4B'),p).total, t10=C.bulanan(ctx.asumsi('4C'),p).total;
cek('D1 promosi memakai selisih, bukan biaya penuh', promo.monthly_cost===t10-t9,
    promo.monthly_cost+' vs '+(t10-t9));
cek('D2 selisih jauh lebih kecil dari biaya penuh', promo.monthly_cost<t10*0.5);
const noc=C.baris({action_type:'NO_CHANGE',effective_month:0},ctx);
cek('D3 tanpa perubahan berbiaya nol', noc.monthly_cost===0 && noc.annualized_cost===0);
const red=C.baris({action_type:'PLANNED_REDUCTION',effective_month:9},ctx);
cek('D4 pengurangan menghasilkan penghematan', red.monthly_cost<0 && red.annualized_cost<0);
cek('D5 penghematan diprorata empat bulan', red.applicable_months===4);
const posBaru=C.baris({action_type:'POSITION_CREATION',quantity:1,effective_month:8,fill_immediately:false},ctx);
cek('D6 posisi baru yang tidak diisi berbiaya nol', posBaru.monthly_cost===0);
const posIsi=C.baris({action_type:'POSITION_CREATION',quantity:1,effective_month:8,fill_immediately:true},ctx);
cek('D7 posisi baru yang diisi berbiaya penuh', posIsi.monthly_cost>0);
const vacRetain=C.baris({action_type:'VACANCY_ACTION',vacancy_subtype:'RETAIN',effective_month:3},ctx);
cek('D8 vacancy dipertahankan berbiaya nol', vacRetain.monthly_cost===0);

// E. Perhitungan satu siklus
S.keluar(); S.masuk('U-OD-01'); S.ubahStatusSiklus('MPP-2027','OPEN'); S.keluar();
S.masuk('U-HOD-MKT'); S.kirimSubmission('MPP-2027','D-MKT');
S.keluar(); S.masuk('U-HOD-PRD'); S.kirimSubmission('MPP-2027','D-PRD');
S.keluar(); S.masuk('U-OD-01');
let h=S.biayaSiklus('MPP-2027');
cek('E1 sebelum diterima OD belum ada biaya', h.baris===0 && h.total.annualized===0);
S.reviewSubmission('SUB-2027-MKT','ACCEPT',null); S.reviewSubmission('SUB-2027-PRD','ACCEPT',null);
h=S.biayaSiklus('MPP-2027');
cek('E2 setelah diterima biaya muncul', h.total.annualized>0, F.rupiah(h.total.annualized));
cek('E3 prorata lebih kecil dari asumsi Januari', h.total.annualized<h.tanpaProrata,
    F.rupiah(h.total.annualized)+' vs '+F.rupiah(h.tanpaProrata));
cek('E4 rincian per baris sama dengan total',
    h.rincian.reduce((a,r)=>a+r.biaya.annualized_cost,0)===h.total.annualized);
cek('E5 rekap departemen sama dengan total',
    h.perDept.reduce((a,x)=>a+x.annualized,0)===h.total.annualized);
cek('E6 kurva bulanan naik sepanjang tahun',
    h.perBulan[11].biaya>=h.perBulan[0].biaya && h.perBulan[11].biaya===h.total.monthly,
    h.perBulan[11].biaya+' vs '+h.total.monthly);
cek('E7 baris pengurangan menekan biaya',
    h.rincian.some(r=>r.biaya.annualized_cost<0));

// F. Akses kolom biaya
S.keluar(); S.masuk('U-MON-01');
cek('F1 monitor tidak melihat biaya di layar mana pun',
    !w.NBRbac.canSeeCost(S.user(),'D-MKT') && !w.NBRbac.can(S.user(),'cost.view'));
w.location.hash='#biaya'; w.NBApp.ulang();
cek('F2 monitor dilempar dari layar biaya', w.location.hash==='#dashboard', w.location.hash);
S.keluar(); S.masuk('U-HOD-MKT'); w.location.hash='#biaya'; w.NBApp.ulang();
cek('F3 HOD boleh melihat biaya', w.location.hash==='#biaya');
S.keluar(); S.masuk('U-CB-01'); w.location.hash='#biaya'; w.NBApp.ulang();
let html=d.getElementById('nbPage').innerHTML;
cek('F4 layar biaya tampil untuk C&B', html.includes('Perhitungan Biaya'));
cek('F5 total tahunan tampil dalam rupiah', /Rp[\d.]+/.test(html));
d.querySelector("button[data-tab='asumsi']").click();
html=d.getElementById('nbPage').innerHTML;
cek('F6 tab asumsi menampilkan komponen', html.includes('Accrual THR') && html.includes('BPJS Kesehatan'));
cek('F7 catatan JKM tampil', html.includes('JKM'));
d.querySelector("button[data-tab='bulan']").click();
cek('F8 kurva bulanan bekerja', d.getElementById('nbPage').innerHTML.includes('Des'));

console.log('\nTOTAL GAGAL: '+gagal.length); gagal.forEach(x=>console.log(' - '+x));
},400);
