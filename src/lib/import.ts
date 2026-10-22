/**
 * Import geometri dari file SHP / GeoJSON / CSV ke layer aktif.
 *
 * - ZIP berisi quartet SHP (.shp+.shx+.dbf+.prj) atau GeoJSON
 * - GeoJSON (.geojson/.json) — selalu WGS84 lon/lat (RFC 7946)
 * - CSV dengan kolom lon/lat (atau WKT) + opsional kode/keterangan
 * - SHP tunggal (.shp) — atribut kosong bila tanpa .dbf
 *
 * CRS dideteksi dari .prj: Web Mercator → derajat; UTM zona N/S → derajat;
 * GEOGCS → derajat apa adanya. Geometri tidak cocok dengan layer → error jelas.
 */
import shpjs from 'shpjs'
import JSZip from 'jszip'
import { mercToLon, mercToLat } from './geo'
import type { Geom, Pt } from './geo'

export interface ImportedFeature {
  geom: Geom
  kode: string
  keterangan: string
  /** Kolom ID sumber (jika ada); kosong → diisi "0" saat masuk proyek. */
  dbId: string
}

export type ImportGeometryKind = 'point' | 'polygon'

// ── tipe GeoJSON minimal ────────────────────────────────────────────────────

interface GjGeometry {
  type: string
  coordinates: unknown
}
interface GjFeature {
  type: 'Feature'
  geometry: GjGeometry | null
  properties: Record<string, unknown> | null
}

// ── konversi CRS ────────────────────────────────────────────────────────────

function convertPrj(prj: string, lon: number, lat: number): Pt {
  if (/Mercator/i.test(prj)) {
    return { lon: mercToLon(lon), lat: mercToLat(lat) }
  }
  if (/Transverse_Mercator|UTM/i.test(prj)) {
    let zone = 0
    let northern = true
    const mZone = /UTM_Zone_(\d+)([NS])/i.exec(prj) || /Zone_(\d+)([NS])/i.exec(prj)
    if (mZone) {
      zone = Number(mZone[1])
      northern = mZone[2].toUpperCase() === 'N'
    } else {
      const mCm = /Central_Meridian,\s*(-?[\d.]+)/i.exec(prj)
      if (mCm) {
        zone = Math.floor((Number(mCm[1]) + 183) / 6)
      }
      northern = /North|northern/i.test(prj) && !/south|Southern/i.test(prj)
    }
    if (zone > 0) return utmToLatLon(lon, lat, zone, northern)
  }
  // GEOGCS atau tidak dikenal → anggap sudah derajat
  return { lon, lat }
}

/** Inversi UTM (WGS84) → derajat. */
export function utmToLatLon(
  easting: number,
  northing: number,
  zone: number,
  northern: boolean,
): Pt {
  const a = 6378137
  const f = 1 / 298.257223563
  const k0 = 0.9996
  const e2 = f * (2 - f)
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2))
  const ep2 = e2 / (1 - e2)

  const x = easting - 500000
  const y = northern ? northing : northing - 10000000
  const M = y / k0
  const mu = M / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256))
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu)

  const c1 = ep2 * Math.cos(phi1) ** 2
  const t1 = Math.tan(phi1) ** 2
  const n1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) ** 2)
  const r1 = (a * (1 - e2)) / (1 - e2 * Math.sin(phi1) ** 2) ** 1.5
  const d = x / (n1 * k0)

  const lat =
    phi1 -
    (n1 * Math.tan(phi1) * ((d * d) / 2 - ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * ep2) * d ** 4) / 24)) / r1
  const lon =
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * ep2 + 24 * t1 * t1) * d ** 5) / 120) /
    Math.cos(phi1)

  const lonOrigin = ((zone - 1) * 6 - 180 + 3)
  return {
    lon: lonOrigin + (lon / Math.PI) * 180,
    lat: (lat / Math.PI) * 180,
  }
}

// ── geometri GeoJSON → Geom internal ────────────────────────────────────────

function ringFromCoords(coords: unknown, conv: (p: Pt) => Pt): Pt[] {
  if (!Array.isArray(coords)) throw new Error('Koordinat polygon tidak valid')
  const ring = coords
    .filter((c): c is number[] => Array.isArray(c) && c.length >= 2)
    .map(([x, y]) => conv({ lon: x, lat: y }))
  if (ring.length < 3) throw new Error('Polygon butuh minimal 3 vertex')
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first.lon !== last.lon || first.lat !== last.lat) {
    ring.push({ lon: first.lon, lat: first.lat })
  }
  return ring
}

/**
 * Fallback CRS: bila tidak ada .prj yang dikenal tapi koordinat di luar
 * rentang derajat (|x|>180 atau |y|>90), anggap meter Web Mercator —
 * konvensi layer Area amdalnet. Derajat valid selalu dalam rentang.
 */
function outOfDegreeRange(features: ImportedFeature[]): boolean {
  for (const f of features) {
    const pts =
      f.geom.type === 'Point' ? [f.geom.c] : f.geom.ring
    for (const p of pts) {
      if (Math.abs(p.lon) > 180 || Math.abs(p.lat) > 90) return true
    }
  }
  return false
}

function applyMercFallback(features: ImportedFeature[]): void {
  for (const f of features) {
    if (f.geom.type === 'Point') {
      f.geom.c = { lon: mercToLon(f.geom.c.lon), lat: mercToLat(f.geom.c.lat) }
    } else {
      f.geom.ring = f.geom.ring.map((p) => ({
        lon: mercToLon(p.lon),
        lat: mercToLat(p.lat),
      }))
    }
  }
}

function geomFromGeoJSON(
  geom: GjGeometry,
  conv: (p: Pt) => Pt,
  geometryKind: ImportGeometryKind,
): Geom[] {
  switch (geom.type) {
    case 'Point': {
      if (geometryKind !== 'point') {
        throw new Error('Layer ini hanya menerima area (polygon), file berisi titik')
      }
      const c = geom.coordinates as number[]
      if (!Array.isArray(c) || c.length < 2) throw new Error('Koordinat titik tidak valid')
      return [{ type: 'Point', c: conv({ lon: c[0], lat: c[1] }) }]
    }
    case 'MultiPoint': {
      if (geometryKind !== 'point') {
        throw new Error('Layer ini hanya menerima area (polygon), file berisi titik')
      }
      const pts = (geom.coordinates as number[][]).map(([x, y]) =>
        conv({ lon: x, lat: y }),
      )
      return pts.map((c) => ({ type: 'Point' as const, c }))
    }
    case 'Polygon': {
      if (geometryKind !== 'polygon') {
        throw new Error('Layer ini hanya menerima titik, file berisi polygon')
      }
      return [{ type: 'Polygon', ring: ringFromCoords((geom.coordinates as unknown[])[0], conv) }]
    }
    case 'MultiPolygon': {
      if (geometryKind !== 'polygon') {
        throw new Error('Layer ini hanya menerima titik, file berisi polygon')
      }
      return (geom.coordinates as unknown[][][]).map((poly) => ({
        type: 'Polygon' as const,
        ring: ringFromCoords(poly[0], conv),
      }))
    }
    default:
      throw new Error(`Tipe geometri "${geom.type}" tidak didukung (hanya titik & polygon)`)
  }
}

// ── mapping atribut ─────────────────────────────────────────────────────────

function pickAttr(props: Record<string, unknown> | null, keys: string[]): string {
  if (!props) return ''
  const lower = Object.fromEntries(
    Object.entries(props).map(([k, v]) => [k.toLowerCase(), v]),
  )
  for (const k of keys) {
    const v = lower[k.toLowerCase()]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

const KODE_KEYS = ['KODE', 'kode', 'code', 'ID_TITIK', 'no']
const KET_KEYS = ['KETERANGAN', 'keterangan', 'desc', 'description', 'ket', 'nama', 'name']
const ID_KEYS = ['ID', 'id', 'fid', 'objectid', 'object_id']

// ── parser per format ───────────────────────────────────────────────────────

function parseGeoJSONText(
  text: string,
  geometryKind: ImportGeometryKind,
  conv: (p: Pt) => Pt = (p) => p,
): ImportedFeature[] {
  const gj = JSON.parse(text) as {
    type?: string
    features?: GjFeature[]
    geometry?: GjGeometry
    properties?: Record<string, unknown>
  }
  const features: GjFeature[] = gj.features
    ? gj.features
    : gj.type === 'Feature' && gj.geometry
      ? [{ type: 'Feature', geometry: gj.geometry, properties: gj.properties ?? null }]
      : []
  if (features.length === 0) throw new Error('GeoJSON tidak memiliki fitur')
  const out: ImportedFeature[] = []
  for (const f of features) {
    if (!f.geometry) continue
    const geoms = geomFromGeoJSON(f.geometry, conv, geometryKind)
    const kode = pickAttr(f.properties, KODE_KEYS)
    const ket = pickAttr(f.properties, KET_KEYS)
    const dbId = pickAttr(f.properties, ID_KEYS)
    for (const g of geoms) out.push({ geom: g, kode, keterangan: ket, dbId })
  }
  if (out.length === 0) throw new Error('Tidak ada geometri yang bisa diimpor')
  return out
}

async function parseShpBuffers(
  shpBuf: ArrayBuffer,
  dbfBuf: ArrayBuffer | null,
  prjText: string | null,
  geometryKind: ImportGeometryKind,
): Promise<ImportedFeature[]> {
  // Bentuk objek {shp, dbf} (jalur fromObject shpjs) — BUKAN buffer telanjang,
  // karena shpjs(buffer) selalu mencoba unzip dan gagal pada .shp mentah.
  const input: { shp: ArrayBuffer; dbf?: ArrayBuffer } = { shp: shpBuf }
  if (dbfBuf) input.dbf = dbfBuf
  const gj = (await shpjs(input)) as {
    features: GjFeature[]
  }
  const conv =
    prjText && /Mercator|Transverse_Mercator|UTM/i.test(prjText)
      ? (p: Pt) => convertPrj(prjText, p.lon, p.lat)
      : (p: Pt) => p
  const out: ImportedFeature[] = []
  for (const f of gj.features ?? []) {
    if (!f.geometry) continue
    const geoms = geomFromGeoJSON(f.geometry, conv, geometryKind)
    const kode = pickAttr(f.properties, KODE_KEYS)
    const ket = pickAttr(f.properties, KET_KEYS)
    const dbId = pickAttr(f.properties, ID_KEYS)
    for (const g of geoms) out.push({ geom: g, kode, keterangan: ket, dbId })
  }
  if (out.length === 0) throw new Error('Shapefile tidak memiliki geometri yang bisa diimpor')
  // fallback: tanpa .prj & koordinat di luar rentang derajat → meter Web Mercator
  if (!prjText && outOfDegreeRange(out)) applyMercFallback(out)
  return out
}

// WKT sederhana: POINT(x y) / POLYGON((x y, x y, ...))
function parseWkt(wkt: string): GjGeometry | null {
  const s = wkt.trim()
  const pm = /^POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)$/i.exec(s)
  if (pm) return { type: 'Point', coordinates: [Number(pm[1]), Number(pm[2])] }
  const gm = /^POLYGON\s*\(\s*\((.*)\)\s*\)$/i.exec(s)
  if (gm) {
    const ring = gm[1]
      .split(',')
      .map((pair) => {
        const m = pair.trim().match(/(-?[\d.]+)\s+(-?[\d.]+)/)
        return m ? [Number(m[1]), Number(m[2])] : null
      })
      .filter((c): c is number[] => c !== null)
    if (ring.length >= 3) return { type: 'Polygon', coordinates: [ring] }
  }
  return null
}

function parseCsvText(text: string, geometryKind: ImportGeometryKind): ImportedFeature[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length === 0) throw new Error('CSV kosong')
  const delim = detectDelim(lines[0])
  const header = splitCsvLine(lines[0], delim).map((h) => h.trim().toLowerCase())
  const idx = (keys: string[]) => {
    for (const k of keys) {
      const i = header.indexOf(k.toLowerCase())
      if (i >= 0) return i
    }
    return -1
  }
  const iLon = idx(['lon', 'long', 'longitude', 'x', 'bt', 'garis bujur'])
  const iLat = idx(['lat', 'latitude', 'y', 'ls', 'garis lintang'])
  const iWkt = header.findIndex((h) => h === 'wkt' || h === 'geom' || h === 'geometry')
  const iKode = idx(KODE_KEYS)
  const iKet = idx(KET_KEYS)
  const iId = idx(ID_KEYS)

  const out: ImportedFeature[] = []
  for (let li = 1; li < lines.length; li++) {
    const cols = splitCsvLine(lines[li], delim)
    let geom: GjGeometry | null = null
    if (iWkt >= 0 && cols[iWkt]) {
      geom = parseWkt(cols[iWkt])
    } else if (iLon >= 0 && iLat >= 0) {
      const lon = Number(String(cols[iLon]).replace(',', '.'))
      const lat = Number(String(cols[iLat]).replace(',', '.'))
      if (!isFinite(lon) || !isFinite(lat)) continue
      if (Math.abs(lon) <= 90 && Math.abs(lat) > 90) {
        geom = { type: 'Point', coordinates: [lat, lon] } // terbalik
      } else {
        geom = { type: 'Point', coordinates: [lon, lat] }
      }
    } else {
      throw new Error(
        'CSV harus punya kolom lon & lat (mis. "lon,lat") atau kolom WKT',
      )
    }
    if (!geom) continue
    if (geom.type === 'Point' && geometryKind !== 'point') continue
    if (geom.type === 'Polygon' && geometryKind !== 'polygon') continue
    const geoms = geomFromGeoJSON(geom, (p) => p, geometryKind)
    const kode = iKode >= 0 ? (cols[iKode] ?? '').trim() : ''
    const ket = iKet >= 0 ? (cols[iKet] ?? '').trim() : ''
    const dbId = iId >= 0 ? (cols[iId] ?? '').trim() : ''
    for (const g of geoms) out.push({ geom: g, kode, keterangan: ket, dbId })
  }
  if (out.length === 0) throw new Error('Tidak ada baris koordinat valid di CSV')
  return out
}

function detectDelim(line: string): string {
  if (line.includes('\t')) return '\t'
  if (line.includes(';')) return ';'
  return ','
}

function splitCsvLine(line: string, delim: string): string[] {
  if (delim === ',') {
    // hormati tanda kutip
    const out: string[] = []
    let cur = ''
    let inQ = false
    for (const ch of line) {
      if (ch === '"') inQ = !inQ
      else if (ch === ',' && !inQ) {
        out.push(cur)
        cur = ''
      } else cur += ch
    }
    out.push(cur)
    return out.map((s) => s.trim().replace(/^"|"$/g, ''))
  }
  return line.split(delim).map((s) => s.trim().replace(/^"|"$/g, ''))
}

// ── entry point ─────────────────────────────────────────────────────────────

export async function importFiles(
  files: File[],
  geometryKind: ImportGeometryKind,
): Promise<ImportedFeature[]> {
  const all: ImportedFeature[] = []
  for (const file of files) {
    const name = file.name.toLowerCase()
    if (name.endsWith('.zip')) {
      const buf = await file.arrayBuffer()
      const zip = await JSZip.loadAsync(buf)
      const entries: { path: string; zip: JSZip.JSZipObject }[] = []
      zip.forEach((path, obj) => {
        if (!obj.dir) entries.push({ path, zip: obj })
      })
      const findExt = (ext: string) =>
        entries.find((e) => e.path.toLowerCase().endsWith(ext))?.zip ?? null

      const shpE = findExt('.shp')
      if (shpE) {
        const shpBuf = await shpE.async('arraybuffer')
        const dbfE = findExt('.dbf')
        const prjE = findExt('.prj')
        const dbfBuf = dbfE ? await dbfE.async('arraybuffer') : null
        const prjText = prjE ? await prjE.async('string') : null
        all.push(...(await parseShpBuffers(shpBuf, dbfBuf, prjText, geometryKind)))
        continue
      }
      const gjE = entries.find(
        (e) => e.path.toLowerCase().endsWith('.geojson') || e.path.toLowerCase().endsWith('.json'),
      )
      if (gjE) {
        all.push(...parseGeoJSONText(await gjE.zip.async('string'), geometryKind))
        continue
      }
      const csvE = entries.find((e) => e.path.toLowerCase().endsWith('.csv'))
      if (csvE) {
        all.push(...parseCsvText(await csvE.zip.async('string'), geometryKind))
        continue
      }
      throw new Error(`ZIP "${file.name}" tidak berisi .shp/.geojson/.csv yang dikenali`)
    }

    if (name.endsWith('.geojson') || name.endsWith('.json')) {
      all.push(...parseGeoJSONText(await file.text(), geometryKind))
    } else if (name.endsWith('.csv')) {
      all.push(...parseCsvText(await file.text(), geometryKind))
    } else if (name.endsWith('.shp')) {
      const buf = await file.arrayBuffer()
      // shp tunggal: bentuk objek {shp} (tanpa shx/dbf → atribut kosong)
      const gj = (await shpjs({ shp: buf })) as { features: GjFeature[] }
      const out: ImportedFeature[] = []
      for (const f of gj.features ?? []) {
        if (!f.geometry) continue
        const geoms = geomFromGeoJSON(f.geometry, (p) => p, geometryKind)
        const kode = pickAttr(f.properties, KODE_KEYS)
        const ket = pickAttr(f.properties, KET_KEYS)
        const dbId = pickAttr(f.properties, ID_KEYS)
        for (const g of geoms) out.push({ geom: g, kode, keterangan: ket, dbId })
      }
      if (out.length === 0) throw new Error('Shapefile tidak memiliki geometri')
      // fallback: tanpa .prj & koordinat di luar rentang derajat → meter Web Mercator
      if (outOfDegreeRange(out)) applyMercFallback(out)
      all.push(...out)
    } else {
      throw new Error(`Format "${file.name}" tidak didukung (gunakan .zip/.shp/.geojson/.csv)`)
    }
  }
  if (all.length === 0) throw new Error('Tidak ada fitur yang berhasil diimpor')
  return all
}
