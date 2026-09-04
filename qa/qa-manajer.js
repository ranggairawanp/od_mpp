// QA lingkup pohon: manajer 5A ke atas menyusun untuk timnya, HOD mengirim, HOD menang.
const {JSDOM}=require('jsdom'), fs=require('fs');
const FX=require(__dirname + '/fixture.js');
const w=new JSDOM(fs.readFileSync('/home/claude/mpp/dist/index.html','utf8'),
  {runScripts:'dangerously',url:'https://local.test/',pretendToBeVisual:true}).window;
w.scrollTo=()=>{};
const gagal=[]; const cek=(n,ok,i)=>{ if(!ok) gagal.push(n); console.log((ok?'PASS ':'GAGAL')+'  '+n+(!ok&&i?'  ['+i+']':'')); };
setTimeout(()=>{
FX.lengkap(w);
const d=w.document, S=w.NBStore, O=w.NBOrganisasi;

// A. Pohon dari berkas karyawan
S.masuk('U-OD-01');
const pohon=S.pohonOrganisasi();
cek('A1 tujuh puncak, satu per departemen', pohon.puncak.length===7, String(pohon.puncak.length));
cek('A2 tidak ada lingkaran pelaporan', O.deteksiSiklus(S.karyawanTerlihat()).length===0);
const manajer=S.semuaPengguna().filter(u=>u.role==='MANAGER');
cek('A3 manajer turunan semua 5A ke atas', manajer.every(u=>S.levelGrade(S.karyawan(u.employee_id).grade_id)>=13));
cek('A4 HOD turunan adalah puncak departemennya',
    S.semuaPengguna().filter(u=>u.role==='HOD').every(u=>S.hodDari(u.scope.department_id).employee_id===u.employee_id));

// B. Lingkup manajer: hanya diri dan bawahan berjenjang di dalam departemen
const m=manajer.find(u=>u.scope.department_id==='D-MKT');
S.keluar(); S.masuk(m.user_id);
const tim=S.karyawanTerlihat();
const bawahan=O.bawahan(m.employee_id, pohon, 'D-MKT');
cek('B1 manajer melihat diri dan bawahannya saja',
    tim.length===bawahan.length+1 && tim.every(e=>e.employee_id===m.employee_id||bawahan.indexOf(e.employee_id)>-1),
    tim.length+' vs '+(bawahan.length+1));
cek('B2 manajer tidak melihat HOD-nya', !tim.some(e=>e.employee_id===S.hodDari('D-MKT').employee_id));
cek('B3 manajer tidak melihat nominal', !w.NBRbac.canSeeCost(S.user(),'D-MKT'));
cek('B4 manajer tidak punya hak kirim', !w.NBRbac.can(S.user(),'plan.submit'));

// C. Manajer menyusun untuk timnya, tidak untuk orang lain
const anak=bawahan[0];
const luar=S.hodDari('D-MKT').employee_id;
let ok=S.tambahBaris('MPP-2027','D-MKT',{action_type:'NO_CHANGE',employee_id:anak});
cek('C1 manajer boleh mengusulkan bawahannya', ok.ok, JSON.stringify(ok).slice(0,80));
cek('C2 baris menyimpan pengusul dan perannya', ok.baris.proposed_by===m.user_id && ok.baris.proposed_role==='MANAGER');
let tolak=S.tambahBaris('MPP-2027','D-MKT',{action_type:'NO_CHANGE',employee_id:luar});
cek('C3 manajer tidak boleh mengusulkan orang di luar pohonnya', !tolak.ok && tolak.kunci==='plan.errPohon');
cek('C4 penolakan tercatat di audit', w.NBAudit.semua().some(e=>e.event_type==='SCOPE_DENIED'&&e.object_id===luar));
cek('C5 manajer tidak bisa mengirim', !S.kirimSubmission('MPP-2027','D-MKT').ok);
w.location.hash='#planning'; w.NBApp.ulang();
cek('C6 layar perencanaan tanpa tombol kirim untuk manajer', !d.getElementById('pKirim') && !!d.getElementById('pTambah'));

// D. HOD menang atas orang yang sama
S.keluar(); S.masuk('U-HOD-MKT');
const hod=S.tambahBaris('MPP-2027','D-MKT',{action_type:'PROMOTION',employee_id:anak,target_grade_id:'5A',
  effective_month:5,justification:'Layak naik setelah memimpin dua kampanye besar'});
cek('D1 HOD bisa mengusulkan orang yang sama', hod.ok);
const barisManajer=S.barisSubmission(hod.baris.submission_id).find(b=>b.line_item_id===ok.baris.line_item_id);
cek('D2 baris manajer ditandai ditimpa', barisManajer.status==='SUPERSEDED' && barisManajer.superseded_by==='U-HOD-MKT');
cek('D3 baris ditimpa tidak ikut dikirim',
    (S.kirimSubmission('MPP-2027','D-MKT').ok) && S.barisSubmission(hod.baris.submission_id).some(b=>b.status==='SUPERSEDED'));
S.keluar(); S.masuk('U-OD-01');
S.reviewSubmission('SUB-2027-MKT','ACCEPT',null);
const k=S.konsolidasi('MPP-2027');
cek('D4 konsolidasi mengecualikan baris ditimpa', k.total.baris===S.barisSiklusTerlihat('MPP-2027').filter(l=>l.status!=='SUPERSEDED'&&l.department_id==='D-MKT').length);

// E. Halaman login menampilkan persona turunan
S.keluar(); w.NBApp.ulang();
cek('E1 kartu manajer turunan tampil', d.querySelectorAll("button[data-user^='EMP-']").length>=3);
cek('E2 kartu HOD dari berkas pengguna tetap tampil', !!d.querySelector("button[data-user='U-HOD-MKT']"));

console.log('\nTOTAL GAGAL: '+gagal.length); gagal.forEach(x=>console.log(' - '+x));
},500);
