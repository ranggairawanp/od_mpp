// QA khusus alur login di dalam shell dan berkas gabungan
const {JSDOM}=require('jsdom'), fs=require('fs'), path=require('path');
const F = require(__dirname + '/fixture.js');
function buka(file, inline){
  const html=fs.readFileSync(file,'utf8');
  const dom=new JSDOM(html,{runScripts:inline?'dangerously':'outside-only',url:'https://local.test/index.html',pretendToBeVisual:true});
  const w=dom.window; w.scrollTo=()=>{}; w.confirm=()=>true;
  if(!inline){
    const root=path.dirname(file);
    [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1])
      .forEach(f=>w.eval(fs.readFileSync(path.join(root,f),'utf8')));
    w.NBApp.mulai();
  }
  return w;
}
const gagal=[]; const cek=(n,ok,i)=>{ if(!ok) gagal.push(n); console.log((ok?'PASS ':'GAGAL')+'  '+n+(!ok&&i?'  ['+i+']':'')); };

// A. versi modular
let w=buka('/home/claude/mpp/index.html',false), d=w.document;
// Aplikasi kosong: sebelum berkas diunggah hanya ada akun bawaan.
cek('A1 tanpa sesi tampil satu persona bawaan', d.querySelectorAll('button[data-user]').length===1, d.querySelectorAll('button[data-user]').length+'');
require(__dirname + '/fixture.js').master(w);
w.NBApp.ulang();
cek('A1b setelah unggahan tampil lima belas persona', d.querySelectorAll('button[data-user]').length===15, d.querySelectorAll('button[data-user]').length+'');
require(__dirname + '/fixture.js').siklus(w); w.NBStore.keluar(); w.NBApp.ulang();
cek('A2 identitas dan siklus disembunyikan', d.getElementById('nbChrome').style.display==='none');
cek('A3 nav kosong sebelum masuk', d.getElementById('nbNav').innerHTML==='');
d.querySelector("button[data-user='U-OD-01']").click();
cek('A4 setelah masuk langsung ke dashboard', d.getElementById('nbPage').innerHTML.includes('Karyawan dalam lingkup'));
cek('A5 identitas muncul', d.getElementById('nbUser').textContent.includes('Dzuhri'));
cek('A6 penanda siklus muncul', d.getElementById('nbCycle').textContent.includes('MPP 2027'));
d.getElementById('nbLogout').click();
cek('A7 keluar kembali ke pemilih persona', d.querySelectorAll('button[data-user]').length===15);

// B. versi satu berkas, dijalankan apa adanya
const w2=new (require('jsdom').JSDOM)(fs.readFileSync('/home/claude/mpp/dist/index.html','utf8'),
  {runScripts:'dangerously',url:'https://local.test/',pretendToBeVisual:true}).window;
w2.scrollTo=()=>{};
setTimeout(()=>{
  // Aplikasi kosong: berkas tunggal dimuat lewat jalur impor sungguhan.
  F.master(w2); F.siklus(w2); w2.NBApp.ulang();
  const d2=w2.document;
  cek('B1 berkas tunggal memuat pemilih persona', d2.querySelectorAll('button[data-user]').length===15, d2.querySelectorAll('button[data-user]').length+'');
  cek('B2 gaya ikut tertanam', d2.querySelectorAll('style').length>=2);
  cek('B3 logo jadi data URI', (d2.querySelector('.nb-brand img')||{}).src.startsWith('data:image/png'));
  d2.querySelector("button[data-user='U-HOD-MKT']").click();
  cek('B4 login berjalan di berkas tunggal', d2.getElementById('nbPage').innerHTML.includes('Karyawan dalam lingkup'));
  cek('B5 lingkup HOD tetap 8', d2.getElementById('nbPage').innerHTML.includes('>8<'));
  console.log('\nTOTAL GAGAL: '+gagal.length); gagal.forEach(g=>console.log(' - '+g));
},300);
