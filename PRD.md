# PRD — AMDALNET Mapper

**Product Requirements Document** · v1.0 · 17 Okt 2026
Disusun dari: 2 JUKNIS Data Spasial Amdalnet, Panduan Tapak Proyek v2.5 (Jul 2024), 4 template SHP resmi amdalnet, dan verifikasi upload langsung di amdalnet.

---

## 1. Ringkasan

AMDALNET Mapper adalah tool web single-file yang menggantikan alur manual ArcMap/QGIS untuk membuat **peta Titik & Area Kelola/Pantau + Tapak Proyek** dalam format **SHP (ZIP) + PDF** yang siap upload ke `amdalnet.menlhk.go.id`. JUKNIS dan template resmi amdalnet adalah hukum — setiap output diaudit byte-level terhadap keduanya.

## 2. Masalah yang Diselesaikan

Alur manual per JUKNIS menuntut konsultan untuk: download template SHP per slot → copy-paste fitur di ArcMap → **ketik atribut satu per satu** → set CRS → hitung luas via zona UTM → export PDF → ZIP → rename file → upload. Proses ini lambat, rawan salah ketik atribut, dan butuh lisensi GIS desktop. Mapper mengotomasi semuanya di browser, termasuk di HP.

## 3. Pengguna

Konsultan AMDAL/UKL-UPL (contoh: GTR). Mobile-first — sering bekerja dari HP, tidak selalu di depan laptop. Memahami konsep RKL-RPL, titik/area kelola & pantau, tapi bukan operator GIS.

## 4. Tujuan & Non-Tujuan

**Tujuan:**
- Menghasilkan 5 paket upload (ZIP SHP + PDF peta) yang lolos validasi amdalnet di percobaan pertama.
- Mengisi atribut otomatis sebisa mungkin — user hanya mengetik yang benar-benar unik per fitur.
- Desain bersifat **platform-agnostic**: didefinisikan sebagai sistem (IA, flows, komponen, tokens), bukan sebagai tampilan HTML. Implementasi saat ini adalah single-file HTML; harus bisa berevolusi ke web app atau native app tanpa redesign ulang.

**Non-tujuan:**
- Bukan pengganti amdalnet — upload tetap dilakukan di situs amdalnet.
- PDF yang dihasilkan adalah arsip/preview; amdalnet me-render PDF petanya sendiri dari SHP yang diupload.
- Tidak mengimpor paket SHP proyek lama multi-layer (roadmap).

## 5. Lima Konten Peta (Slot Upload)

Amdalnet punya **5 slot upload**, masing-masing butuh **1 ZIP (SHP) + 1 PDF**:

| # | Slot di amdalnet | Geometri | Nama file | Atribut LAYER |
|---|---|---|---|---|
| 1 | Peta Tapak Proyek | Polygon | `tapak-proyek` | `Tapak Proyek` |
| 2 | Titik Kelola | Point | `Titik Kelola` | `Titik Pengelolaan` |
| 3 | Titik Pantau | Point | `Titik Pantau` | `Titik Pemantauan` |
| 4 | Peta Lokasi Pengelolaan (Area Kelola) | Polygon | `Area Kelola` | `Area Pengelolaan` |
| 5 | Peta Pemantauan (Area Pantau) | Polygon | `Area Pantau` | `Area Pemantauan` |

Catatan LAYER area: JUKNIS menulis "Area Pengelolaan"/"Area Pemantauan", template resmi menulis "Lokasi Pengelolaan"/"Lokasi Pemantauan". **Keputusan user (17 Okt 2026): tetap pakai nilai JUKNIS** — validator amdalnet terbukti longgar soal penamaan LAYER (tapak `Tapak Proyek` title-case diterima padahal kanonisnya `TAPAK PROYEK` kapital).

## 6. Matriks Atribut (Inti PRD Ini)

Sumber: tabel atribut JUKNIS hlm. 16/18 + struktur DBF template resmi. **Lebar field mengikuti template (yang tersempit mengikat).**

### 6.1 Atribut profil (dibagikan — diisi sekali, dipakai semua layer)

| Atribut | Arti (JUKNIS) | Batas lebar | Catatan |
|---|---|---|---|
| PEMRAKARSA | Nama pemrakarsa | ≤ 50 char | Template titik C(50) adalah yang tersempit |
| KEGIATAN | Nama rencana usaha/kegiatan | ≤ 50 char | Template titik C(50) adalah yang tersempit |
| TAHUN | Tahun rencana usaha/kegiatan | 4 digit angka | N(4) di titik & area; **teks** di tapak |
| PROVINSI | Nama provinsi lokasi | ≤ 50 char | Dropdown 38 provinsi |
| TIPE_DOKUM | Tipe dokumen lingkungan | `Amdal` / `UKL-UPL` | **Tidak ada di tapak** |

### 6.2 Atribut per fitur (diketik user)

| Atribut | Arti (JUKNIS) | Batas | Berlaku |
|---|---|---|---|
| KODE | Kode titik/area lokasi kelola-pantau, cth: `AP1`, `U1`, `IPAL` | ≤ 50 char | Titik & area. **Tidak ada di tapak** (panduan tapak v2.5 tidak mengenal KODE) |
| KETERANGAN | Nama lokasi + jenis dampak yang dikelola/dipantau | ≤ 254 char | Semua layer |

### 6.3 Atribut otomatis (user tidak mengisi)

| Atribut | Nilai | Berlaku |
|---|---|---|
| LAYER | Lihat tabel §5 | Semua layer |
| ID / id | Nomor urut | Semua layer |
| LUAS | Luas ellipsoidal WGS84 dalam hektar (N(24,15)) | **Tapak saja** |

### 6.4 Skema DBF per layer (urutan & lebar persis template)

**Titik Kelola & Titik Pantau** — 9 field:
`PEMRAKARSA C(50) | KEGIATAN C(50) | TAHUN N(4,0) | PROVINSI C(50) | KETERANGAN C(254) | TIPE_DOKUM C(50) | KODE C(50) | LAYER C(50) | ID N(10,0)`

**Area Kelola & Area Pantau** — 9 field:
`PEMRAKARSA C(100) | KEGIATAN C(254) | TAHUN N(4,0) | PROVINSI C(50) | KETERANGAN C(254) | TIPE_DOKUM C(50) | KODE C(50) | LAYER C(50) | ID N(10,0)`

**Tapak Proyek** — 8 field:
`id N(10,0) | PEMRAKARSA C(80) | KEGIATAN C(254) | TAHUN C(254) | PROVINSI C(254) | KETERANGAN C(254) | LAYER C(254) | LUAS N(24,15)`

CRS semua layer: WGS 84 (derajat, EPSG:4326) — byte-identik `.prj` template.

### 6.5 Aturan ZIP & PDF per JUKNIS

- ZIP berisi file-file SHP (`.shp` + `.shx` + `.dbf` wajib ada tepat satu; `.pdf`/`.xml` di dalam ZIP = ditolak; `.prj`/`.cpg` diabaikan).
- Nama file ZIP & isi disesuaikan layer: `Titik Kelola`, `Titik Pantau`, `Area Kelola`, `Area Pantau`, `tapak-proyek`.
- PDF peta: satu PDF per slot, diupload di input pasangannya.
- Batas 10 MB hanya di grup Tapak.

## 7. Alur Kerja JUKNIS (yang Digantikan Aplikasi)

1. Login amdalnet → Kegiatan → Daftar Kegiatan → RKL-RPL → tab Peta.
2. Download contoh SHP per slot ("Download Contoh Shp").
3. Di ArcMap/QGIS: masukkan geometri ke template, **isi atribut manual per baris**.
4. Set CRS (WGS 84 World Mercator; zona UTM sesuai lokasi untuk hitung luas).
5. Export peta ke PDF.
6. ZIP file-file SHP, rename sesuai layer.
7. Upload ZIP + PDF per slot → klik "Unggah Peta".

Aplikasi menggantikan langkah 2–6 sepenuhnya. Langkah 1 & 7 tetap di amdalnet.

## 8. Alur Kerja di Aplikasi

1. **Profil** — isi 5 atribut profil (PEMRAKARSA, KEGIATAN, TAHUN, PROVINSI, TIPE_DOKUM). Sekali di awal; otomatis mengisi semua fitur.
2. **Gambar** — per slot: tambah titik / gambar polygon / paste koordinat / import file. Setiap fitur baru langsung terisi atribut profil; user hanya mengetik KODE + KETERANGAN (tapak: KETERANGAN saja).
3. **Validasi** — otomatis & bisa diklik untuk zoom ke masalahnya. Ekspor dikunci selama ada error.
4. **Ekspor** — per slot: unduh ZIP (untuk upload) + PDF (arsip). Paket "semua" hanya untuk arsip pribadi.

Fitur pendukung: cari lokasi (Nominatim), cari wilayah resmi BIG + gambar batas otomatis + isi profil otomatis (provinsi/kabupaten/kecamatan/desa), klik peta → info administrasi (reverse-geocode BIG), konverter koordinat, ukur jarak/luas, undo hapus, autosave + backup JSON.

## 9. Persyaratan Fungsional (ringkas per modul)

- **Profil:** form 5 atribut + dropdown 38 provinsi; validasi lebar field (peringatkan jika melebihi C50 tersempit).
- **Peta:** basemap Esri World Imagery; 5 layer dengan warna khas; draw point/polygon dengan undo vertex + luas live (ha); geser titik; klik fitur → popup.
- **Input data:** paste koordinat (dengan konverter DD/DMS/DMM/UTM), import file (SHP/GeoJSON/KML/GPX), bulk KODE berurutan.
- **Atribut:** popup setelah tambah fitur — atribut profil read-only, hanya KODE + KETERANGAN editable.
- **Validasi:** cek kelengkapan profil, geometri valid, KODE unik per layer, KODE terisi (non-tapak); klik issue → pindah layer + zoom.
- **Ekspor:** ZIP per slot (skema byte-identik template) + PDF peta per slot; gate: tidak bisa ekspor jika ada error validasi.
- **BIG:** search wilayah resmi (provinsi→desa) + gambar batas; reverse-geocode klik → kartu admin → isi profil.

## 10. Persyaratan Non-Fungsional

- **Platform-agnostic by design.** Semua keputusan desain (IA, flows, komponen, tokens) didefinisikan independen dari stack implementasi — lihat `DESIGN.md`. Implementasi *saat ini* adalah satu file HTML mandiri yang dibuka langsung di browser; evolusi ke web app / native app tidak boleh menuntut redesign.
- Mobile-first: semua alur inti bisa dikerjakan dari HP.
- SHP writer terverifikasi byte-identik terhadap template resmi (skema DBF, `.prj`, `.cpg`, penamaan ZIP).
- Tidak ada improvisasi diam-diam saat JUKNIS dan template konflik — konflik diekspos atau ditanyakan.
- Data proyek tersimpan lokal (autosave); tidak ada backend wajib.

## 11. Keputusan yang Sudah Ditetapkan User

- Nilai LAYER ikut JUKNIS (bukan template) — 17 Okt 2026.
- Tapak: skema 8-field (ada LUAS tersimpan) dipertahankan — terbukti diterima amdalnet.
- Nama file tapak: `tapak-proyek` (terbukti diterima).
- ZIP "export semua" = arsip pribadi; upload ke amdalnet tetap per-slot.
- GitHub flow: branch per perubahan, commit Bahasa Indonesia, build+lint+verifikasi bersih sebelum merge.

## 12. Kriteria Sukses

- 5 paket ZIP lolos validasi upload amdalnet di percobaan pertama.
- User hanya mengetik: 5 atribut profil (sekali) + KODE/KETERANGAN per fitur. Sisanya otomatis.
- Seluruh alur inti selesai dari HP tanpa buka laptop.
