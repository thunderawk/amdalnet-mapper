# SOP Desain — Muse

Versi 1.0 — 17 Okt 2026. Berlaku untuk semua kerjaan yang berhubungan dengan desain visual: UI, mockup, landing page, dashboard, dokumen, diagram, slide deck.

---

## 1. Arsenal Skill

| Skill | Peran | Dipakai kapan |
|---|---|---|
| `impeccable` | Klasifikasi mode desain (Persuade / Operate / Read / Experience), 24 command kerja (`polish`, `audit`, `critique`, `bolder`, `distill`…), 59 aturan detektor "AI slop" | Setiap kerjaan desain — tentuin mode di awal, detektor slop sebelum selesai |
| `oil-ui` | Proses eksplorasi: 3 arah desain yang benar-benar beda → comparison page → refine dari screenshot → ronde pengurangan | Kerjaan sedang & besar; fase eksplorasi, verifikasi, delivery |
| `taste-skill` | Art direction anti-slop dari 247 situs Awwwards; deal 3 arah dari riset; inspeksi via browser asli + loop perbaiki-dari-screenshot | Kerjaan sedang & besar; cari arah artistik, verifikasi visual |
| `baoyu-design` | Metodologi desain per tipe proyek (13 tipe: mockup, dashboard, landing page, slide deck, dokumen, diagram, design system…) | Kerangka eksekusi sesuai tipe deliverable |
| `better-ui`, `better-typography`, `better-colors`, `better-layout`, `better-accessibility`, `better-writing`, `better-interface` | Nilai eksak untuk polish: radius, shadow, skala tipe, token warna, spacing, kontras, copy | Fase eksekusi & quality check — angka pasti, bukan kira-kira |

---

## 2. Klasifikasi Kerjaan

| Ukuran | Ciri | Contoh |
|---|---|---|
| **S — Kecil** | Elemen & cara ubahnya sudah jelas dari permintaan user | Ganti copy, ganti warna tombol, tambah spacing, hapus elemen |
| **M — Sedang** | Satu komponen / satu halaman, ada kebebasan visual | Redesign sidebar, bikin kartu info, halaman kosong baru |
| **L — Besar** | Desain baru / redesign menyeluruh / multi-halaman | Overhaul UI mapper, landing page baru, design system |

Aturan: **S langsung eksekusi. M dan L wajib lewat eksplorasi arah dulu (Tahap 2).**

---

## 3. Alur Kerja

### Tahap 0 — Intake (semua ukuran)

1. Baca permintaan user, tentukan ukuran (S/M/L).
2. Tentukan **mode** (impeccable): *Persuade* (landing, kampanye), *Operate* (tool, dashboard, mapper), *Read* (dokumen, panduan), *Experience* (portofolio, galeri).
3. Jawab 3 pertanyaan (oil-ui): produk ini apa? user ngapain di layar pertama? 2–3 produk terbaik sejenis ngapain di layar pertamanya?
4. Kalau ada info yang kalau salah tebak bakal ngerusak arah desain → tanya user **sekali, sekaligus**. Sisanya: putuskan sendiri, catat asumsinya.

### Tahap 1 — Brief & Riset (M dan L)

1. Inventarisasi yang nyata: user, tugas utama, konten asli, device yang dipakai, bentuk deliverable.
2. Kumpulkan 2–3 referensi se-kategori yang gayanya paling khas; catat apa yang mau ditiru dan apa yang mau dilawan.
3. Ubah kata sifat ("premium", "bersih") jadi keputusan konkret: font apa, whitespace seberapa, porsi warna berapa.
4. Tulis **design notes** singkat: tugas, arah yang dipilih nanti, status penting, batasan device.

### Tahap 2 — Eksplorasi Arah (M dan L saja)

1. Susun **3 arah yang benar-benar beda**. Dari 4 unsur (layout, tipografi, warna, visual utama), dua arah boleh sama maksimal 1 unsur. Bukan cuma ganti warna.
2. Setiap arah mulai dari sesuatu yang konkret (material, suasana, dunia produknya) — bukan dari kata sifat.
3. Presentasikan ke user **dalam bentuk teks dulu**: rasanya seperti apa, layar pertamanya seperti apa, font & warna apa, visual utamanya apa + rekomendasi saya. **Berhenti di sini, tunggu user pilih.**
4. Kalau user mau lihat visual: bikin 3 mockup layar pertama → taruh di satu comparison page → user pilih.
5. Kunci 1 arah. Catat di design notes + alasannya.

### Tahap 3 — Eksekusi

1. Ikuti metodologi `baoyu-design` sesuai tipe proyek (mockup / dashboard / dokumen / deck / diagram).
2. Terapkan nilai eksak `better-*`: radius, shadow, skala tipografi, token warna, spacing, kontras — angka pasti dari skill, bukan feeling.
3. **Setiap pilihan visual harus punya alasan** yang nyambung ke brief. Kalau nggak bisa dijelasin, jangan dipakai.
4. Visual pendukung pakai **aset beneran** (foto, ilustrasi, material). Dilarang: gradient generik, blok geometris, atau emoji sebagai pengisi kekosongan.
5. Copy ditulis dengan `better-writing`: jelas, sesuai suara produk, tiap teks nyuruh user ngapain.

### Tahap 4 — Anti-Slop Check (sebelum ngaku selesai)

Jalankan daftar larangan `impeccable` + review `better-interface`:

- [ ] Bukan font default (Inter) di semua teks tanpa alasan
- [ ] Bukan gradient ungu-biru generik
- [ ] Tidak ada card di dalam card
- [ ] Tidak ada icon tile kotak-rounded di atas setiap heading
- [ ] Animasi pakai nilai eksak, di-gate `prefers-reduced-motion`
- [ ] Kontras teks lolos rasio yang disyaratkan
- [ ] Konsisten: 1 sistem token, bukan tiap komponen gaya sendiri

Ada yang kena → perbaiki dulu, baru lanjut.

### Tahap 5 — Verifikasi Visual (semua ukuran yang mengubah tampilan)

1. Buka hasil di **browser asli** (bukan cuma baca kode).
2. Screenshot **desktop + mobile**. Periksa: teks kepotong/tumpuk, hierarki kebaca, tidak ada yang kelihatan "belum jadi".
3. Temuan → perbaiki → screenshot lagi. Ulangi sampai bersih (look-fix loop).
4. Kerjaan S yang cuma ubah warna/spacing: cukup cek area yang diubah + elemen di sebelahnya.

### Tahap 6 — Pengurangan (M dan L)

1. Satu layar = **satu focal point**, sisanya tenang.
2. Hapus teks, garis, dan box yang kalau dibuang tidak mengurangi pemahaman.
3. Cek di zoom 100% dan 200% untuk area kritis.

### Tahap 7 — Delivery

Sampaikan dengan struktur ini:

1. **Arah yang dipilih + alasan** (untuk M/L)
2. **Yang diubah** — ringkas, per bagian
3. **Yang tidak diubah + kenapa** (biar user nggak nebak-nebak)
4. **Hasil verifikasi** — sudah dicek di viewport apa, ada temuan apa
5. **Asumsi yang saya buat** (kalau ada)

Lampirkan file/screenshot/link hasil di pesan yang sama. Jangan umumkan "selesai" sebelum Tahap 4–5 lolos.

---

## 4. Aturan Keras

**Selalu:**
- Tentukan mode & ukuran kerjaan sebelum mulai.
- Keputusan visual bisa dijelasin alasannya.
- Verifikasi dari render asli (desktop + mobile) untuk semua perubahan tampilan.
- Hormati brief & batasan yang user kasih — mengarahkan ulang selera user secara diam-diam = gagal.

**Tidak pernah:**
- Gradient, blok geometris, atau emoji sebagai filler visual.
- Font/warna/shadow "default AI" tanpa alasan.
- Klaim selesai tanpa lihat hasil render.
- Untuk M/L: eksekusi full sebelum user pilih arah.

---

## 5. Checklist Cepat per Ukuran

**S:** Tahap 0 → 3 → 4 (ringkas) → 5 (area terdampak) → 7
**M:** Tahap 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7
**L:** Semua tahap, design notes ditulis & di-update tiap tahap
