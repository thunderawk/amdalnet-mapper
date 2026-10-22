/**
 * Verifikasi writer: generate 4 layer dengan data contoh PERSIS dari template
 * asli amdalnet (folder _Regulasi/peta amdalnet), tulis ke direktori keluaran.
 * Pembacaan & perbandingan dilakukan oleh verify-writer.py (pyshp).
 *
 * Jalankan: npx tsx scripts/verify-writer.ts <outdir>
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { buildAndVerify } from '../src/lib/shp'
import { LAYERS, LAYER_BY_KEY } from '../src/lib/layers'
import type { LayerKey } from '../src/lib/layers'
import type { AttrRecord } from '../src/lib/shp'
import type { Geom } from '../src/lib/geo'

interface Row {
  lon: number
  lat: number
  attrs: AttrRecord
}

const outdir = process.argv[2] || '/tmp/amdalnet-verify'
mkdirSync(outdir, { recursive: true })

// ── data contoh dari template asli (dibaca via pyshp sebelumnya) ──

const titikPantau: Row[] = [
  { lon: 110.611, lat: -7.73144, attrs: a('Nanang Budiyanto', 'Perumahan Permata Regency', 2026, 'Jawa Tengah', 'Titik Pemantauan Kebisingan', 'UKL-UPL', 'B1', 'Titik Pantau') },
  { lon: 110.61097, lat: -7.73054, attrs: a('Nanang Budiyanto', 'Perumahan Permata Regency', 2026, 'Jawa Tengah', 'Titik Pemantauan Kualitas Udara', 'UKL-UPL', 'U1', 'Titik Pantau') },
  { lon: 110.61096, lat: -7.72964, attrs: a('Nanang Budiyanto', 'Perumahan Permata Regency', 2026, 'Jawa Tengah', 'Titik Pemantauan Limbah Padat', 'UKL-UPL', 'L1', 'Titik Pantau') },
]

const titikKelola: Row[] = [
  { lon: 107.69797843500004, lat: -6.938079409999938, attrs: a('PT. Oju Textile Indonesia', 'Industri Pertenunan', 2023, 'Jawa Barat', 'Ruang produksi, penurunan kualitas udara dan peningkatan intensitas kebisingan', 'UKL-UPL', 'U1', 'Titik Pengelolaan') },
  { lon: 107.69766809200007, lat: -6.9374882929999435, attrs: a('PT. Oju Textile Indonesia', 'Industri Pertenunan', 2023, 'Jawa Barat', 'Ruang produksi, penurunan kualitas udara dan peningkatan intensitas kebisingan', 'UKL-UPL', 'U2', 'Titik Pengelolaan') },
  { lon: 107.69827142800006, lat: -6.937785267999976, attrs: a('PT. Oju Textile Indonesia', 'Industri Pertenunan', 2023, 'Jawa Barat', 'Ruang produksi, penurunan kualitas udara dan peningkatan intensitas kebisingan', 'UKL-UPL', 'U3', 'Titik Pengelolaan') },
  { lon: 107.69856689500006, lat: -6.937674012999933, attrs: a('PT. Oju Textile Indonesia', 'Industri Pertenunan', 2023, 'Jawa Barat', 'Ruang produksi, penurunan kualitas udara dan peningkatan intensitas kebisingan', 'UKL-UPL', 'U4', 'Titik Pengelolaan') },
  { lon: 107.69820434500008, lat: -6.936955374999971, attrs: a('PT. Oju Textile Indonesia', 'Industri Pertenunan', 2023, 'Jawa Barat', 'Halaman depan, pemantauan kualitas udara ambient', 'UKL-UPL', 'U5', 'Titik Pengelolaan') },
  { lon: 107.69744279000008, lat: -6.938752665999965, attrs: a('PT. Oju Textile Indonesia', 'Industri Pertenunan', 2023, 'Jawa Barat', 'Halaman belakang, pemantauan kualitas udara ambient', 'UKL-UPL', 'U6', 'Titik Pengelolaan') },
]

// derajat presisi penuh = inversi meter Web Mercator template — uji konversi dua arah
const areaPantau = [
  ring('L', [[110.61096275847407, -7.729648537851208], [110.61096275847407, -7.729608266017693], [110.61104696313521, -7.729608266017693], [110.61104696313521, -7.729648537851208]], 'TPS Sementara, Peningkatan Limbah Padat', 'Area Pantau', 'Jawa Tengah', 'UKL-UPL'),
  ring('U', [[110.61086717016948, -7.730478523832888], [110.61086717016948, -7.73038577664256], [110.6111210045142, -7.73038577664256], [110.6111210045142, -7.730478523832888]], 'RTH, Penurunan Kualitas Udara', 'Area Pantau', 'Jawa Tengah', 'UKL-UPL'),
  ring('B', [[110.61093062875271, -7.731513386849472], [110.61093062875271, -7.731440165440162], [110.61101849449778, -7.731440165440162], [110.61101849449778, -7.731513386849472]], 'Peningkatan Kebisingan', 'Area Pantau', 'Jawa Tengah', 'UKL-UPL'),
]

const areaKelola = [
  // baris ini sengaja mereproduksi kejanggalan template: PROVINSI kosong & TIPE 'UKL_UPL'
  ring('LP', [[110.61096249747962, -7.729656513050127], [110.61096249747962, -7.7296107496356194], [110.61103876983714, -7.7296107496356194], [110.61103876983714, -7.729656513050127]], 'TPS Sementara, Penyediaan tempat pembuangan sementara limbah padat', 'Area Kelola', '', 'UKL_UPL'),
  ring('U1', [[110.6108729775927, -7.729744371630647], [110.6108729775927, -7.729684574105947], [110.61113169338267, -7.729684574105947], [110.61113169338267, -7.729744371630647]], 'RTH, Upaya Pengelolaan Kualitas Udara', 'Area Kelola', 'Jawa Tengah', 'UKL-UPL'),
  ring('U2', [[110.610863271938, -7.730589321335425], [110.610863271938, -7.730528303449411], [110.6111171062827, -7.730528303449411], [110.6111171062827, -7.730589321335425]], 'RTH, Upaya Pengelolaan Kualitas Udara', 'Area Kelola', 'Jawa Tengah', 'UKL-UPL'),
  ring('A', [[110.61086896852807, -7.731476256585332], [110.61086896852807, -7.73141157761538], [110.61108558198745, -7.73141157761538], [110.61108558198745, -7.731476256585332]], 'Laju Erosi dan Kondisi Drainase', 'Area Kelola', 'Jawa Tengah', 'UKL-UPL'),
]

function a(
  pemrakarsa: string, kegiatan: string, tahun: number, provinsi: string,
  keterangan: string, tipe: string, kode: string, layer: string,
): AttrRecord {
  return {
    PEMRAKARSA: pemrakarsa, KEGIATAN: kegiatan, TAHUN: tahun, PROVINSI: provinsi,
    KETERANGAN: keterangan, TIPE_DOKUM: tipe, KODE: kode, LAYER: layer, ID: 0,
  }
}

function ring(
  kode: string, pts: number[][], keterangan: string, layer: string,
  provinsi: string, tipe: string,
): { geom: Geom; attrs: AttrRecord } {
  return {
    geom: {
      type: 'Polygon',
      ring: pts.map(([lon, lat]) => ({ lon, lat })),
    },
    attrs: a(
      layer === 'Area Kelola' ? 'Nanang Budiyanto' : 'Nanang Budiyanto',
      'Perumahan Permata Regency', 2026, provinsi, keterangan, tipe, kode, layer,
    ),
  }
}

const LAYER_DATA: Record<LayerKey, { geom: Geom; attrs: AttrRecord }[]> = {
  'titik-pantau': titikPantau.map((r) => ({ geom: { type: 'Point', c: { lon: r.lon, lat: r.lat } }, attrs: r.attrs })),
  'titik-kelola': titikKelola.map((r) => ({ geom: { type: 'Point', c: { lon: r.lon, lat: r.lat } }, attrs: r.attrs })),
  'area-pantau': areaPantau,
  'area-kelola': areaKelola,
  tapak: [],
}

for (const def of LAYERS) {
  const feats = LAYER_DATA[def.key]
  if (feats.length === 0) continue
  const set = buildAndVerify(def.kind, feats, def.fields)
  const base = `${outdir}/${def.fileName}`
  writeFileSync(`${base}.shp`, set.shp)
  writeFileSync(`${base}.shx`, set.shx)
  writeFileSync(`${base}.dbf`, set.dbf)
  writeFileSync(`${base}.prj`, set.prj)
  writeFileSync(`${base}.cpg`, set.cpg)
  console.log(
    `${def.fileName.padEnd(14)} shp=${set.shp.length}B shx=${set.shx.length}B dbf=${set.dbf.length}B prj=${set.prj.length}B (${feats.length} fitur, kind=${def.kind})`,
  )
}
console.log('Selesai. Keluaran di', outdir)
