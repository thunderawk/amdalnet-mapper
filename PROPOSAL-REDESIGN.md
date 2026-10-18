# Audit UI/UX + Proposal Redesign — AMDALNET Mapper

Tanggal: 17 Okt 2026 · Mengikuti SOP `design.md` (Tahap 0–2) · Ukuran: **L (Besar)** · Mode: **Operate**

---

## TAHAP 0 — INTAKE

**Produk:** AMDALNET Mapper — tool web single-file untuk membuat peta Titik/Area Kelola/Pantau + Tapak Proyek dalam format SHP/PDF siap upload amdalnet.menlhk.go.id. Menggantikan alur manual ArcGIS.

**User:** Konsultan AMDAL/UKL-UPL (GTR). Mobile-first, sering kerja dari HP via WhatsApp, tidak selalu di depan laptop.

**Layar pertama = peta itu sendiri.** User datang untuk: lihat peta satelit → pilih layer → gambar titik/area → isi atribut → validasi → ekspor. Peta adalah konten, bukan dekorasi.

**Peer terbaik:** ruangkita.net (web-GIS publik Indonesia — sudah diriset: peta full-screen, floating toolbar, bottom sheet mobile), ArcGIS Online, QGIS.

---

## TAHAP 1 — HASIL AUDIT

### 🔴 A. Arsitektur Informasi (masalah terbesar)

**A1. Desain yang sudah disetujui user belum diimplementasikan.**
16 Okt: user menggambar sketsa tangan sendiri → mockup direvisi persis mengikuti sketsa → desain final disepakati:
- Sidebar kiri dengan accordion: Profil + 5 konten peta (tapak, titik pantau, titik kelola, area pantau, area kelola)
- Radio mode input per layer (Tambah Titik / Paste / Import / Geser)
- Daftar fitur inline per layer (KODE + keterangan, pill edit/hapus)
- Baris Ekspor per layer dengan pill zip/pdf langsung di sidebar
- Popup atribut minimal: hanya KODE + KETERANGAN yang bisa diedit

Yang ada sekarang: layout 3 kolom (profil | peta | data) + stepper + tab mobile. **Sketsa ≠ implementasi.** Ini temuan paling kritis.

**A2. Terlalu banyak sistem navigasi yang berebut perhatian.**
- Stepper: Profil → Gambar → Validasi → Ekspor
- Tab layer: 5 layer di atas peta (desktop) / dropdown (mobile)
- Tab mobile: Peta / Profil / Data / Validasi
- Kolom desktop: kiri (profil + validasi), tengah (peta), kanan (data)
- "Gambar" (stepper) = "Peta" (tab mobile) = kolom tengah — **tiga nama untuk satu hal**
- Step "Ekspor" tidak pernah bertanda selesai (`ekspor: false` hardcoded)
- Klik stepper menyorot seluruh kolom dengan ring — noisy, bukan fokus

**A3. Header 56px terlalu penuh.**
5 tombol (Backup, Muat, Baru, Ekspor, theme) + badge kegiatan + teks autosave. Di mobile, Backup/Muat/Baru **disembunyikan total tanpa alternatif** — user HP tidak bisa backup, muat, atau mulai proyek baru.

### 🟡 B. Alur Kerja

**B1. Layer adalah konsep sentral, tapi identitasnya lemah.**
Seluruh state (draw mode, tabel, ekspor) digerakkan `activeLayer`, tapi penandanya cuma tab kecil / dropdown. User harus ingat "saya lagi di layer apa" dari badge kecil.

**B2. Tabel data terpisah dari konteks peta.**
FeatureTable di kolom kanan (desktop) / tab terpisah (mobile). Edit atribut = pindah konteks. Sketsa user menempatkan daftar fitur inline di accordion per layer — lebih dekat dengan apa yang dilihat di peta.

**B3. Terlalu banyak pintu masuk ekspor.**
Tombol Ekspor di header + tombol ekspor di FeatureTable + ExportDialog (per-layer + semua + folder) + FolderExportDialog. User harus paham bedanya: ZIP per-layer (untuk upload amdalnet) vs paket "export semua" (arsip pribadi) vs ekspor ke folder. Pembedanya belum eksplisit di UI.

### 🟡 C. Visual / Polish

**C1. Pola "dashboard generik".**
`bg-muted/30` di root, setiap panel dibungkus Card dengan rounded & border default shadcn. Tidak ada keputusan visual yang khas — terlihat seperti template, bukan tool yang dirancang.

**C2. Overlay peta menumpuk.**
Badge layer + tombol Info Wilayah (kiri atas), pencarian lokasi (tengah atas, hidden di mobile = fitur tidak ada di HP), instruksi draw, kartu admin, tombol "Selesai menggambar" (bawah tengah). Perlu diverifikasi dari screenshot seberapa padat kenyataannya.

**C3. Inkonsistensi mobile vs desktop.**
Dua sistem berbeda untuk hal yang sama: Tabs vs dropdown untuk layer; tab panel vs kolom untuk navigasi. Dropdown layer di mobile menyembunyikan count per layer — user tidak bisa lihat sekilas layer mana yang sudah ada datanya.

### 🟢 D. Yang Sudah Bagus (pertahankan apa pun arahnya)

- Autosave + indikator "Tersimpan otomatis"
- Undo hapus via toast
- Validasi bisa diklik → zoom ke fitur
- Konsep stepper sebagai pemandu alur (eksekusinya yang perlu dirapikan)
- Empty state di tabel
- Info Wilayah / reverse-geocode BIG — differentiator kuat, pertahankan & tonjolkan
- Cari wilayah BIG + gambar batas otomatis + isi profil otomatis

---

## TAHAP 2 — TIGA ARAH DESAIN

### Arah A — "Sesuai Sketsa" (faithful execution)

Implementasi persis sketsa tangan user yang sudah disetujui 16 Okt:
- **Sidebar kiri accordion**: Profil (paling atas) + 5 konten peta, masing-masing bisa dibuka-tutup
- **Radio mode input** per layer: titik → Tambah Titik / Paste Koordinat / Import file / Geser Titik; polygon → Gambar Polygon / Paste Koordinat / Import file
- **Daftar fitur inline** per layer: baris KODE + keterangan, pill edit/hapus
- **Baris Ekspor per layer** langsung di sidebar: pill zip + pill pdf
- **Popup atribut minimal** setelah tambah/import/selesai gambar: atribut profil read-only, hanya KODE + KETERANGAN bisa diedit (tapak: KETERANGAN saja)
- Peta mengisi sisa layar kanan. Mobile: sidebar jadi bottom sheet
- Stepper dipertahankan tapi disederhanakan (jadi penanda progres, bukan sistem navigasi kedua)

**Kelebihan:** sudah disetujui user sendiri; risiko terendah; tercepat dieksekusi.
**Kekurangan:** tidak mengeksplorasi kemungkinan yang lebih baik.

### Arah B — "Peta Full-Screen" (gaya ruangkita)

- **Peta mengambil seluruh viewport.** Peta adalah konten utama — sesuai prinsip "layar pertama = konten".
- **Floating toolbar kiri**: switcher 5 layer (dengan badge count — selalu terlihat layer mana ada datanya), tools gambar kontekstual mengikuti layer aktif
- **Panel geser kanan / bottom sheet** (mobile): Profil, Data layer aktif, Validasi — dibuka sesuai kebutuhan, tidak makan tempat permanen
- **Header diringkas total**: judul + tombol Ekspor + menu (⋯) berisi Backup/Muat/Baru/theme — semua aksi tetap ada di mobile
- Stepper menjadi indikator progres minimal menyatu di toolbar, bukan bar terpisah

**Kelebihan:** ruang gambar maksimal (penting untuk presisi titik/area); pola mobile-native; satu sistem navigasi layer yang selalu terlihat.
**Kekurangan:** perubahan paling besar; panel geser butuh implementasi yang rapi agar tidak mengganggu.

### Arah C — "Satu Command Bar"

- **Header + stepper + tab layer digabung** jadi satu command bar ramping: [Layer aktif ▾] [Mode: Setup | Gambar | Periksa | Ekspor]
- Satu tempat menjawab "saya lagi ngapain" — tidak ada lagi 3 nama untuk hal yang sama
- **Panel kanan kontekstual**: isinya mengikuti mode aktif (mode Gambar → tools + daftar fitur layer aktif; mode Periksa → validasi; dst)
- Peta mengisi sisa layar; tidak ada kolom kiri permanen

**Kelebihan:** satu sumber kebenaran untuk konteks; chrome minimal; alur linear yang jelas untuk user baru.
**Kekurangan:** konsep "mode" perlu dipelajari; risiko user merasa "dikekang" alurnya.

---

## REKOMENDASI

**Arah A.** Alasannya jujur: user sudah menggambar sketsanya sendiri dan menyetujui mockupnya. Mengeksekusi dengan setia adalah cara tercepat membangun kepercayaan — dan itu yang user kritik kemarin (kualitas eksekusi, bukan kurangnya ide). Arah B bisa jadi fase 2 setelah A stabil.

**Yang tidak berubah apa pun arahnya:** engine SHP/PDF/export, skema atribut JUKNIS, logika validasi, integrasi BIG. Ini murni kerjaan presentasi.

---

*Menunggu pilihan user (A / B / C) sebelum masuk Tahap 3 — sesuai SOP, tidak ada eksekusi sebelum arah dikunci.*
