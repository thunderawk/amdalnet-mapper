/**
 * Model proyek AMDALNET Mapper: profil proyek, fitur per layer,
 * validasi, autosave localStorage, save/load JSON.
 */
import type { Geom, Pt } from './geo'
import { LAYERS, LAYER_BY_KEY } from './layers'
import type { LayerKey } from './layers'
import type { AttrRecord } from './shp'
import { ringArea, ringAreaEllipsoidal } from './geo'

export const PROJECT_VERSION = 1

export interface Feature {
  id: string
  layer: LayerKey
  geom: Geom
  /** Atribut spesifik per fitur; field profil diwarisi saat export. */
  kode: string
  keterangan: string
  createdAt: string
}

export interface Project {
  version: number
  // Profil proyek (diisi sekali, diwarisi ke semua fitur)
  pemrakarsa: string
  kegiatan: string
  tahun: number | ''
  provinsi: string
  /** Diisi otomatis dari pencarian wilayah BIG (bisa diubah manual). */
  kabupaten: string
  kecamatan: string
  desa: string
  tipeDokumen: string
  /** Path relatif di dalam folder proyek untuk ekspor per-section. */
  exportSubPath: string
  features: Feature[]
  savedAt: string
}

export function emptyProject(): Project {
  const now = new Date().toISOString()
  return {
    version: PROJECT_VERSION,
    pemrakarsa: '',
    kegiatan: '',
    tahun: new Date().getFullYear(),
    provinsi: '',
    kabupaten: '',
    kecamatan: '',
    desa: '',
    tipeDokumen: 'UKL-UPL',
    exportSubPath: '04_GIS/amdalnet',
    features: [],
    savedAt: now,
  }
}

let idCounter = 0
export function newFeatureId(): string {
  idCounter += 1
  return `f${Date.now().toString(36)}${idCounter.toString(36)}`
}

export function makeFeature(
  layer: LayerKey,
  geom: Geom,
  kode = '',
  keterangan = '',
): Feature {
  return {
    id: newFeatureId(),
    layer,
    geom,
    kode,
    keterangan,
    createdAt: new Date().toISOString(),
  }
}

export function featuresOf(project: Project, layer: LayerKey): Feature[] {
  return project.features.filter((f) => f.layer === layer)
}

/** Nilai atribut LAYER untuk satu layer (selalu format JUKNIS resmi). */
export function effectiveLayerAttr(layer: LayerKey): string {
  return LAYER_BY_KEY[layer].layerJuknis
}

/**
 * Atribut untuk satu fitur.
 * Layer biasa: 9 field (profil + kode/keterangan).
 * Tapak Proyek: 8 field byte-identik template amdalnet — TANPA KODE &
 * TIPE_DOKUM, dengan KETERANGAN dan LUAS (hektar, ellipsoidal WGS84).
 */
export function attrsForFeature(
  project: Project,
  feature: Feature,
): AttrRecord {
  if (feature.layer === 'tapak') {
    return {
      id: 0,
      PEMRAKARSA: project.pemrakarsa,
      KEGIATAN: project.kegiatan,
      TAHUN: project.tahun === '' ? '' : String(project.tahun),
      PROVINSI: project.provinsi,
      KETERANGAN: feature.keterangan,
      LAYER: effectiveLayerAttr(feature.layer),
      LUAS: featureArea(feature) / 10000,
    }
  }
  return {
    PEMRAKARSA: project.pemrakarsa,
    KEGIATAN: project.kegiatan,
    TAHUN: project.tahun === '' ? 0 : project.tahun,
    PROVINSI: project.provinsi,
    KETERANGAN: feature.keterangan,
    TIPE_DOKUM: project.tipeDokumen,
    KODE: feature.kode,
    LAYER: effectiveLayerAttr(feature.layer),
    ID: 0,
  }
}

// ── Validasi ────────────────────────────────────────────────────────────────

export interface Issue {
  level: 'error' | 'warning'
  layer: LayerKey | 'profil'
  featureId?: string
  message: string
}

export function validateProject(project: Project): Issue[] {
  const issues: Issue[] = []
  const p = project

  if (!p.pemrakarsa.trim()) {
    issues.push({ level: 'error', layer: 'profil', message: 'Pemrakarsa belum diisi' })
  }
  if (!p.kegiatan.trim()) {
    issues.push({ level: 'error', layer: 'profil', message: 'Kegiatan belum diisi' })
  }
  if (p.tahun === '' || !/^\d{4}$/.test(String(p.tahun))) {
    issues.push({ level: 'error', layer: 'profil', message: 'Tahun harus 4 digit' })
  }
  if (!p.provinsi.trim()) {
    issues.push({ level: 'error', layer: 'profil', message: 'Provinsi belum diisi' })
  }
  if (!TIPE_OK(p.tipeDokumen)) {
    issues.push({ level: 'error', layer: 'profil', message: 'Tipe dokumen harus "Amdal" atau "UKL-UPL"' })
  }

  // cek lebar field PEMRAKARSA/KEGIATAN terhadap skema tiap layer
  for (const f of p.features) {
    const def = LAYER_BY_KEY[f.layer]
    const pemrField = def.fields.find((x) => x.name === 'PEMRAKARSA')!
    const kegField = def.fields.find((x) => x.name === 'KEGIATAN')!
    if (p.pemrakarsa.length > pemrField.length) {
      issues.push({
        level: 'error',
        layer: f.layer,
        featureId: f.id,
        message: `Pemrakarsa ${p.pemrakarsa.length} char > lebar field ${def.fileName} (${pemrField.length})`,
      })
    }
    if (p.kegiatan.length > kegField.length) {
      issues.push({
        level: 'error',
        layer: f.layer,
        featureId: f.id,
        message: `Kegiatan ${p.kegiatan.length} char > lebar field ${def.fileName} (${kegField.length})`,
      })
    }
    // Panduan Tapak v2.5 tidak mengenal KODE — lewati untuk layer tapak
    if (f.layer !== 'tapak' && !f.kode.trim()) {
      issues.push({ level: 'error', layer: f.layer, featureId: f.id, message: 'KODE belum diisi' })
    }
    if (!f.keterangan.trim()) {
      issues.push({ level: 'error', layer: f.layer, featureId: f.id, message: 'Keterangan belum diisi' })
    }
  }

  // KODE harus unik dalam satu layer (template amdalnet: U1, U2, ... — tidak berulang)
  for (const def of LAYERS) {
    const seen = new Map<string, string>()
    for (const f of featuresOf(p, def.key)) {
      const k = f.kode.trim().toUpperCase()
      if (!k) continue
      const prev = seen.get(k)
      if (prev !== undefined && prev !== f.id) {
        issues.push({
          level: 'warning',
          layer: def.key,
          featureId: f.id,
          message: `KODE "${f.kode.trim()}" dipakai lebih dari sekali di ${def.fileName}`,
        })
      } else {
        seen.set(k, f.id)
      }
    }
  }

  for (const def of LAYERS) {
    const n = featuresOf(p, def.key).length
    if (n === 0) {
      issues.push({ level: 'warning', layer: def.key, message: `${def.fileName}: belum ada fitur` })
    }
  }

  return issues
}

function TIPE_OK(v: string): boolean {
  return v === 'Amdal' || v === 'UKL-UPL'
}

export function issueCount(issues: Issue[]): { errors: number; warnings: number } {
  return {
    errors: issues.filter((i) => i.level === 'error').length,
    warnings: issues.filter((i) => i.level === 'warning').length,
  }
}

// ── Persistensi ─────────────────────────────────────────────────────────────

const LS_KEY = 'amdalnet-mapper-project-v1'

export function saveLocal(project: Project): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(project))
  } catch {
    /* storage penuh / private mode — abaikan */
  }
}

export function loadLocal(): Project | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    return sanitizeProject(JSON.parse(raw))
  } catch {
    return null
  }
}

export function clearLocal(): void {
  try {
    localStorage.removeItem(LS_KEY)
  } catch {
    /* abaikan */
  }
}

/** Normalisasi proyek dari JSON (toleran field hilang/versi lama). */
export function sanitizeProject(raw: unknown): Project {
  const base = emptyProject()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Record<string, unknown>
  const feats = Array.isArray(r.features) ? r.features : []
  const features: Feature[] = []
  for (const f of feats) {
    const fr = f as Record<string, unknown>
    const layer = fr.layer as LayerKey
    if (!LAYER_BY_KEY[layer]) continue
    const geom = fr.geom as Geom | undefined
    if (!geom || (geom.type !== 'Point' && geom.type !== 'Polygon')) continue
    if (geom.type === 'Point') {
      const c = geom.c as Pt
      if (typeof c?.lon !== 'number' || typeof c?.lat !== 'number') continue
    } else {
      const ring = geom.ring as Pt[]
      if (!Array.isArray(ring) || ring.length < 3) continue
      if (ring.some((pt) => typeof pt?.lon !== 'number' || typeof pt?.lat !== 'number')) continue
    }
    features.push({
      id: typeof fr.id === 'string' ? fr.id : newFeatureId(),
      layer,
      geom,
      kode: typeof fr.kode === 'string' ? fr.kode : '',
      keterangan: typeof fr.keterangan === 'string' ? fr.keterangan : '',
      createdAt: typeof fr.createdAt === 'string' ? fr.createdAt : new Date().toISOString(),
    })
  }
  return {
    version: PROJECT_VERSION,
    pemrakarsa: typeof r.pemrakarsa === 'string' ? r.pemrakarsa : base.pemrakarsa,
    kegiatan: typeof r.kegiatan === 'string' ? r.kegiatan : base.kegiatan,
    tahun: typeof r.tahun === 'number' ? r.tahun : base.tahun,
    provinsi: typeof r.provinsi === 'string' ? r.provinsi : base.provinsi,
    kabupaten: typeof r.kabupaten === 'string' ? r.kabupaten : base.kabupaten,
    kecamatan: typeof r.kecamatan === 'string' ? r.kecamatan : base.kecamatan,
    desa: typeof r.desa === 'string' ? r.desa : base.desa,
    tipeDokumen: typeof r.tipeDokumen === 'string' ? r.tipeDokumen : base.tipeDokumen,
    exportSubPath:
      typeof r.exportSubPath === 'string' ? r.exportSubPath : base.exportSubPath,
    features,
    savedAt: typeof r.savedAt === 'string' ? r.savedAt : new Date().toISOString(),
  }
}

// ── CSV backup ──────────────────────────────────────────────────────────────

export function layerToCsv(project: Project, layer: LayerKey): string {
  const feats = featuresOf(project, layer)
  const def = LAYER_BY_KEY[layer]
  const cols = def.fields.map((f) => f.name)
  const header = ['id', 'lon', 'lat', ...cols]
  const rows = feats.map((f) => {
    const a = attrsForFeature(project, f)
    let lon = ''
    let lat = ''
    if (f.geom.type === 'Point') {
      lon = String(f.geom.c.lon)
      lat = String(f.geom.c.lat)
    } else {
      const c = centroid(f.geom.ring)
      lon = String(c.lon)
      lat = String(c.lat)
    }
    return [f.id, lon, lat, ...cols.map((k) => String(a[k] ?? ''))]
  })
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  return [header.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n') + '\n'
}

export function centroid(ring: Pt[]): Pt {
  if (ring.length === 0) return { lon: 0, lat: 0 }
  const xs = ring.map((p) => p.lon)
  const ys = ring.map((p) => p.lat)
  return {
    lon: xs.reduce((a, b) => a + b, 0) / xs.length,
    lat: ys.reduce((a, b) => a + b, 0) / ys.length,
  }
}

export function featureArea(f: Feature): number {
  if (f.geom.type !== 'Polygon') return 0
  // Tapak: luas ellipsoidal WGS84 (= QGIS $area) agar field LUAS di DBF
  // sama dengan hitungan template amdalnet.
  return f.layer === 'tapak'
    ? ringAreaEllipsoidal(f.geom.ring)
    : ringArea(f.geom.ring)
}

export function allFeaturesArea(project: Project, layer: LayerKey): number {
  return featuresOf(project, layer).reduce((a, f) => a + featureArea(f), 0)
}

export function slugify(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'PROYEK'
}
