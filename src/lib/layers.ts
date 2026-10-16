/**
 * Definisi 5 layer AMDALNET + skema atribut 9 field.
 *
 * Skema & lebar field: identik template asli amdalnet (JUKNIS hlm.16/18).
 * CRS & shape type per layer: replikasi template asli (keputusan terverifikasi).
 * Nilai atribut LAYER selalu mengikuti JUKNIS resmi (untuk tapak: Panduan
 * Tapak Proyek v2.5) — tidak ada varian template.
 */
import type { DbfField } from './shp'
import type { LayerKind } from './shp'

export type LayerKey =
  | 'titik-pantau'
  | 'titik-kelola'
  | 'area-pantau'
  | 'area-kelola'
  | 'tapak'

export interface LayerDef {
  key: LayerKey
  /** Nama layer untuk penamaan file SHP/ZIP/PDF (sesuai JUKNIS). */
  fileName: string
  /** Nama folder untuk ekspor per-section (snake_case). */
  folder: string
  label: string
  kind: LayerKind
  geometry: 'point' | 'polygon'
  /** Slot upload di amdalnet. */
  slot: string
  fields: DbfField[]
  /** Nilai atribut LAYER sesuai JUKNIS resmi (teks petunjuk, hlm. 16/18). */
  layerJuknis: string
  /** Warna peta. */
  color: string
  fill: string
}

// Skema field — urutan & lebar PERSIS template.
const TITIK_FIELDS: DbfField[] = [
  { name: 'PEMRAKARSA', type: 'C', length: 50, decimals: 0 },
  { name: 'KEGIATAN', type: 'C', length: 50, decimals: 0 },
  { name: 'TAHUN', type: 'N', length: 4, decimals: 0 },
  { name: 'PROVINSI', type: 'C', length: 50, decimals: 0 },
  { name: 'KETERANGAN', type: 'C', length: 254, decimals: 0 },
  { name: 'TIPE_DOKUM', type: 'C', length: 50, decimals: 0 },
  { name: 'KODE', type: 'C', length: 50, decimals: 0 },
  { name: 'LAYER', type: 'C', length: 50, decimals: 0 },
  { name: 'ID', type: 'N', length: 10, decimals: 0 },
]

const AREA_FIELDS: DbfField[] = [
  { name: 'PEMRAKARSA', type: 'C', length: 100, decimals: 0 },
  { name: 'KEGIATAN', type: 'C', length: 254, decimals: 0 },
  { name: 'TAHUN', type: 'N', length: 4, decimals: 0 },
  { name: 'PROVINSI', type: 'C', length: 50, decimals: 0 },
  { name: 'KETERANGAN', type: 'C', length: 254, decimals: 0 },
  { name: 'TIPE_DOKUM', type: 'C', length: 50, decimals: 0 },
  { name: 'KODE', type: 'C', length: 50, decimals: 0 },
  { name: 'LAYER', type: 'C', length: 50, decimals: 0 },
  { name: 'ID', type: 'N', length: 10, decimals: 0 },
]

export const ATTR_KEYS = [
  'PEMRAKARSA',
  'KEGIATAN',
  'TAHUN',
  'PROVINSI',
  'KETERANGAN',
  'TIPE_DOKUM',
  'KODE',
  'LAYER',
  'ID',
] as const
export type AttrKey = (typeof ATTR_KEYS)[number]

export const LAYERS: LayerDef[] = [
  {
    key: 'titik-pantau',
    fileName: 'Titik Pantau',
    folder: 'titik_pantau',
    label: 'Titik Pantau',
    kind: 'titik',
    geometry: 'point',
    slot: 'Titik Pemantauan',
    fields: TITIK_FIELDS,
    layerJuknis: 'Titik Pemantauan',
    color: '#2563eb',
    fill: '#2563eb',
  },
  {
    key: 'titik-kelola',
    fileName: 'Titik Kelola',
    folder: 'titik_kelola',
    label: 'Titik Kelola',
    kind: 'titik',
    geometry: 'point',
    slot: 'Titik Kelola',
    fields: TITIK_FIELDS,
    layerJuknis: 'Titik Pengelolaan',
    color: '#ea580c',
    fill: '#ea580c',
  },
  {
    key: 'area-pantau',
    fileName: 'Area Pantau',
    folder: 'area_pantau',
    label: 'Area Pantau',
    kind: 'area',
    geometry: 'polygon',
    slot: 'Peta Pemantauan',
    fields: AREA_FIELDS,
    layerJuknis: 'Area Pemantauan',
    color: '#0d9488',
    fill: 'rgba(13,148,136,0.18)',
  },
  {
    key: 'area-kelola',
    fileName: 'Area Kelola',
    folder: 'area_kelola',
    label: 'Area Kelola',
    kind: 'area',
    geometry: 'polygon',
    slot: 'Peta Lokasi Pengelolaan',
    fields: AREA_FIELDS,
    layerJuknis: 'Area Pengelolaan',
    color: '#d97706',
    fill: 'rgba(217,119,6,0.18)',
  },
  {
    key: 'tapak',
    fileName: 'TAPAK PROYEK',
    folder: 'tapak_proyek',
    label: 'Tapak Proyek',
    kind: 'area',
    geometry: 'polygon',
    slot: 'Peta Tapak Proyek',
    fields: AREA_FIELDS,
    // Panduan Tapak Proyek v2.5 (Juli 2024): nama file HURUF KAPITAL semua,
    // atribut LAYER diisi teks "Tapak Proyek".
    layerJuknis: 'Tapak Proyek',
    color: '#7c3aed',
    fill: 'rgba(124,58,237,0.10)',
  },
]

export const LAYER_BY_KEY: Record<LayerKey, LayerDef> = Object.fromEntries(
  LAYERS.map((l) => [l.key, l]),
) as Record<LayerKey, LayerDef>

/** Saran KODE per kategori dampak RKL-RPL (dari JUKNIS + praktik template). */
export const KODE_SUGGESTIONS: { kode: string; arti: string }[] = [
  { kode: 'A', arti: 'Air / drainase / erosi' },
  { kode: 'AP', arti: 'Air permukaan' },
  { kode: 'B', arti: 'Kebisingan' },
  { kode: 'U', arti: 'Kualitas udara' },
  { kode: 'L', arti: 'Limbah padat' },
  { kode: 'LP', arti: 'Limbah padat (pengelolaan)' },
  { kode: 'S', arti: 'Sosial / ekonomi' },
  { kode: 'K', arti: 'Keanekaragaman hayati' },
]

export const TIPE_DOKUM_OPTIONS = ['UKL-UPL', 'Amdal']

/** Nilai atribut LAYER untuk sebuah layer (selalu format JUKNIS resmi). */
export function layerAttrValue(def: LayerDef): string {
  return def.layerJuknis
}
