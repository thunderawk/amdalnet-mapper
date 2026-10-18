# Proposal Rebuild Total UI/UX — AMDALNET Mapper

> **Catatan 17 Okt 2026:** Dokumen desain matang yang platform-agnostic kini ada di
> **`DESIGN.md`** (IA, user flows, spesifikasi layar, sistem komponen, design tokens).
> Dokumen ini tersisa sebagai catatan insight & rencana implementasi.

**Dari 0, mengikuti `design.md`** · 17 Okt 2026 · Berdasar `PRD.md` (JUKNIS + template + panduan)

---

## 1. Insight Utama (hasil bedah workflow JUKNIS)

Alur JUKNIS (PRD §7) sebenarnya bukan soal "menggambar layer di peta". Alur mental user adalah:

> **"Saya harus mengisi 5 slot upload. Tiap slot butuh: geometri + atribut lengkap + ZIP + PDF."**

Aplikasi saat ini diorganisir sekitar konsep GIS (*layer*, *draw mode*, *feature table*) — konsep yang dipinjam dari ArcMap, bukan dari kepala user. Akibatnya user harus menerjemahkan sendiri: "layer aktif saya = slot yang mana? sudah siap upload yang mana?"

**Keputusan arsitektur rebuild: aplikasi diorganisir sekitar 5 slot upload amdalnet, bukan sekitar layer GIS.** Setiap slot adalah satu "paket kerja" yang punya status jelas: Kosong → Ada data → Valid → Siap upload.

Ini sekaligus menyelesaikan temuan audit A2 (kebanyakan sistem navigasi): stepper, tab layer, dan tab mobile semuanya digantikan oleh **satu sistem — slot**.

## 2. Arsitektur yang Diusulkan

### 2.1 Layar utama: Dashboard Slot

Bukan peta fullscreen, bukan 3 kolom. Layar pertama adalah **5 kartu slot** — karena pertanyaan pertama user setiap buka aplikasi adalah "yang sudah beres yang mana?"

Tiap kartu menampilkan:
- Nama slot + ikon geometri (point/polygon)
- Status: `Kosong` → `Ada data (n fitur)` → `Ada error (n)` → `Siap upload`
- Progress atribut: berapa fitur yang KODE/KETERANGAN-nya belum diisi
- Tombol aksi kontekstual: `Buka` (kerja) / `Unduh ZIP` + `Unduh PDF` (kalau valid)

Di atas kartu: **strip profil** — 5 atribut profil dengan indikator lengkap/belum. Satu ketuk untuk edit. (Atribut profil adalah "kunci" yang membuka semua slot — harus selalu terlihat.)

### 2.2 Workspace per slot (klik kartu → masuk)

Satu slot = satu ruang kerja fokus:
- **Peta** (dominan): hanya menampilkan geometri slot itu + tapak sebagai referensi redup. Tools gambar kontekstual: slot titik → "Tambah Titik / Paste / Import / Geser"; slot polygon → "Gambar / Paste / Import".
- **Panel atribut** (samping/bottom sheet di HP): daftar fitur slot itu — tiap baris KODE + KETERANGAN + status validasi baris. Ketuk baris → popup edit (KODE + KETERANGAN saja, atribut profil read-only).
- **Bar validasi slot**: daftar error/warning khusus slot ini, klik → zoom ke fitur.
- **Bar ekspor slot**: dua tombol besar — `Unduh ZIP (untuk amdalnet)` dan `Unduh PDF (arsip)`. Terkunci selama ada error, dengan penjelasan.

Keluar workspace → kembali ke dashboard. Tidak ada "layer aktif" global yang harus diingat — konteks selalu = slot yang sedang dibuka.

### 2.3 Navigasi global (ramping)

- **Header minimal**: nama aplikasi + tombol kembali ke dashboard + menu (⋯) berisi Backup JSON / Muat JSON / Proyek Baru / tema. Semua aksi ada di HP (menjawab temuan A3).
- **Tidak ada stepper bar terpisah.** Alur Profil → Gambar → Validasi → Ekspor hidup di dalam tiap slot sebagai penanda progres, bukan navigasi global.

### 2.4 Mobile

Dashboard slot = daftar kartu vertikal (ideal untuk HP). Workspace slot = peta fullscreen + bottom sheet untuk atribut/validasi/ekspor. Semua aksi header tersedia di menu.

## 3. Yang Berubah vs Yang Tetap

**Berubah total (presentasi):** struktur layar, navigasi, organisasi panel, bahasa UI (dari istilah GIS → istilah slot/upload JUKNIS).

**Tetap 100% (mesin):** SHP writer (byte-identik template), skema atribut, logika validasi, perhitungan luas, integrasi BIG (search wilayah, reverse-geocode), konverter koordinat, autosave, import/paste.

## 4. Bahasa UI (contoh)

| Sekarang (istilah GIS) | Usulan (istilah JUKNIS/user) |
|---|---|
| Layer aktif: titik-pantau | Slot: Titik Pantau |
| Draw mode: point | Tambah titik |
| FeatureTable | Daftar titik |
| Export all | Arsip semua (pribadi) |
| ValidationPanel issues | Yang perlu diperbaiki |

## 5. Alternatif yang Dipertimbangkan

- **Evolusi sketsa user** (sidebar accordion 5 konten): ditolak sebagai arsitektur final karena accordion menyembunyikan status — user tidak bisa lihat sekilas slot mana yang siap. Elemen terbaiknya (export pill per konten, popup atribut minimal) **diadopsi** ke dalam kartu slot.
- **Peta fullscreen + floating toolbar** (proposal B sebelumnya): ditolak karena peta fullscreen bagus untuk *menggambar* tapi buruk untuk *menjawab "yang beres yang mana"* — dan pertanyaan itulah yang paling sering.
- **Wizard terpandu per slot**: ditolak — terlalu mengkekang untuk user yang sudah paham alurnya.

## 6. Rencana Implementasi (setelah disetujui)

1. **Fondasi**: restructure state — `activeSlot` menggantikan `activeLayer` sebagai konteks utama; komponen SlotCard + SlotWorkspace.
2. **Dashboard**: 5 kartu slot + strip profil + header ramping.
3. **Workspace**: peta terfilter per slot + panel atribut + validasi per slot + ekspor per slot.
4. **Mobile**: bottom sheet untuk panel workspace.
5. **Migrasi**: hapus Stepper bar, FeatureTable kolom kanan, tab layer global (digantikan slot).
6. **Verifikasi**: build + lint + screenshot desktop & mobile + uji alur penuh 1 slot (gambar → atribut → validasi → ZIP+PDF).

Estimasi: 2–3 sesi kerja fokus. Semua di branch `feat/rebuild-slot-ui`, merge setelah user coba langsung.
