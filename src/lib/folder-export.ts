/**
 * Ekspor per-section langsung ke folder proyek via File System Access API.
 *
 * Struktur keluaran (contoh, folder proyek = 2026_PERMATA-REGENCY):
 *   <folder proyek>/04_GIS/amdalnet/titik_kelola/Titik Kelola.shp
 *                                                    Titik Kelola.shx
 *                                                    Titik Kelola.dbf
 *                                                    Titik Kelola.prj
 *                                                    Titik Kelola.cpg
 *                                                    Titik Kelola.zip
 *                                                    Titik Kelola.pdf
 *                                                    Titik Kelola.csv
 *
 * Butuh Chrome/Edge (showDirectoryPicker). Browser lain: pakai tombol
 * unduh per-layer yang sudah ada (ZIP/PDF di tabel, atau Export Semua).
 */
import L from 'leaflet'
import JSZip from 'jszip'
import { buildAndVerify } from './shp'
import type { AttrRecord } from './shp'
import { LAYERS } from './layers'
import type { LayerKey } from './layers'
import { attrsForFeature, featuresOf, layerToCsv } from './project'
import type { Project } from './project'
import { buildLayerPdf } from './export'
import type { LMap } from './export'

// ── File System Access API (tipe lokal, tanpa bergantung lib.dom) ───────────

interface FsWritable {
  write(data: Blob | Uint8Array | string): Promise<void>
  close(): Promise<void>
}
interface FsFileHandle {
  createWritable(): Promise<FsWritable>
}
interface FsDirHandle {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FsDirHandle>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FsFileHandle>
}
type DirPicker = (options?: { mode?: 'read' | 'readwrite' }) => Promise<FsDirHandle>

/** true bila browser mendukung penulisan langsung ke folder (Chrome/Edge). */
export function folderExportSupported(): boolean {
  if (typeof window === 'undefined') return false
  return (
    typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker ===
    'function'
  )
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function ensureDir(root: FsDirHandle, path: string): Promise<FsDirHandle> {
  let dir = root
  for (const seg of path.split('/').map((s) => s.trim()).filter(Boolean)) {
    dir = await dir.getDirectoryHandle(seg, { create: true })
  }
  return dir
}

async function writeBlob(
  dir: FsDirHandle,
  name: string,
  data: Blob | Uint8Array | string,
): Promise<void> {
  const fh = await dir.getFileHandle(name, { create: true })
  const w = await fh.createWritable()
  await w.write(data)
  await w.close()
}

function fitMapToLayer(map: LMap, layer: LayerKey, project: Project): void {
  const feats = featuresOf(project, layer)
  const pts: [number, number][] = []
  for (const f of feats) {
    if (f.geom.type === 'Point') pts.push([f.geom.c.lat, f.geom.c.lon])
    else for (const p of f.geom.ring) pts.push([p.lat, p.lon])
  }
  if (pts.length === 0) return
  map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 17 })
}

// ── entry point ─────────────────────────────────────────────────────────────

export interface FolderExportOptions {
  project: Project
  /** Path relatif dalam folder proyek, mis. "04_GIS/amdalnet". */
  subPath: string
  map: LMap
  mapEl: HTMLElement
  /** Layer yang diekspor (default: yang memiliki fitur). */
  include: LayerKey[]
  onProgress?: (msg: string) => void
}

export interface FolderExportResult {
  /** Folder layer yang berhasil ditulis. */
  written: string[]
  /** Layer yang dilewati (kosong/tidak dipilih). */
  skipped: LayerKey[]
}

export async function exportToFolder(
  opts: FolderExportOptions,
): Promise<FolderExportResult> {
  const picker = (window as unknown as { showDirectoryPicker?: DirPicker })
    .showDirectoryPicker
  if (!picker) {
    throw new Error(
      'Browser ini tidak mendukung penulisan langsung ke folder. Pakai Chrome atau Edge, ' +
        'atau unduh per-layer lewat tombol ZIP/PDF pada tabel.',
    )
  }

  // pilih folder proyek (mis. 2026_PERMATA-REGENCY)
  const root = await picker({ mode: 'readwrite' })
  const base = await ensureDir(root, opts.subPath || '04_GIS/amdalnet')

  const written: string[] = []
  const skipped: LayerKey[] = []
  const initialBounds = opts.map.getBounds()

  for (const def of LAYERS) {
    const feats = featuresOf(opts.project, def.key)
    if (!opts.include.includes(def.key) || feats.length === 0) {
      skipped.push(def.key)
      continue
    }

    opts.onProgress?.(`Menyiapkan ${def.fileName}…`)
    const dir = await ensureDir(base, def.folder)
    const n = def.fileName

    // quartet SHP (writer terverifikasi, sama dengan jalur download)
    const set = buildAndVerify(
      // Tapak Proyek mengikuti Panduan v2.5 (plain Polygon derajat)
      def.key === 'tapak' ? 'tapak' : def.kind,
      feats.map((f) => ({
        geom: f.geom,
        attrs: attrsForFeature(opts.project, f) as AttrRecord,
      })),
      def.fields,
    )
    await writeBlob(dir, `${n}.shp`, set.shp)
    await writeBlob(dir, `${n}.shx`, set.shx)
    await writeBlob(dir, `${n}.dbf`, set.dbf)
    await writeBlob(dir, `${n}.prj`, set.prj)
    await writeBlob(dir, `${n}.cpg`, set.cpg)

    // zip siap upload
    const zip = new JSZip()
    zip.file(`${n}.shp`, set.shp)
    zip.file(`${n}.shx`, set.shx)
    zip.file(`${n}.dbf`, set.dbf)
    zip.file(`${n}.prj`, set.prj)
    zip.file(`${n}.cpg`, set.cpg)
    await writeBlob(dir, `${n}.zip`, await zip.generateAsync({ type: 'blob' }))

    // PDF peta — zoom ke layer dulu agar capture fokus
    opts.onProgress?.(`Render PDF ${def.fileName}…`)
    try {
      fitMapToLayer(opts.map, def.key, opts.project)
      await sleep(900) // beri waktu tile dimuat
      const pdfBlob = await buildLayerPdf(opts.map, opts.mapEl)
      await writeBlob(dir, `${n}.pdf`, pdfBlob)
    } catch (e) {
      console.warn('PDF gagal untuk', def.fileName, e)
    }

    // CSV backup atribut
    await writeBlob(dir, `${n}.csv`, layerToCsv(opts.project, def.key))

    written.push(`${opts.subPath}/${def.folder}/`)
  }

  // kembalikan tampilan peta seperti semula
  try {
    opts.map.fitBounds(initialBounds, { padding: [30, 30] })
  } catch {
    /* abaikan */
  }

  return { written, skipped }
}
