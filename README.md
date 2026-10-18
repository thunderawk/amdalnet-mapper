# AMDALNET Mapper

Tool interaktif untuk membuat peta **Titik Pantau, Titik Kelola, Area Pantau,
Area Kelola, dan Tapak Proyek** sesuai format upload amdalnet.menlhk.go.id —
menggantikan alur manual ArcMap di JUKNIS Data Spasial AMDALNET.

## Pakai (paling mudah)

Buka **`AMDALNET-Mapper.html`** dengan double-click (Chrome/Safari/Edge).
Satu file, tidak perlu install apa pun. Butuh internet untuk basemap satelit
& Info Wilayah; menggambar, ekspor SHP/PDF, dan pengelolaan proyek tetap
jalan offline.

> Basemap: **Esri Satelit** (bawaan, sesuai JUKNIS) atau **Google Satelit** —
> pilih dari kontrol layer kanan atas peta.

## Alur kerja

Sidebar berisi panel **Profil** + 5 konten (Tapak Proyek, Titik Pantau,
Titik Kelola, Area Pantau, Area Kelola); setiap konten bisa dibuka-tutup
(accordion). Layout responsif — di HP sidebar jadi drawer.

1. **Profil** — isi Pemrakarsa, Kegiatan, Tahun, Provinsi, Kabupaten/
   Kecamatan/Desa, Tipe Dokumen. Bisa terisi otomatis dari mode
   **Info Wilayah**: klik peta → kartu detail administrasi (desa, kecamatan,
   kab/kota, provinsi, kode wilayah) → terapkan ke profil.
2. **Isi konten** — buka salah satu konten, pilih mode input lewat tombol
   ikon:
   - **Tambah/Gambar**: titik = klik peta; area = klik tiap sudut,
     double-click/Enter selesai, Backspace = undo vertex, luas live dalam Ha.
   - **Paste**: bulk koordinat dari Excel, ada tab konverter DD/DMS/DMM/UTM.
   - **Impor**: SHP/GeoJSON/KML/CSV (file lama, ZIP quartet, atau CSV kolom
     lon,lat / WKT — CRS terbaca dari .prj).
   Label fitur hanya muncul saat hover (tidak menumpuk di peta). Edit inline
   KODE/Keterangan di tabel data; titik bisa diseret langsung di peta.
3. **Validasi** — cek paket siap upload sebelum ekspor; masalah bisa diklik
   untuk zoom ke fitur yang bermasalah. Tombol ekspor per konten terkunci
   selama masih ada error validasi.
4. **Ekspor** — tiap konten punya pill ekspor **ZIP** (SHP siap upload ke
   amdalnet) dan **PDF** (arsip/preview); footer **Ekspor Semua Konten**
   mengunduh `amdalnet_mapper.zip` (5 folder konten, tiap folder berisi
   ZIP + PDF).

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
| Skema DBF | 9 field; PEMRAKARSA C50, KEGIATAN C50 | 9 field; PEMRAKARSA C100, KEGIATAN C254 | **8 field**; PEMRAKARSA C80, LUAS N(24,15) |
| LAYER | "Titik Pemantauan" / "Titik Pengelolaan" | "Area Pemantauan" / "Area Pengelolaan" | "Tapak Proyek" |
| TIPE_DOKUM | "Amdal" / "UKL-UPL" (di-enforce) | sama | — (tidak ada) |

Skema & geometri Tapak Proyek mengikuti **Panduan Pembuatan Peta Polygon
v2.5 (Juli 2024)** — sengaja berbeda dari layer Area. Field LUAS tidak
ditulis ke SHP (virtual field QGIS: `$area/10000` = hektar); luas
ditampilkan di aplikasi dalam hektar.

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
