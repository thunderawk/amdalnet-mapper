# Design Notes — Mockup Interaktif Arah C

Ukuran: **L** · Mode: **Operate** (tool kerja) · Tahap: 3 Eksekusi

## Keputusan token (tiap pilihan ada alasan)

1. **Font: IBM Plex Sans (UI) + IBM Plex Mono (data).** Alasan: (a) detector impeccable melarang Inter-default tanpa alasan; (b) Plex punya angka tabular sejati → KODE & koordinat tidak bergeser saat nilai berubah (better-typography); (c) karakter "dokumen teknis" pas untuk tool pemetaan presisi; (d) max 2 family.
2. **Skala tipe: 12 / 13 / 14 / 16 / 20.** Alasan: tool padat — 14px teks UI, 13px sekunder, 12px caption (batas bawah), 16px judul seksi, 20px hanya judul app. Line-height unitless (1.5 body, 1.25 heading). Micro-label uppercase 11px + tracking 0.05em.
3. **Warna netral warm-gray** (ala shadcn zinc): canvas `#F4F4F5`, sidebar `#FFFFFF`, border hairline `#E4E4E7`, teks `#18181B` / `#52525B` / `#A1A1AA`. 5 warna slot DESIGN.md **hanya sebagai dot 8px** (keputusan arah C). Satu aksi primer per view: tombol gelap `#18181B` (better-colors: fill exactly one action).
4. **Radius: 10px kontainer, 8px kontrol, full untuk pill.** Alasan: outer = inner + padding (better-ui), satu sistem.
5. **Shadow hampir nol** — border untuk struktur; shadow hanya elemen floating (kontrol peta, popup, sheet): `0 1px 2px rgb(0 0 0 / .06)`.
6. **Motion: 150ms ease-out `cubic-bezier(0.2,0,0,1)`** untuk state; tekan = scale 0.96; accordion 200ms; semua di-gate `prefers-reduced-motion`; hover row = instant (high-frequency, tanpa animasi).
7. **Ikon: Lucide inline SVG**, stroke 2px, `currentColor`, satu library. Tanpa emoji (aturan keras).
8. **Spacing basis 4px**; sidebar 320px desktop; gap seksi 16px.

## Yang tidak diubah dari gambar revisi (C + 3 penyesuaian)
Accordion + circle chevron · 3 tombol ikon (Tambah/Paste/Impor) · edit inline per titik (seret + variabel) · kontainer Ekspor Semua di bawah + tree folder `amdalnet_mapper/`.

## Asumsi
- Single-file, validasi desain saja. Unduhan ZIP/PDF → toast "mode mockup" (di luar scope).
- Satelit Esri via CDN (butuh internet). Data contoh realistis (PT Nusa Hijau Lestari, Kaltim).
- Edit polygon = edit atribut saja (geser vertex tidak di-scope; user hanya minta untuk titik).

## Hasil Tahap 4 — Anti-Slop Check (lolos)
- Font beralasan (bukan Inter default); tanpa gradient; tanpa card-dalam-card; tanpa icon-tile;
  hover hanya di `@media (hover:hover)`; tanpa `transition:all`; tekan = scale 0.96;
  motion di-gate `prefers-reduced-motion`; `--text-3` dinaikkan #A1A1AA→#71717A (kontras);
  `overscroll-behavior:contain` di sidebar & dialog; ikon 1 library (Lucide, currentColor).

## Hasil Tahap 5 — Verifikasi browser asli (Chromium 131 headless, Playwright)
- Desktop 1440×900 & mobile 390×844, walkthrough interaksi: tambah/edit/hapus/urungkan/
  paste-dialog/dialog-profil — semua lolos.
- Bug ditemukan & diperbaiki dari screenshot: (1) `marker.dragging.enable()` crash sebelum
  addTo → hapus, cukup opsi `draggable`; (2) sheet mobile kepenuhan layar (var --app-height
  = 100%) → 62dvh; (3) kontrol Leaflet (z 1000) nembus sheet → side 1100/scrim 1200/toast 1300;
  (4) konten sheet tidak ter-clip di sudut rounded → overflow:hidden.
- Catatan: tile satelit tidak termuat di headless (tanpa proxy); di browser user normal.

## Hasil Tahap 6 — Pengurangan
- Dihapus: sub-judul header "Mockup arah C" (duplikat dengan tag MOCKUP).
- Dipertahankan: micro-label, hint seret-titik, penjelasan ekspor (masing-masing 1 baris,
  menjelaskan aksi). Satu focal point per layar = peta.

## Revisi 21:45 (feedback user)
1. **Panel ala chat**: accordion yang terbuka scroll di dalam areanya sendiri
   (`.acc.open` → `flex:0 1 auto` + `max-height:100%`, `.acc-inner` overflow-y auto) —
   header lain + footer selalu kelihatan, tidak ada konten terdorong/terpotong.
   Bug mobile (konten nimpa header) diperbaiki via `min-height:0` di `.acc-body`.
2. **Font dikecilin**: body 14→13px, judul header/dialog 16→15px, tombol 12.5px.
3. **Ekspor Semua tanpa tree folder**: diganti ringkasan 1 baris dinamis
   ("5 konten · 6 fitur — tiap konten ZIP + PDF").
4. **Minimal**: micro-label "Mode input"/"Fitur" dibuang (tombol ikon + baris sudah jelas).
