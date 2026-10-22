/**
 * Pembuat ZIP quartet SHP per konten — murni (tanpa Leaflet/DOM) agar bisa
 * diuji langsung. Dipakai oleh ekspor zunggal maupun arsip bulk.
 */
import JSZip from 'jszip'
import { buildAndVerify } from './shp'
import type { AttrRecord } from './shp'
import { LAYER_BY_KEY } from './layers'
import type { LayerKey } from './layers'
import { attrsForFeature, featuresOf } from './project'
import type { Project } from './project'

export interface LayerZip {
  fileName: string
  /** Byte mentah ZIP — dipakai untuk menyusun arsip tanpa nested Blob. */
  bytes: Uint8Array
  records: number
}

/** Susun quartet SHP sebagai byte (bukan Blob) — aman untuk arsip bersarang. */
export async function buildLayerZipBytes(
  project: Project,
  layer: LayerKey,
): Promise<LayerZip> {
  const def = LAYER_BY_KEY[layer]
  const feats = featuresOf(project, layer)
  if (feats.length === 0) {
    throw new Error(`${def.fileName}: belum ada fitur untuk diekspor`)
  }
  const set = buildAndVerify(
    // Tapak Proyek mengikuti Panduan v2.5: plain Polygon DERAJAT (EPSG:4326),
    // bukan PolygonZ Web Mercator seperti layer Area.
    layer === 'tapak' ? 'tapak' : def.kind,
    feats.map((f) => ({ geom: f.geom, attrs: attrsForFeature(project, f) as AttrRecord })),
    def.fields,
  )
  const zip = new JSZip()
  const n = def.fileName
  zip.file(`${n}.shp`, set.shp)
  zip.file(`${n}.shx`, set.shx)
  zip.file(`${n}.dbf`, set.dbf)
  zip.file(`${n}.prj`, set.prj)
  zip.file(`${n}.cpg`, set.cpg)
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  return { fileName: n, bytes, records: feats.length }
}

export async function buildLayerZip(project: Project, layer: LayerKey): Promise<Blob> {
  const { bytes } = await buildLayerZipBytes(project, layer)
  // salin ke Uint8Array ber-ArrayBuffer agar cocok dengan tipe BlobPart.
  return new Blob([new Uint8Array(bytes)], { type: 'application/zip' })
}

/**
 * Baca jumlah record DBF dari header (offset 4, little-endian uint32).
 * Dipakai sebagai self-check: arsip bulk tidak boleh berisi DBF kosong.
 */
function dbfRecordCount(dbf: Uint8Array): number {
  if (dbf.byteLength < 32) throw new Error('DBF terlalu pendek')
  const view = new DataView(dbf.buffer, dbf.byteOffset, dbf.byteLength)
  return view.getUint32(4, true)
}

/** Buka ulang ZIP di memori dan pastikan DBF ada + jumlah record sesuai. */
export async function assertZipHasDbf(
  bytes: Uint8Array,
  expectedRecords: number,
  label: string,
): Promise<void> {
  const zip = await JSZip.loadAsync(bytes)
  const dbfEntry = Object.keys(zip.files).find((n) => /\.dbf$/i.test(n))
  if (!dbfEntry) throw new Error(`${label}: DBF tidak ditemukan di dalam ZIP — ekspor dibatalkan`)
  const dbf = await zip.file(dbfEntry)!.async('uint8array')
  const n = dbfRecordCount(dbf)
  if (n !== expectedRecords) {
    throw new Error(
      `${label}: DBF berisi ${n} record, seharusnya ${expectedRecords} — ekspor dibatalkan`,
    )
  }
}
