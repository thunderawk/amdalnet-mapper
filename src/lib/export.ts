/**
 * Export paket upload AMDALNET: ZIP quartet SHP per layer, PDF layout peta,
 * CSV backup, dan master ZIP siap-upload.
 */
import JSZip from 'jszip'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import leafletImage from 'leaflet-image'
import type L from 'leaflet'
import { buildAndVerify } from './shp'
import type { AttrRecord } from './shp'
import { LAYERS, LAYER_BY_KEY } from './layers'
import type { LayerKey } from './layers'
import { attrsForFeature, featuresOf, layerToCsv, slugify } from './project'
import type { Project } from './project'

// ── unduh blob ──────────────────────────────────────────────────────────────

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

// ── ZIP per layer (quartet SHP, nama file = nama layer) ──────────────────────

export async function buildLayerZip(project: Project, layer: LayerKey): Promise<Blob> {
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
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}

// ── capture peta → canvas ───────────────────────────────────────────────────

/** Antarmuka peta longgar (cukup untuk capture & zoom) — L.Map memenuhinya. */
export interface LMap {
  getContainer: () => HTMLElement
  getSize: () => { x: number; y: number }
  invalidateSize: (o?: boolean) => void
  getBounds: () => L.LatLngBounds
  fitBounds: (bounds: L.LatLngBounds, options?: L.FitBoundsOptions) => void
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Gagal memuat gambar SVG overlay'))
    img.src = url
  })
}

/**
 * Capture peta dengan komposit manual: tile satelit + layer vektor SVG.
 *
 * Kenapa tidak pakai library: leaflet-image TIDAK menggambar path SVG
 * (circleMarker/polygon) dan html2canvas 1.4.1 TIDAK me-render inline SVG —
 * keduanya menghasilkan PDF berisi citra satelit saja (terverifikasi lewat
 * uji browser 2026-10-15). Jadi tile digambar satu per satu dan overlay SVG
 * Leaflet diserialisasi lalu digambar di atasnya pada posisi yang tepat.
 */
async function captureComposited(mapEl: HTMLElement, scale = 2): Promise<HTMLCanvasElement> {
  const container = mapEl.querySelector('.leaflet-container') ?? mapEl
  const rect = container.getBoundingClientRect()
  const W = Math.round(rect.width)
  const H = Math.round(rect.height)
  if (!W || !H) throw new Error('Ukuran peta 0 — peta belum siap')
  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D tidak tersedia')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(scale, scale)

  const rel = (el: Element) => {
    const r = el.getBoundingClientRect()
    return { x: r.left - rect.left, y: r.top - rect.top, w: r.width, h: r.height }
  }

  // 1. tile satelit (sudah crossOrigin=anonymous + Esri mengirim ACAO:*, aman)
  const tiles = mapEl.querySelectorAll<HTMLImageElement>(
    '.leaflet-tile-pane img.leaflet-tile',
  )
  let drawn = 0
  for (const t of tiles) {
    if (!t.complete || !t.naturalWidth) continue
    const p = rel(t)
    try {
      ctx.drawImage(t, p.x, p.y, p.w, p.h)
      drawn++
    } catch {
      /* tile tainted — lewati */
    }
  }
  if (drawn === 0) throw new Error('Tile satelit belum termuat — coba lagi sesaat')

  // 2. overlay vektor: serialisasi <svg> Leaflet → gambar di posisi yang sama
  const svg = mapEl.querySelector('.leaflet-overlay-pane svg')
  if (svg) {
    const p = rel(svg)
    if (p.w > 0 && p.h > 0) {
      const xml = new XMLSerializer().serializeToString(svg)
      const url = URL.createObjectURL(
        new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }),
      )
      try {
        const img = await loadImage(url)
        ctx.drawImage(img, p.x, p.y, p.w, p.h)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
  }
  return canvas
}

function captureMap(map: LMap, mapEl: HTMLElement): Promise<HTMLCanvasElement> {
  // Sembunyikan kontrol peta & tooltip selama capture agar PDF bersih
  // (hanya citra satelit + titik/polygon, seperti contoh JUKNIS).
  const hidden: HTMLElement[] = []
  for (const sel of ['.leaflet-control-container', '.leaflet-tooltip-pane']) {
    mapEl.querySelectorAll<HTMLElement>(sel).forEach((el) => {
      hidden.push(el)
      el.style.display = 'none'
    })
  }
  const restore = () => hidden.forEach((el) => { el.style.display = '' })

  return captureComposited(mapEl, 2)
    .then((canvas) => {
      restore()
      return canvas
    })
    .catch((e: unknown) => {
      restore()
      // Fallback: html2canvas (tile saja), lalu leaflet-image (tile saja).
      return html2canvas(mapEl, {
        useCORS: true,
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      }).catch(() => {
        return new Promise<HTMLCanvasElement>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(e instanceof Error ? e : new Error(String(e))),
            15000,
          )
          try {
            leafletImage(map as never, (err: Error | null, canvas?: HTMLCanvasElement) => {
              clearTimeout(timer)
              if (err || !canvas)
                reject(err ?? (e instanceof Error ? e : new Error(String(e))))
              else resolve(canvas)
            })
          } catch (err) {
            clearTimeout(timer)
            reject(err)
          }
        })
      })
    })
}

// ── PDF peta — ukuran PERSIS contoh peta tapak (679 x 401 pt) ───────────────
// Contoh: peta_tapak.pdf (QGIS 4.2.1) — 1 halaman 679x401 pt, citra peta
// full-bleed tanpa kop/legenda. Ukuran ini dipakai untuk SEMUA layer agar
// seragam.

export async function buildLayerPdf(
  map: LMap,
  mapEl: HTMLElement,
): Promise<Blob> {
  const canvas = await captureMap(map, mapEl)

  const pdf = new jsPDF({ unit: 'pt', format: [679, 401], orientation: 'landscape' })
  const W = 679
  const H = 401
  // full-bleed seperti contoh: peta mengisi seluruh halaman (cover, crop tengah)
  const ratio = Math.max(W / canvas.width, H / canvas.height)
  const iw = canvas.width * ratio
  const ih = canvas.height * ratio
  const imgData = canvas.toDataURL('image/jpeg', 0.92)
  pdf.addImage(imgData, 'JPEG', (W - iw) / 2, (H - ih) / 2, iw, ih)

  return pdf.output('blob')
}

// ── master ZIP: semua paket + PDF + CSV + JSON ──────────────────────────────

export interface ExportAllResult {
  blob: Blob
  filename: string
  included: LayerKey[]
  skipped: LayerKey[]
}

export async function exportAll(
  project: Project,
  map: LMap,
  mapEl: HTMLElement,
  onProgress?: (msg: string) => void,
): Promise<ExportAllResult> {
  const master = new JSZip()
  const slug = slugify(project.kegiatan || 'PROYEK')
  const included: LayerKey[] = []
  const skipped: LayerKey[] = []

  for (const def of LAYERS) {
    const feats = featuresOf(project, def.key)
    if (feats.length === 0) {
      skipped.push(def.key)
      continue
    }
    onProgress?.(`Menyiapkan ${def.fileName}...`)
    const zipBlob = await buildLayerZip(project, def.key)
    master.file(`${def.fileName}.zip`, zipBlob)
    try {
      const pdfBlob = await buildLayerPdf(map, mapEl)
      master.file(`${def.fileName}.pdf`, pdfBlob)
    } catch (e) {
      console.warn('PDF gagal untuk', def.fileName, e)
    }
    master.file(`${def.fileName}.csv`, layerToCsv(project, def.key))
    included.push(def.key)
  }

  master.file(
    'proyek.json',
    JSON.stringify({ ...project, savedAt: new Date().toISOString() }, null, 2),
  )
  master.file('README.txt', buildReadme(project, included, skipped))

  const blob = await master.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  return {
    blob,
    filename: `AMDALNET_${slug}_${project.tahun || ''}.zip`,
    included,
    skipped,
  }
}

function buildReadme(
  project: Project,
  included: LayerKey[],
  skipped: LayerKey[],
): string {
  const def = LAYER_BY_KEY
  const lines = [
    'PAKET UPLOAD AMDALNET — amdalnet.menlhk.go.id',
    '='.repeat(60),
    '',
    `Pemrakarsa : ${project.pemrakarsa}`,
    `Kegiatan   : ${project.kegiatan}`,
    `Tahun      : ${project.tahun}`,
    `Provinsi   : ${project.provinsi}`,
    `Tipe Dok.  : ${project.tipeDokumen}`,
    '',
    'ISI PAKET:',
    ...included.map(
      (k) =>
        `  ${def[k].fileName}.zip  -> upload ke slot "${def[k].slot}" (SHP)\n` +
        `  ${def[k].fileName}.pdf  -> upload ke slot "${def[k].slot} versi pdf"\n` +
        `  ${def[k].fileName}.csv  -> backup atribut (tidak diupload)`,
    ),
    '',
    skipped.length
      ? `Layer kosong (tidak diekspor): ${skipped.map((k) => def[k].fileName).join(', ')}`
      : 'Semua layer memiliki fitur.',
    '',
    'CATATAN:',
    '- File SHP di dalam ZIP sudah bernama sesuai layer, siap upload langsung.',
    '- Upload SHP (zip) dan PDF-nya di slot yang sama pada amdalnet.',
    '- CSV hanya untuk arsip internal.',
    '',
    `Dibuat oleh AMDALNET Mapper pada ${new Date().toLocaleString('id-ID')}`,
  ]
  return lines.join('\n')
}
