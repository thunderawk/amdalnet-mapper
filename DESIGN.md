# DESIGN.md — AMDALNET Mapper

**Sistem desain platform-agnostic** · v1.0 · 17 Okt 2026
Pendamping `PRD.md`. Disusun mengikuti SOP `design.md` (Tahap 0–2: ukuran L, mode Operate).
Dokumen ini mendefinisikan **apa** yang dibangun — independen dari stack (HTML single-file hari ini, web app / native app esok). Tidak ada istilah implementasi di sini selain sebagai contoh.

---

## 1. Prinsip Desain

1. **Slot-based.** Aplikasi mencerminkan 5 slot upload amdalnet (PRD §5), bukan konsep GIS. User berpikir "slot mana yang belum siap", bukan "layer aktif saya apa".
2. **Peta adalah konten.** Layar pertama setiap workspace adalah peta itu sendiri — bukan hero, bukan dashboard berlapis.
3. **Satu konteks dalam satu waktu.** Tidak ada dua sistem navigasi yang bersaing. Di dalam workspace, konteksnya selalu = slot yang sedang dibuka.
4. **Progressive disclosure.** Tampilkan hanya yang relevan dengan status saat ini. Slot kosong → ajak menggambar. Ada error → tampilkan perbaikan. Valid → tampilkan ekspor.
5. **Mobile-first.** Setiap layar dirancang untuk HP dulu, lalu diperluas ke desktop — bukan sebaliknya.
6. **Keputusan eksak & beralasan.** Setiap nilai visual (warna, radius, durasi) punya angka pasti dan alasan. Tidak ada "kira-kira bagus".

---

## 2. Arsitektur Informasi

### 2.1 Inventaris layar

| ID | Layar | Peran |
|---|---|---|
| S1 | Dashboard Slot | Home. Status 5 slot + strip profil sekilas |
| S2 | Slot Workspace | Ruang kerja fokus per slot: peta + atribut + validasi + ekspor |
| S3 | Profil Proyek | Sheet/dialog: 5 atribut profil |
| S4 | Manajemen Proyek | Via menu: Baru / Muat JSON / Backup JSON |

### 2.2 Dialog & sheet

| ID | Nama | Pemicu |
|---|---|---|
| D1 | Popup Atribut | Setelah tambah fitur / ketuk baris fitur |
| D2 | Paste Koordinat | Dari toolbar gambar (+ tab konverter) |
| D3 | Import File | Dari toolbar gambar |
| D4 | Cari Wilayah BIG | Dari peta atau profil |
| D5 | Info Administrasi | Ketuk peta dalam mode info |
| D6 | Konfirmasi Destruktif | Hapus fitur / proyek baru |

### 2.3 Peta navigasi

```
S1 Dashboard ──ketuk kartu──▶ S2 Workspace ──kembali──▶ S1
 │                              │  ▲
 │                              │  │ D1..D6 (modal, kembali ke pemicu)
 ▼                              ▼
S3 Profil (sheet) ◀── dari mana saja
S4 Manajemen (menu) ◀── dari header
```

Tidak ada deep-link antar workspace slot — selalu via dashboard. Ini disengaja: memaksa user melihat status keseluruhan setiap pindah slot.

## 3. User Flows

### F1 — Alur per slot (alur inti, diulang 5×)

```
[Kartu slot: Kosong]
  → ketuk "Mulai" → S2 Workspace (peta kosong + toolbar gambar)
  → gambar / paste / import fitur
  → tiap fitur baru → D1 Popup Atribut (isi KODE + KETERANGAN)
  → [Kartu slot: Ada data] → bar validasi muncul bila ada error
  → perbaiki error (ketuk item → zoom ke fitur)
  → [Kartu slot: Siap upload] → Unduh ZIP → Unduh PDF
  → upload manual di amdalnet (di luar aplikasi)
```

### F2 — Isi profil

```
Strip profil (S1) → ketuk → S3 → isi 5 atribut → simpan
  → semua fitur di semua slot otomatis terisi
  → indikator lebar field: peringatkan jika > batas tersempit (PRD §6.1)
Alternatif: D4 Cari Wilayah BIG → pilih wilayah → provinsi/kab/kec/desa terisi otomatis
```

### F3 — Manajemen proyek

```
Menu header → Baru (konfirmasi D6 bila ada data) / Muat JSON / Backup JSON
Autosave selalu aktif + indikator "Tersimpan otomatis • jam"
```

## 4. Spesifikasi Layar

### S1 — Dashboard Slot

**Tujuan:** menjawab "yang sudah beres yang mana?" dalam < 3 detik.

**Layout (mobile):** header ramping → strip profil → daftar vertikal 5 kartu slot.
**Layout (desktop):** header ramping → strip profil → grid kartu (maksimal 3 kolom, kartu proporsional).

**Strip Profil** (selalu terlihat di S1):
- 5 atribut dalam satu baris ringkas (nama pemrakarsa, kegiatan, tahun, provinsi, tipe dokumen)
- Indikator: `lengkap` / `kurang n` — ketuk untuk membuka S3
- Atribut yang kosong ditampilkan sebagai placeholder mengajak ("Isi nama pemrakarsa")

**Kartu Slot** — anatomi:
1. Baris judul: ikon geometri (point/polygon) + nama slot + badge status
2. Baris status: `n fitur` · `n atribut belum diisi` · `n error` (hanya yang relevan yang tampil)
3. Aksi kontekstual (satu baris, maksimal 2 tombol):
   - Kosong → [Mulai kerjakan]
   - Ada data/error → [Buka] + [Perbaiki n]
   - Siap upload → [Unduh ZIP] + [Unduh PDF]

**Status badge** (4 state, warna semantik §6.1):
- `Kosong` (netral) · `Dikerjakan` (info) · `Perlu diperbaiki` (warning/error) · `Siap upload` (success)

### S2 — Slot Workspace

**Tujuan:** satu tempat untuk menyelesaikan satu slot sampai siap upload.

**Layout (desktop):** peta mengisi ~65–70% lebar + panel samping 30–35% berisi tiga seksi vertikal: Daftar Fitur → Validasi → Ekspor.
**Layout (mobile):** peta fullscreen + bottom sheet dengan tiga tab: Data | Periksa | Ekspor.

**Peta:**
- Hanya menampilkan geometri slot aktif + tapak proyek sebagai referensi redup (bila slot aktif bukan tapak)
- Toolbar gambar kontekstual mengikuti geometri slot: titik → [Tambah Titik] [Paste] [Import] [Geser]; polygon → [Gambar Area] [Paste] [Import]
- Overlay minimal: tombol Info Wilayah, pencarian lokasi, kontrol zoom bawaan peta
- State menggambar: instruksi singkat + statistik live (jumlah vertex, luas ha) + tombol batal/selesai yang jelas

**Daftar Fitur** (per slot):
- Tiap baris: KODE (tebal) + KETERANGAN (satu baris, truncate) + indikator status baris (valid / atribut kurang / error)
- Aksi per baris: ketuk → D1 edit; geser/ikon → zoom ke fitur, hapus (D6)
- Header seksi: `n fitur` + total luas (slot polygon) + tombol bulk KODE
- Empty state: ilustrasi/teks mengajak + tombol aksi langsung ("Gambar area pertama")

**Validasi** (per slot):
- Daftar item: ikon severity + pesan + lokasi (nama fitur/KODE)
- Ketuk item → peta zoom ke fitur yang bermasalah
- Kosong (tidak ada masalah) → tampilkan konfirmasi positif ringkas, bukan panel kosong

**Ekspor** (per slot):
- Dua tombol besar: [Unduh ZIP — untuk upload amdalnet] [Unduh PDF — arsip]
- Label eksplisit bedakan tujuan (menjawab temuan audit B3)
- Terkunci selama ada error — tombol disabled + teks menjelaskan "selesaikan n perbaikan dulu"

### S3 — Profil Proyek

- Form 5 atribut sesuai PRD §6.1
- PROVINSI = dropdown 38 provinsi; TAHUN = input numerik 4 digit; TIPE_DOKUM = pilihan Amdal / UKL-UPL
- Validasi lebar: hitung karakter live, peringatkan saat mendekati/melebihi batas tersempit
- Tombol sekunder: "Isi dari wilayah BIG" → D4

## 5. Sistem Komponen

| Komponen | Anatomi | States |
|---|---|---|
| SlotCard | judul + badge status + ringkasan + aksi | kosong / dikerjakan / perlu diperbaiki / siap upload |
| ProfileStrip | 5 atribut ringkas + indikator | lengkap / kurang |
| FeatureRow | KODE + KETERANGAN + status + aksi | valid / kurang atribut / error / terpilih |
| ValidationItem | ikon + pesan + target | error / warning; ketuk → zoom |
| ExportBar | 2 tombol + label tujuan | aktif / terkunci (ada error) |
| AttributePopup (D1) | atribut profil (read-only) + KODE + KETERANGAN (editable) | — |
| DrawToolbar | tombol kontekstual per geometri | idle / menggambar |
| StatusBadge | label + warna semantik | 4 status slot |
| EmptyState | teks ajakan + tombol aksi | per konteks |
| ConfirmDialog (D6) | pesan + [Batal] [Ya, lanjutkan] | — |

Aturan: satu komponen, satu tanggung jawab. Tidak ada komponen yang tahu tentang slot lain.

## 6. Design Tokens (platform-agnostic)

### 6.1 Warna

**Warna slot** (fungsional — identitas visual tiap slot di peta & kartu; dipertahankan dari sistem berjalan):
- Tapak Proyek: ungu `#7C3AED`
- Titik Pantau: biru `#2563EB`
- Titik Kelola: oranye `#EA580C`
- Area Pantau: teal `#0D9488`
- Area Kelola: amber `#D97706`

**Warna semantik** (status, sama di semua platform):
- Success `#16A34A` · Warning `#D97706` · Error `#DC2626` · Info `#2563EB` · Netral (abu)

**Permukaan & teks:** didefinisikan per tema (terang/gelap):
- Latar utama, latar kartu, garis pembatas, teks primer/sekunder/disabled
- Kontras teks: minimum 4.5:1 untuk teks isi, 3:1 untuk teks besar & batas kontrol

### 6.2 Tipografi

- Keluarga: sans-serif humanis dengan angka tabular untuk data (KODE, koordinat, luas). **Bukan** font default generik tanpa keputusan.
- Skala (px, base 16): 12 / 14 / 16 / 20 / 24 — lima tingkat saja. 12 untuk label bantu, 14 untuk isi, 16 untuk judul seksi, 20/24 untuk angka hero (statistik).
- Berat: reguler (400) isi, medium/semi (500–600) penekanan. Tidak ada light (<400) untuk teks kecil.

### 6.3 Spacing, radius, elevasi

- Basis spacing 4: `4 / 8 / 12 / 16 / 24 / 32`. Tidak ada nilai di antaranya.
- Radius: `6` kontrol kecil, `10` kartu, `full` untuk badge/pill. Aturan bersarang: radius luar = radius dalam + padding.
- Elevasi: bayangan hanya untuk mengangkat (popup, sheet, FAB) — bukan untuk struktur. Struktur pakai garis 1px.

### 6.4 Motion

- Durasi: `150ms` interaksi cepat (tekan, toggle), `300ms` transisi panel/sheet.
- Easing: `cubic-bezier(0.2, 0, 0, 1)` (ease-out).
- Tekan tombol: skala `0.96`.
- Hormati `prefers-reduced-motion`: ganti dengan cross-fade opacity.

## 7. Spesifikasi Peta

- Basemap: citra satelit (Esri World Imagery — sesuai JUKNIS).
- Geometri slot aktif: garis/isi warna slot, cukup kontras di atas citra.
- Tapak sebagai referensi: tampil redup (opacity rendah) di workspace slot lain.
- Fitur terpilih: highlight jelas (outline tebal / warna invert).
- Mode menggambar: kursor crosshair, vertex terlihat, garis bantu, statistik live.

## 8. States & Edge Cases

- **Offline:** tile peta & API BIG tidak bisa dimuat — tampilkan pesan jelas; semua fungsi lokal (gambar, atribut, validasi, ekspor) tetap jalan.
- **Data hilang:** autosave + backup JSON; proyek baru selalu konfirmasi bila ada data.
- **Validasi:** tidak ada state "tidak tahu" — tiap slot selalu bisa menjawab: kosong / dikerjakan / siap.

## 9. Aksesibilitas

- Target sentuh minimum 44×44pt di mobile.
- Semua aksi penting bisa dijangkau keyboard (urutan logis) dengan indikator fokus yang terlihat.
- Status tidak disampaikan lewat warna saja — selalu ada label teks.
- Bahasa UI: Bahasa Indonesia.

---

## Lampiran: Keputusan Desain Tercatat

| Tanggal | Keputusan |
|---|---|
| 17 Okt 2026 | Arsitektur slot-based (bukan layer-based) — dari bedah workflow JUKNIS |
| 17 Okt 2026 | Desain platform-agnostic — HTML hari ini, web/native app tanpa redesign |
| 16 Okt 2026 | Elemen sketsa user yang diadopsi: export pill per konten, popup atribut minimal (KODE+KETERANGAN) |
| 17 Okt 2026 | Nilai LAYER ikut JUKNIS (PRD §5) |
| 17 Okt 2026 | Arah visual terpilih: **C — Sketsa Murni** (ultra-minimal light, warna slot hanya titik kecil). Dikembangkan dari sketsa user, komponen shadcn/ui |
| 17 Okt 2026 | Mode input pakai **tombol ikon** (bukan radio): Tambah / Paste / Impor. Tanpa mode "Geser Titik" |
| 17 Okt 2026 | **Geser Titik masuk ke menu Edit per fitur**: saat edit titik, user bisa seret lokasi di peta + edit KODE/KETERANGAN sekaligus |
| 17 Okt 2026 | **Ekspor Semua Konten** di paling bawah sidebar: satu ZIP `amdalnet_mapper/` berisi 5 folder konten (tapak-proyek, titik-kelola, titik-pantau, area-kelola, area-pantau), tiap folder berisi zip + pdf slot tersebut. Untuk arsip pribadi (upload amdalnet tetap per-layer) |
| 17 Okt 2026 | **Implementasi arah C ke aplikasi** (branch `feat/redesign-arah-c`, belum merge): sidebar Profil + 5 slot accordion, tombol ikon mode input, edit inline + seret titik di peta, export pill ZIP/PDF per slot (validation-gated), footer Ekspor Semua Konten pinned. Stepper + tab mobile + dialog ekspor terpadu dihapus (diganti model slot) |
| 17 Okt 2026 | **Dark mode penuh**: token shadcn `.dark`, toggle di header, persist localStorage, default ikut sistem. Satelit diredup (bukan invert), tooltip peta ikut tema |
| 17 Okt 2026 | **Font IBM Plex Sans + Plex Mono** (sesuai mockup yang disetujui): tabular numerals untuk KODE/koordinat, karakter "dokumen teknis" |
| 17 Okt 2026 | **Accordion ala panel chat**: slot yang terbuka scroll internal (`.acc-inner` overflow-y auto, `visibility` hidden saat tertutup agar tak bisa di-tab), header lain + footer selalu kelihatan |
| 17 Okt 2026 | **Bug writer diperbaiki** (pre-existing, ditemukan saat verifikasi ekspor): `dbfValueBytes`/`buildDbf` menghitung lebar field per char padahal DBF = byte UTF-8 — teks berisi "—"/"é" crash "offset is out of bounds". Kini byte-aware (padding tepat N byte, error jelas bila overflow); `validateProject` cek byte-length PEMRAKARSA/KEGIATAN agar export gate menangkapnya inline |
