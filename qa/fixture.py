# Fixture untuk uji visual di Chromium. Memuat data lewat jalur impor sungguhan,
# sama seperti qa/fixture.js untuk uji jsdom.
import pathlib, json
AKAR = pathlib.Path(__file__).resolve().parent.parent
def _baca(nama): return (AKAR / "contoh" / nama).read_text(encoding="utf-8")

def unggah(pg, user_id, kode, nama, cycle_id=None):
    hasil = pg.evaluate("""([u,k,teks,c]) => {
      NBStore.keluar(); NBStore.masuk(u);
      const p = NBImpor.urai(teks);
      const h = NBStore.terapkanImpor(k, p.baris, c);
      return { ok: h.ok, masuk: h.masuk, galat: (h.galat||[]).length, kunci: h.kunci||null };
    }""", [user_id, kode, _baca(nama), cycle_id])
    if not hasil["ok"] or hasil["galat"]:
        raise RuntimeError(f"impor {nama}: {hasil}")
    return hasil

def master(pg):
    unggah(pg, "U-ADMIN", "ORGANISASI", "00-organisasi.csv")
    unggah(pg, "U-ADMIN", "POSISI", "01-posisi.csv")
    unggah(pg, "U-ADMIN", "KARYAWAN", "02-karyawan.csv")
    unggah(pg, "U-ADMIN", "VACANCY", "03-vacancy.csv")
    unggah(pg, "U-ADMIN", "PENGGUNA", "04-pengguna.csv")
    unggah(pg, "U-CB-01", "ASUMSI", "05-asumsi-biaya.csv")
    pg.evaluate("NBStore.keluar()")

def siklus(pg):
    pg.evaluate("""() => {
      NBStore.keluar(); NBStore.masuk('U-OD-01');
      NBStore.buatSiklus({year:2026,start_date:'2025-09-01',end_date:'2026-12-31',submission_deadline:'2025-10-15'});
      NBStore.ubahStatusSiklus('MPP-2026','OPEN'); NBStore.rilisSnapshot('MPP-2026','2025-09-01');
      NBStore.ubahStatusSiklus('MPP-2026','LOCKED'); NBStore.ubahStatusSiklus('MPP-2026','CLOSED',null);
      NBStore.buatSiklus({year:2027,start_date:'2026-09-01',end_date:'2027-12-31',submission_deadline:'2026-10-15'});
      NBStore.keluar();
    }""")

def usulan(pg):
    pg.evaluate("NBStore.keluar(); NBStore.masuk('U-OD-01'); if ((NBStore.siklus('MPP-2027')||{}).status==='DRAFT') NBStore.ubahStatusSiklus('MPP-2027','OPEN');")
    unggah(pg, "U-OD-01", "USULAN", "06-usulan-mpp.csv", "MPP-2027")
    pg.evaluate("NBStore.keluar()")

def lengkap(pg):
    master(pg); siklus(pg); usulan(pg)

def masuk(pg, user_id):
    pg.evaluate(f"NBStore.keluar(); NBStore.masuk('{user_id}'); NBApp.ulang();")
