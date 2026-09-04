# Menguji aplikasi dijalankan langsung dari disk lewat protokol file://
from playwright.sync_api import sync_playwright
import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent)); import fixture as FX
import pathlib, tempfile, os

BERKAS = [("Satu berkas gabungan", "file:///home/claude/mpp/dist/index.html"),
          ("Struktur modular",     "file:///home/claude/mpp/index.html")]
gagal = []
def cek(n, ok, i=""):
    if not ok: gagal.append(n)
    print(("PASS " if ok else "GAGAL") + "  " + n + (("  [" + str(i) + "]") if (not ok and i) else ""))

unduhan = tempfile.mkdtemp()
with sync_playwright() as p:
    b = p.chromium.launch(downloads_path=unduhan)
    for nama, url in BERKAS:
        print("\n=== " + nama + " ===")
        ctx = b.new_context(accept_downloads=True, viewport={"width":1440,"height":950})
        pg = ctx.new_page()
        galatKonsol = []
        pg.on("console", lambda m: galatKonsol.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: galatKonsol.append(str(e)))
        pg.goto(url); pg.wait_for_timeout(700)

        cek("halaman termuat tanpa galat konsol", len(galatKonsol) == 0, "; ".join(galatKonsol[:2]))
        cek("font terpasang", pg.evaluate("document.fonts ? document.fonts.size > 0 : true"))
        cek("logo tampil", pg.evaluate("!!document.querySelector('.nb-brand img')"))
        cek("satu persona bawaan sebelum unggahan", pg.evaluate("document.querySelectorAll('button[data-user]').length") == 1)
        FX.master(pg); FX.siklus(pg); FX.usulan(pg); pg.evaluate("NBApp.ulang()"); pg.wait_for_timeout(200)
        cek("lima belas persona setelah unggahan", pg.evaluate("document.querySelectorAll('button[data-user]').length") == 15)

        pg.click("button[data-user='U-OD-01']"); pg.wait_for_timeout(400)
        cek("masuk sebagai OD berhasil", "Dashboard" in pg.inner_text("#nbPage"))

        # sessionStorage di file:// sering berperilaku lain, jadi diuji langsung
        simpan = pg.evaluate("""() => { try { sessionStorage.setItem('uji','1');
            const v = sessionStorage.getItem('uji'); sessionStorage.removeItem('uji');
            return v === '1'; } catch(e) { return false; } }""")
        cek("penyimpanan sesi bekerja", simpan)

        # Jalankan siklus penuh
        pg.evaluate("""
          NBStore.ubahStatusSiklus('MPP-2027','OPEN');
          NBStore.rilisSnapshot('MPP-2027','2026-09-01');
          NBStore.keluar(); NBStore.masuk('U-HOD-MKT'); NBStore.kirimSubmission('MPP-2027','D-MKT');
          NBStore.keluar(); NBStore.masuk('U-OD-01');
          NBStore.reviewSubmission('SUB-2027-MKT','ACCEPT',null);
          NBStore.kunciKonsolidasi('MPP-2027');
          NBStore.keluar(); NBStore.masuk('U-MGT-01');
          NBStore.barisReview('MPP-2027').forEach(function(l){ NBStore.putuskanBaris(l.line_item_id,'APPROVE',null,null); });
          NBStore.setujuiMpp('MPP-2027','Uji lokal');
          NBStore.keluar(); NBStore.masuk('U-OD-01'); NBStore.distribusikanAlokasi('MPP-2027');
        """)
        pg.goto(url + "#matriks"); pg.wait_for_timeout(500)
        cek("matriks bulanan tergambar", "Budget" in pg.inner_text("#nbPage"))

        # Unggah berkas CSV lewat dialog berkas sungguhan
        pg.goto(url + "#data"); pg.wait_for_timeout(400)
        pg.select_option("#iJenis", "USULAN"); pg.wait_for_timeout(300)
        pg.set_input_files("#iFile", "/home/claude/mpp/contoh/08-usulan-bergalat.csv")
        pg.wait_for_timeout(700)
        cek("unggah CSV terbaca dari disk", "Pratinjau" in pg.inner_text("#nbPage") or
            "Preview" in pg.inner_text("#nbPage"))
        cek("validasi menolak tujuh baris", "7" in pg.inner_text("#nbPage"))

        # Unduh CSV
        try:
            with pg.expect_download(timeout=6000) as unduh:
                pg.click("button[data-templat='USULAN']")
            nm = unduh.value.suggested_filename
            cek("unduh templat CSV berhasil", nm.endswith(".csv"), nm)
        except Exception as e:
            cek("unduh templat CSV berhasil", False, type(e).__name__)

        # Muat ulang halaman, periksa apakah keadaan bertahan
        pg.goto(url + "#dashboard"); pg.wait_for_timeout(500)
        pg.reload(); pg.wait_for_timeout(700)
        masihMasuk = pg.evaluate("!!(window.NBStore && NBStore.user())")
        cek("sesi bertahan setelah muat ulang", masihMasuk)
        if masihMasuk:
            cek("data siklus bertahan setelah muat ulang",
                pg.evaluate("NBStore.alokasiTerlihat('MPP-2027').length") > 0)

        cek("tidak ada galat konsol sampai akhir", len(galatKonsol) == 0, "; ".join(galatKonsol[:2]))
        ctx.close()
    b.close()

print("\nTOTAL GAGAL: " + str(len(gagal)))
for g in gagal: print(" - " + g)
