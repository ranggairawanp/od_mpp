# QA tata letak: tidak boleh ada luapan horizontal di lebar mana pun, pada setiap layar.
from playwright.sync_api import sync_playwright
import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent)); import fixture as FX
URL = "file:///home/claude/mpp/dist/index.html"
LEBAR = [390, 480, 660, 768, 1024, 1280, 1440]
LAYAR = ["dashboard","organisasi","siklus","planning","usulan","konsolidasi",
         "biaya","review","approved","monitoring","laporan","matriks","bagan","eksekutif","data","admin","audit"]
gagal = total = 0
with sync_playwright() as p:
    b = p.chromium.launch()
    for w in LEBAR:
        pg = b.new_page(viewport={"width": w, "height": 900})
        pg.goto(URL); pg.wait_for_timeout(300)
        FX.lengkap(pg); FX.masuk(pg, "U-OD-01"); pg.wait_for_timeout(200)
        rusak = []
        for l in LAYAR:
            pg.goto(URL + "#" + l); pg.wait_for_timeout(180)
            sw = pg.evaluate("document.documentElement.scrollWidth")
            total += 1
            if sw > w + 1:
                rusak.append(f"{l}:{sw}"); gagal += 1
        print(("GAGAL" if rusak else "PASS ") + f"  lebar {w}" + (f"  [{', '.join(rusak)}]" if rusak else ""))
        pg.close()
    b.close()
print(f"\n{total} pemeriksaan, TOTAL GAGAL: {gagal}")
