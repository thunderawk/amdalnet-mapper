# AMDALNET Mapper

Tool interaktif untuk membuat peta **Titik Pantau, Titik Kelola, Area Pantau,
Area Kelola, dan Tapak Proyek** sesuai format upload amdalnet.menlhk.go.id —
menggantikan alur manual ArcMap di JUKNIS Data Spasial AMDALNET.

## Pakai (paling mudah)

Buka **`AMDALNET-Mapper.html`** dengan double-click (Chrome/Safari/Edge).
Satu file, tidak perlu install apa pun. Butuh internet untuk basemap satelit
& detail wilayah; menggambar, ekspor SHP/PDF, dan pengelolaan proyek tetap
jalan offline.

> Basemap bawaan **Esri World Imagery** (satelit) sesuai JUKNIS; opsi
> **Esri World Street Map** tersedia di layer-control peta (gratis, tanpa
> API key — bukan Google, agar bebas batasan ToS).

## Alur kerja

Stepper 4 langkah: **Profil → Gambar → Validasi → Ekspor**.

1. **Profil** — isi Pemrakarsa, Kegiatan, Tahun, Provinsi, Kabupaten/
   Kecamatan/Desa, Tipe Dokumen. Bisa terisi otomatis dari pencarian wilayah.
2. **Gambar** — pilih layer, lalu Tambah Titik (klik peta), Gambar Area
   (klik sudut, double-click/Enter selesai, Backspace = undo vertex, luas
   live dalam Ha), Paste Koordinat (bulk dari Excel, ada tab konverter
   DD/DMS/DMM/UTM), atau Impor SHP/GeoJSON/CSV (file lama, ZIP quartet,
   atau CSV kolom lon,lat / WKT — CRS terbaca dari .prj).
   - **Info Wilayah**: klik peta → kartu detail administrasi (desa,
     kecamatan, kab/kota, provinsi, kode wilayah) → terapkan ke profil.
3. **Validasi** — cek paket siap upload; masalah bisa diklik untuk zoom ke
   fitur yang bermasalah.
4. **Ekspor** — dialog terpadu: ZIP SHP per layer (+ slot upload AMDALNET),
   PDF peta per layer, ekspor semua, atau ekspor ke folder proyek.

Lengkapi **KODE** & **Keterangan** di tabel data (ada bulk KODE berurutan,
filter/search). Mode gelap/terang: tombol matahari/bulan di header.
Proyek autosave di browser (indikator "Tersimpan otomatis"); tombol
**Backup** mengunduh JSON proyek; hapus fitur bisa di-urungkan via toast.

## Spesifikasi teknis (terverifikasi vs template asli amdalnet)

| Aspek | Titik Pantau/Kelola | Area Pantau/Kelola | Tapak Proyek |
|---|---|---|---|
| Geometri .shp | lon/lat derajat | **meter Web Mercator** (EPSG:3857) | lon/lat derajat |
| Shape type | POINT (1) | **POLYGONZ (15, Z=0)** | POLYGON (5) |
| .prj | EPSG:4326 GEOGCS WGS84 (145B, byte-identik template) | Web Mercator (425B, byte-identik template) | EPSG:4326 GEOGCS WGS84 |
| Skema DBF | **9 field template** (ID terakhir); PEMRAKARSA C50, KEGIATAN C50 | **9 field template** (ID terakhir); PEMRAKARSA C100, KEGIATAN C254 | **8 field**; PEMRAKARSA C254, LUAS N(24,15) |
| LAYER | "Titik Pemantauan" / "Titik Pengelolaan" | "Area Pemantauan" / "Area Pengelolaan" | "TAPAK PROYEK" |
| TIPE_DOKUM | "Amdal" / "UKL-UPL" (di-enforce) | sama | — (tidak ada) |
| ID | field `ID` N10, diisi pengguna (default 0) | field `ID` N10, diisi pengguna (default 0) | field `id` N10, diisi pengguna (default 0) |

Skema Titik & Area mengikuti **template DBF amdalnet** (9 field, urutan
`PEMRAKARSA, KEGIATAN, TAHUN, PROVINSI, KETERANGAN, TIPE_DOKUM, KODE, LAYER, ID`),
bukan urutan 8 kolom JUKNIS. File QGIS yang berhasil tampil di amdalnet memakai
susunan ini, dan join-nya tidak bergantung pada nilai `ID` — `ID = 0` pada semua
fitur tetap terbaca benar. `ID` kini dapat diisi per fitur di UI (hanya angka,
maks. 10 digit); nilai kosong/invalid ditulis `0` dan hanya memunculkan
peringatan.

Skema Tapak Proyek mengikuti file yang **diterima amdalnet** (hardi.*),
yaitu 7 field + `LUAS` N(24,15). Kolom `LUAS` diisi luas ellipsoidal WGS84
dalam hektar (setara `$area/10000` QGIS) dan **ditulis ke DBF** — keputusan
sadar setelah amdalnet menerima field tambahan ini. Field `id` juga diisi
pengguna dengan aturan yang sama (default 0).

**Index .shx** menulis offset record dalam 16-bit word dan **ikut menghitung
header record 8 byte** (offset 100, 128, 156, …). Sebelumnya offset meleset ke
tengah record sebelumnya sehingga ArcGIS/amdalnet menempelkan atribut ke
geometri yang salah (pembaca sekuensial seperti shpjs tidak menampilkan gejala
ini). Bug itu sudah diperbaiki dan dijaga `verifyShpIndex`.

Nilai LAYER selalu mengikuti JUKNIS resmi (daftarnya tampil di panel Profil).
Nama file ZIP/DBF tapak mengikuti template: `tapak-proyek.zip` (huruf kecil).
Ukuran halaman PDF peta: **679 × 401 pt** persis contoh peta tapak
(QGIS), citra peta full-bleed tanpa kop/legenda.

**Verifikasi writer:** `npx tsx scripts/verify-writer.ts` lalu bandingkan
dengan template — ukuran byte, skema field, shape type, geometri (meter vs
template maxdiff 0.000000 m), nilai DBF, dan .prj semuanya identik.
`npx tsx scripts/verify-tapak-export.ts` untuk paket Tapak Proyek.

Referensi regulasi & template asli ada di `reference/` (2 JUKNIS PDF +
template SHP, termasuk Panduan Tapak Proyek v2.5).

**Roadmap** (SHP round-trip penuh, PDF layout formal kop/legenda/skala/grid):
lihat `ROADMAP.md`.

## Development

```
npm install
npm run dev      # development server
npm run build    # -> dist/index.html (single-file, vite-plugin-singlefile)
```

Hasil build disalin ke `AMDALNET-Mapper.html` di root repo (file deliverable).

Stack: Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui (base-nova),
Leaflet (draw custom), shpjs, JSZip, jsPDF + html2canvas/leaflet-image,
sonner. Writer SHP adalah port TypeScript dari `write-gis-layer.py` (skill
gis-amdalnet) dengan tambahan PolygonZ — byte-level endianness & lebar field
DBF dijaga dengan assert (tidak ada truncation senyap).

Data wilayah resmi: [BIG Geoservices](https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH)
(tanpa API key).
