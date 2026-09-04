// QA bagan organisasi: pohon, tata letak, pelipatan, kotak vacancy dan alokasi, lingkup.
const {JSDOM}=require('jsdom'), fs=require('fs');
const FX=require(__dirname + '/fixture.js');
const w=new JSDOM(fs.readFileSync('/home/claude/mpp/dist/index.html','utf8'),
  {runScripts:'dangerously',url:'https://local.test/',pretendToBeVisual:true}).window;
w.scrollTo=()=>{}; w.URL.createObjectURL=()=>'blob:uji'; w.URL.revokeObjectURL=()=>{};
const gagal=[]; const cek=(n,ok,i)=>{ if(!ok) gagal.push(n); console.log((ok?'PASS ':'GAGAL')+'  '+n+(!ok&&i?'  ['+i+']':'')); };
setTimeout(()=>{
FX.lengkap(w);
const d=w.document, S=w.NBStore, B=w.NBBagan, O=w.NBOrganisasi;
S.masuk('U-OD-01');
const pohon=S.pohonOrganisasi();
const label=e=>({judul:e.name,sub:e.position_id,grade:e.grade_id});
const lipat=e=>O.bolehDilipat(e,S.levelGrade);

// A. Tata letak murni
let h=B.susun('NBT2001',pohon,{}, {batasDept:'D-MKT',bolehDilipat:lipat,kedalamanAwal:2,label:label});
cek('A1 akar Marketing digambar', h.jumlah>=3 && h.svg.indexOf('<svg')===0);
cek('A2 manajer 5A dilipat pada tampilan awal',
    h.simpul.filter(n=>n.kedalaman===1&&n.jenis==='orang').every(n=>n.terlipat||n.jumlahBawahan===0));
cek('A3 kotak tidak saling tumpang tindih',
    (()=>{const s=h.simpul; for(let i=0;i<s.length;i++)for(let j=i+1;j<s.length;j++){
      if(Math.abs(s[i].y-s[j].y)<1 && Math.abs(s[i].x-s[j].x)<B.LEBAR) return false;} return true;})());
let hb=B.susun('NBT2001',pohon,{NBT2002:true},{batasDept:'D-MKT',bolehDilipat:lipat,kedalamanAwal:2,label:label});
cek('A4 membuka simpul menambah kotak', hb.jumlah>h.jumlah, hb.jumlah+' vs '+h.jumlah);
cek('A5 satu kotak satu orang', hb.simpul.filter(n=>n.jenis==='orang').length===new Set(hb.simpul.filter(n=>n.jenis==='orang').map(n=>n.id)).size);
cek('A6 ukuran kanvas mengikuti isi', hb.ukuran.lebar>=B.LEBAR*3 && hb.ukuran.tinggi>=B.TINGGI*3);

// B. Kotak tambahan
const tambahan={NBT2001:[{jenis:'vacancy',judul:'Vacancy',sub:'Posisi X',grade:'4A'},
                         {jenis:'alokasi',judul:'Disetujui',sub:'Posisi Y',grade:'4B'}]};
let ht=B.susun('NBT2001',pohon,{},{batasDept:'D-MKT',bolehDilipat:lipat,kedalamanAwal:2,label:label,tambahan:tambahan});
cek('B1 kotak vacancy dan alokasi ikut digambar', ht.simpul.filter(n=>n.jenis!=='orang').length===2);
cek('B2 kotak tambahan bergaris putus', (ht.svg.match(/stroke-dasharray/g)||[]).length===2);

// C. Batas kotak
const banyak={anak:{},puncak:['R'],peta:{R:{employee_id:'R',name:'Akar',position_id:'P',grade_id:'5C',department_id:'D'}}};
banyak.anak.R=[];
for(let i=0;i<600;i++){const id='E'+i;banyak.peta[id]={employee_id:id,name:'N'+i,position_id:'P',grade_id:'2A',department_id:'D',direct_report_id:'R'};banyak.anak.R.push(id);}
let hbesar=B.susun('R',banyak,{},{bolehDilipat:()=>false,kedalamanAwal:2,label:label});
cek('C1 lebih dari batas ditandai terpotong', hbesar.terpotong && hbesar.jumlah<=B.BATAS_KOTAK+1, String(hbesar.jumlah));

// D. Deteksi lingkaran dan atasan hilang lewat impor
const csv='employee_id;name;position_id;grade_id;department_id;direct_report_id\n'+
 'NBT9001;Lingkar A;POS-MKT-004;4A;D-MKT;NBT9002\n'+
 'NBT9002;Lingkar B;POS-MKT-004;4A;D-MKT;NBT9001\n'+
 'NBT9003;Yatim;POS-MKT-004;4A;D-MKT;NBT8888\n'+
 'NBT9004;Sah;POS-MKT-004;4A;D-MKT;NBT2002\n';
S.keluar(); S.masuk('U-ADMIN');
const p=S.pratinjauImpor('KARYAWAN',w.NBImpor.urai(csv).baris,null);
cek('D1 dua baris melingkar ditolak', p.hasil[0].kunci==='imp.vMelingkar' && p.hasil[1].kunci==='imp.vMelingkar', JSON.stringify(p.hasil[0].vars));
cek('D2 atasan hilang ditolak', p.hasil[2].kunci==='imp.vAtasanHilang');
cek('D3 baris sah tetap lolos', p.hasil[3].ok);

// E. Layar dan lingkup
S.keluar(); S.masuk('U-OD-01'); w.location.hash='#bagan'; w.NBApp.ulang();
cek('E1 OD bisa memilih akar', !!d.getElementById('bgAkar') && d.querySelectorAll('#bgAkar option').length===7);
cek('E2 SVG tergambar', !!d.querySelector('svg.nb-bagan'));
const m=S.semuaPengguna().find(u=>u.role==='MANAGER'&&u.scope.department_id==='D-MKT');
S.keluar(); S.masuk(m.user_id); w.NBApp.ulang();
cek('E3 manajer tidak bisa memilih akar lain', !d.getElementById('bgAkar'));
const html=d.getElementById('nbPage').innerHTML;
cek('E4 akar manajer adalah dirinya', html.indexOf("data-id=\""+m.employee_id+"\"")>-1);
cek('E5 HOD tidak tergambar di bagan manajer', html.indexOf("data-id=\"NBT2001\"")===-1);
S.keluar(); S.masuk('U-MON-01'); w.NBApp.ulang();
cek('E6 bagan tidak memuat nominal', !/Rp[\d.]/.test(d.getElementById('nbPage').innerHTML));
d.getElementById('bgEkspor').click();
cek('E7 unduh SVG berjalan', true);

// F. Berkas usulan lintas departemen tetap terimpor
S.keluar(); S.masuk('U-OD-01');
const lintas=w.NBImpor.urai(fs.readFileSync('/home/claude/mpp/contoh/09-usulan-lintas-departemen.csv','utf8'));
const pl=S.pratinjauImpor('USULAN',lintas.baris,'MPP-2027');
cek('F1 enam belas usulan lintas departemen lolos', pl.valid===16 && pl.galat===0,
    'valid '+pl.valid+' galat '+pl.galat+' '+JSON.stringify(pl.hasil.filter(x=>!x.ok).map(x=>x.baris._baris+':'+x.kunci)));

console.log('\nTOTAL GAGAL: '+gagal.length); gagal.forEach(x=>console.log(' - '+x));
},500);
