# Uji ukuran ikon: tidak boleh ada SVG yang membesar tak terkendali di layar mana pun.
from playwright.sync_api import sync_playwright
import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent)); import fixture as FX
URL = "file:///home/claude/mpp/dist/index.html"
LAYAR = ["dashboard","organisasi","siklus","planning","usulan","konsolidasi",
         "biaya","review","approved","monitoring","laporan","matriks","bagan","eksekutif","data","admin","audit"]
PERSONA = ["U-OD-01","U-MON-01","U-HOD-MKT","U-CB-01","U-MGT-01"]
gagal = total = 0
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width":1440,"height":950})
    pg.goto(URL); pg.wait_for_timeout(300)
    FX.lengkap(pg); FX.masuk(pg, "U-OD-01")
    pg.evaluate("NBStore.rilisSnapshot('MPP-2027','2026-09-01');")
    for u in PERSONA:
        pg.evaluate(f"NBStore.keluar(); NBStore.masuk('{u}');")
        besar = []
        for l in LAYAR:
            pg.goto(URL + "#" + l); pg.wait_for_timeout(150)
            out = pg.evaluate("""() => {
              const r=[];
              document.querySelectorAll('svg:not(.nb-bagan)').forEach(el=>{
                const b=el.getBoundingClientRect();
                if (b.width>48 || b.height>48) r.push(Math.round(b.width)+'x'+Math.round(b.height));
              });
              return r;
            }""")
            total += 1
            if out:
                besar.append(l + ":" + ",".join(out[:2])); gagal += 1
        print(("GAGAL" if besar else "PASS ") + f"  {u}" + (f"  [{'; '.join(besar)}]" if besar else ""))
    b.close()
print(f"\n{total} pemeriksaan, TOTAL GAGAL: {gagal}")
