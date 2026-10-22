# Roadmap

## Tahap 2 — menunggu keputusan (belum dikerjakan)

Direncanakan setelah tahap 1 (tool inti) & perbaikan UI/import/overlay stabil di
produksi. **Status saat ini:** PDF ekspor sengaja dibuat capture peta polos —
pembuatan title/legenda/skala di-PENDING atas permintaan user.

### 1. Muat ulang proyek lama penuh (round-trip SHP)

**Masalah:** hari ini impor SHP hanya membaca geometri (+ KODE/KETERANGAN bila
ada di DBF). Proyek lama yang sudah pernah dibuat (5 paket ZIP) belum bisa
dimuat ulang utuh.

**Rencana:**
- Impor **paket ZIP lengkap** (semua `Titik Pantau.zip` … `Tapak Proyek.zip` sekaligus)
- Baca `.dbf` tiap layer → petakan otomatis:
  - PEMRAKARSA/KEGIATAN/TAHUN/PROVINSI/TIPE_DOKUM yang konsisten → isi **profil proyek**
  - KODE/KETERANGAN → atribut tiap fitur
  - LAYER → tentukan layer tujuan tiap file (cocokkan dengan `fileName`)
- Deteksi duplikat: fitur yang sama persis (geometri + KODE) tidak diimpor ganda
- Pratinjau sebelum impor: "ditemukan 5 layer, 16 fitur, profil: PT X — muat?"

**Teknis:** `shpjs` sudah terpakai di `src/lib/import.ts`; tambahkan mode
`importPackage(zipFile)` yang mengembalikan `{ profile, features[] }` lalu
`sanitizeProject` menerima hasilnya. Uji round-trip: export → impor → export
lagi, byte identik (kecuali tanggal DBF).

### 2. PDF layout formal (kop, legenda, skala, grid)

**Masalah:** PDF sekarang = capture peta polos (title/legenda di-pending).
Belum seperti peta resmi lampiran AMDAL.

**Rencana komponen PDF (A4 landscape):**
- **Kop** — judul "PETA <LAYER>", nama kegiatan, pemrakarsa, tahun, provinsi,
  tipe dokumen; garis pemisah ganda
- **Grid koordinat** — garis bantu lat/lon dengan label di tepi peta (derajat)
- **Skala** — scale bar geodesic (dihitung dari zoom + latitude, bukan statis)
- **North arrow** + **legenda** simbol per kategori KODE
- **Tabel ringkasan** fitur (KODE, keterangan, luas m² untuk area)
- **Footer** — "Dibuat dengan AMDALNET Mapper", tanggal, slot upload amdalnet

**Teknis:** jsPDF sudah terpasang. Grid & scale bar digambar manual di canvas
atas renderer Leaflet sebelum `leaflet-image` meng-capture, supaya ikut di PDF.

### 3. Kandidat lainnya (prioritas rendah)

- **Geocode alamat** (Nominatim) untuk menemukan lokasi dari nama jalan/desa
- **Edit vertex** fitur existing (drag titik sudut) — saat ini hanya gambar & hapus
- **Template profil** — simpan pemrakarsa/kegiatan berulang untuk dipakai ulang
- **Multi-ring polygon** (lubang/tambalan) — sekarang hanya outer ring
- **Ekspor KML** untuk lampiran non-amdalnet

## Tahap 3 — studi ruangkita.net (kandidat adopsi, perlu riset endpoint)

Dipelajari 15 Okt 2026 dari https://ruangkita.net/ (platform geo Indonesia:
GeoOSS, GeoPortal Hub, GeoFarm). Yang relevan untuk alur AMDAL/UKL-UPL:

### Prioritas tinggi

1. **Batas administrasi RESMI (BIG/SatuPeta) sebagai alternatif Overpass.**
   Overlay batas kita sekarang dari OSM (Overpass) — tidak selalu lengkap/resmi
   untuk desa di beberapa daerah. ruangkita memakai batas resmi BIG (GeoJakarta
   sampai level RT; Geoportal DIY). Rencana: tambah sumber overlay batas dari
   ArcGIS REST/WFS resmi (geoportal.big.go.id / Ina-Geoportal) di panel Overlay,
   berdampingan dengan OSM. **Perlu riset:** endpoint & stabilitas layanan.

2. **Cek NIB / bidang tanah (GISTARU ATR/BPN).** ruangkita mencari bidang tanah
   dari NIB via WFS GISTARU. Untuk kita: input NIB → tampilkan polygon persil →
   bisa dipakai sebagai **sumber batas Tapak Proyek** (lebih sah daripada gambar
   manual). Menjawang kebutuhan umum: tapak sering sudah punya data bidang resmi.
   **Perlu riset:** endpoint WFS GISTARU + autentikasi.

3. **Overlay LBS/LSD (Lahan Baku Sawah & Lahan Sawah Dilindungi, BIG 1:50.000).**
   Screening cepat: apakah tapak beririsan dengan lahan pertanian terlindungi —
   isu hukum yang sering muncul di kajian AMDAL perumahan. Sangat relevan untuk
   penempatan titik/area kelola-pantau.

### Prioritas sedang

4. **DEMNAS (BMKG) — overlay kemiringan lereng/hillshade.** Mendukung penilaian
   laju erosi (kategori dampak "A" yang sudah ada di tool) dan penempatan titik
   pantau erosi. ruangkita memakai DEMNAS untuk slope lahan.

5. **Tutupan lahan KLHK 2020→2024 (via BNPB).** Pendukung peta rona awal:
   melihat perubahan tutupan lahan sebelum/sesudah rencana kegiatan.

6. **SLS Desa (BPS) — batas RT/RW/dusun.** Relevan untuk dampak sosial di RKL-RPL
   (pemukiman terdampak). Prioritas lebih rendah.

### Pola UX yang layak ditiru (tanpa integrasi data)

- **Panduan SHP quartet inline** di UI impor — ruangkita melakukan ini dengan
  baik ("Berkas SHP bukan satu berkas… zip folder, nama berkas sama persis").
  Tool kita sudah punya panduan serupa; pertahankan & pertajam.
- **Disclaimer sumber data** — "hasil screening, bukan keputusan izin"; batas
  dari OSM bukan batas resmi. Terapkan pada panel overlay kita.
- **Mode Otomatis vs Mandiri** (pilih tanggal citra) — bisa ditiru untuk PDF
  capture: pilih zoom/area tangkap sebelum ekspor.
- **Atribusi sumber yang konsisten** di setiap layer (sudah kita punya).

### Catatan

- Semua butuh riset endpoint & izin akses lebih dulu — jangan dijanjikan ke
  user sebelum layanan sumber terbukti stabil.
- Nilai tambah terbesar: **NIB→batas tapak** dan **LBS/LSD screening** — dua
  ini menyentuh kebutuhan inti penyusun AMDAL, bukan sekadar "peta cantik".

## Riset endpoint Tahap 3 — hasil verifikasi (16 Okt 2026)

1. **Batas administrasi resmi BIG — VERIFIED LIVE (16 Okt 2026).**
   - Endpoint: `https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH`
     (ArcGIS REST, tanpa registrasi, tanpa API key; direktori service
     terverifikasi merespons hari ini).
   - Service aktif: `Administrasi_AR_KabKota_50K` (1:50.000),
     `Administrasi_AR_Kecamatan_10K`, `Administrasi_AR_KelDesa_10K`,
     `BATAS_WILAYAH`, plus paket regional RBI 25K per wilayah.
   - Integrasi: pola ArcGIS REST standar (`.../MapServer/tile/{z}/{y}/{x}`
     atau `/export`) — siap ditambahkan ke panel Overlay sebagai alternatif
     resmi di samping Overpass OSM (terutama level desa yang di OSM sering
     tidak lengkap).
   - Catatan: `idnland.big.go.id` sudah mati (DNS tidak resolve) — jangan dipakai.

2. **NIB → bidang tanah — koreksi: ini BHUMI, bukan GISTARU.**
   - Pencarian NIB publik tersedia di UI web: `https://bhumi.atrbpn.go.id/peta`
     → "Pencarian Bidang (NIB/HAK)": isi kab/kota + desa/kelurahan + NIB →
     bidang tampil di peta beserta info luas & status. Tanpa signup.
     (Alur manual ini bisa dipakai user hari ini.)
   - GISTARU (`gistaru.atrbpn.go.id`) adalah sistem KKPR/tata ruang,
     bukan pencarian bidang — asumsi awal roadmap perlu dikoreksi.
   - Tile service di balik Bhumi (`bhumi.atrbpn.go.id/mapproxy/wmts`)
     **menolak akses langsung tanpa autentikasi dari luar (HTTP 403,
     diverifikasi 3x pada 16 Okt 2026, homepage Bhumi normal)**. Kemungkinan
     dibatasi IP/whitelist (perlu dicek dari IP Indonesia, mis. VPS user).
     Status: BELUM SIAP dijadikan overlay Leaflet — jangan dijanjikan
     sampai ada verifikasi akses yang berhasil.

3. **LBS/LSD — BELUM ADA layanan publik stabil (16 Okt 2026).**
   - Peta LSD masih rollout nasional: 12 provinsi difinalisasi Mar 2026,
     17 provinsi ditargetkan selesai (pernyataan Wamen ATR/BPN, Okt 2026).
   - Tidak ditemukan WMS/WFS publik untuk overlay LBS/LSD.
   - Keputusan: PARKIR sampai layanan resmi dipublikasikan; sementara cek
     manual via portal Bhumi/ATR.

4. **DEMNAS — koreksi: produk BIG, bukan BMKG.**
   - Sumber: `https://tanahair.indonesia.go.id/demnas/` — unduh GeoTIFF per
     lembar peta, resolusi 0,27 arc-second (~8,1 m).
   - Tidak ada layanan tile/hillshade publik terverifikasi untuk overlay
     langsung di Leaflet — butuh pra-pemrosesan (unduh → konversi ke tiles).
     Prioritas sedang, belum plug-and-play.

Prinsip tetap: jangan janjikan ke user sebelum layanan sumber terbukti stabil
— poin 1 lolos, poin 2–4 belum.

## Audit JUKNIS (15 Okt 2026) — ringkasan hasil

Proyek diaudit langsung terhadap 2 JUKNIS PDF + 4 template SHP contoh
(`reference/peta-amdalnet/`). Yang sudah sesuai: skema 9 field (urutan & lebar
PERSIS template), shape type (Titik=POINT derajat, Area=POLYGONZ meter Web
Mercator), .prj byte-identik template, .cpg UTF-8, penamaan ZIP/file
("Titik Kelola"/"Titik Pantau", "Area Kelola"/"Area Pantau"), nilai TIPE_DOKUM
("Amdal"/"UKL-UPL"), KETERANGAN wajib diisi, luas area geodesic (~setara hitung
UTM di JUKNIS).

Perbaikan yang diterapkan (15 Okt 2026):
1. **Konflik nilai LAYER untuk layer Area**: teks JUKNIS menulis "Area
   Pengelolaan"/"Area Pemantauan", tapi contoh template unduhan amdalnet menulis
   "Lokasi Pengelolaan"/"Lokasi Pemantauan" (titik: keduanya sama). Keputusan
   (18 Okt 2026): **selalu pakai nilai JUKNIS** — tidak ada varian template
   amdalnet. Nilai yang di-eksport: "Titik Pemantauan", "Titik Pengelolaan",
   "Area Pemantauan", "Area Pengelolaan", "Tapak Proyek".
2. **Ekspor per-layer (ZIP & PDF) kini dikunci validasi**: sebelumnya ekspor
   "Export Semua" dikunci tapi ekspor per-layer bisa jalan dengan profil kosong
   (PEMRAKARSA kosong, TAHUN=0) — sekarang error validasi profil/layer aktif
   memblokir ekspor.
3. **Peringatan KODE duplikat** dalam satu layer (template amdalnet selalu unik:
   U1, U2, …).

Catatan untuk keputusan user: layer **Tapak Proyek** tidak didefinisikan JUKNIS
(nilai LAYER "Area Tapak Proyek" adalah default kerja tool); slot upload tapak
di amdalnet perlu dikonfirmasi saat uji upload pertama. PDF masih capture peta
polos — layout formal tetap di Tahap 2 (pending).

## Perbaikan lanjutan (15 Okt 2026, atas permintaan user)

1. **Satu basemap saja**: pilihan basemap dihapus; peta kini hanya memakai citra
   satelit Esri World Imagery — sesuai contoh JUKNIS & pratinjau amdalnet
   (kontrol layers hanya berisi overlay 5 layer).
2. **Bug PDF kosong** (terverifikasi via uji browser): `leaflet-image` tidak
   menggambar path SVG (circleMarker/polygon), dan `html2canvas` 1.4.1 tidak
   me-render inline SVG — keduanya menghasilkan PDF berisi citra satelit saja.
   Solusi: `captureComposited()` di `src/lib/export.ts` — tile satelit digambar
   satu per satu (crossOrigin + Esri `Access-Control-Allow-Origin: *`
   terverifikasi via curl), lalu `<svg>` overlay Leaflet diserialisasi
   (XMLSerializer → blob URL → Image) dan digambar di atasnya pada posisi
   getBoundingClientRect yang sama. Fallback: html2canvas, lalu leaflet-image.
   Kontrol peta & tooltip disembunyikan selama capture agar PDF bersih.
3. Menunggu contoh output PDF dari user untuk penyesuaian layout tahap 2.

## Catatan teknis untuk eksekutor

- Writer SHP **tidak boleh diubah** tanpa menjalankan ulang verifikasi:
  `npx tsx scripts/verify-writer.ts /tmp/out` + bandingkan vs template asli
  (ukuran byte, skema field, shape type, meter maxdiff 0.000000, .prj byte-identik).
- Semua perubahan UI mengikuti pola shadcn base-nova + Tailwind v4 yang ada.
- Build deliverable: `npm run build` → `dist/index.html` → copy ke
  `AMDALNET-Mapper.html` (sudah di-gitignore, regenerasi selalu dari source).
