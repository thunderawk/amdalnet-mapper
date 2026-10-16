/**
 * Batas administrasi resmi BIG (Badan Informasi Geospasial) via ArcGIS REST.
 *
 * Endpoint: https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH
 * Tanpa API key. Terverifikasi live 2026-10-16 (query nama + spasial).
 */
import type { Pt } from './geo'

const BASE = 'https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH'

export type WilayahLevel = 'kabkota' | 'kecamatan' | 'keldesa'

const SERVICES: Record<WilayahLevel, string> = {
  kabkota: `${BASE}/Administrasi_AR_KabKota_50K/MapServer`,
  kecamatan: `${BASE}/Administrasi_AR_Kecamatan_10K/MapServer`,
  keldesa: `${BASE}/Administrasi_AR_KelDesa_10K/MapServer`,
}

export interface Wilayah {
  level: WilayahLevel
  /** OBJECTID di service BIG (untuk ambil geometri tahap 2). */
  objectId: number
  /** Nama objek (desa/kelurahan, kecamatan, atau kab/kota). */
  nama: string
  kecamatan: string
  kabkota: string
  provinsi: string
  /** Kode wilayah resmi (mis. 35.73 / 33.10.25.2007). */
  kode: string
  /** Luas wilayah dalam km² (LUASWH dari BIG). */
  luasKm2: number
  /** Ring polygon (sudah dalam lon/lat WGS84). Kosong sampai fetchWilayahGeometry dipanggil. */
  rings: Pt[][]
}

interface EsriFeature {
  attributes: Record<string, string | number | null>
  geometry?: { rings: number[][][] }
}

function str(v: string | number | null | undefined): string {
  return v === null || v === undefined ? '' : String(v).trim()
}

function num(v: string | number | null | undefined): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Konversi esri rings → array ring Pt (lon/lat). */
export function esriRingsToPts(rings: number[][][]): Pt[][] {
  return rings
    .filter((r) => Array.isArray(r) && r.length >= 3)
    .map((r) => r.map(([x, y]) => ({ lon: x, lat: y })))
}

function toWilayah(level: WilayahLevel, f: EsriFeature, withGeometry: boolean): Wilayah | null {
  const a = f.attributes
  const rings = withGeometry && f.geometry ? esriRingsToPts(f.geometry.rings) : []
  return {
    level,
    objectId: num(a.OBJECTID),
    nama: str(a.NAMOBJ),
    kecamatan: str(a.WADMKC),
    kabkota: str(a.WADMKK),
    provinsi: str(a.WADMPR),
    kode: str(a.KDEPUM) || str(a.KDEBPS) || str(a.KDPKAB),
    luasKm2: num(a.LUASWH),
    rings,
  }
}

async function queryBig(
  level: WilayahLevel,
  params: Record<string, string>,
  retries = 1,
  withGeometry = true,
): Promise<Wilayah[]> {
  const url = `${SERVICES[level]}/0/query`
  const body = new URLSearchParams({
    outFields: 'OBJECTID,NAMOBJ,WADMKC,WADMKD,WADMKK,WADMPR,KDPKAB,KDEBPS,KDEPUM,LUASWH',
    returnGeometry: withGeometry ? 'true' : 'false',
    geometryPrecision: '5',
    f: 'json',
    ...params,
  })
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 25000)
  try {
    const res = await fetch(url, { method: 'POST', body, signal: ctrl.signal })
    if (!res.ok) throw new Error(`BIG merespons HTTP ${res.status}`)
    const data = (await res.json()) as { error?: { message?: string }; features?: EsriFeature[] }
    if (data.error) throw new Error(data.error.message ?? 'Query BIG gagal')
    return (data.features ?? [])
      .map((f) => toWilayah(level, f, withGeometry))
      .filter((w): w is Wilayah => w !== null && w.nama !== '')
  } catch (e) {
    // coba sekali lagi — layanan BIG kadang menutup koneksi tiba-tiba
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 800))
      return queryBig(level, params, retries - 1, withGeometry)
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

const escLike = (s: string) => s.replace(/'/g, "''").toUpperCase()

/**
 * Cari wilayah berdasarkan nama (case-insensitive, LIKE) — TAHAP 1: ringan,
 * tanpa geometri. Panggil fetchWilayahGeometry untuk menggambar batasnya.
 * Cari berurutan: desa → kecamatan → kab/kota, gabungkan hasilnya
 * (maks `limit` per level).
 */
export async function searchWilayah(
  q: string,
  limit = 8,
): Promise<Wilayah[]> {
  const query = q.trim()
  if (query.length < 3) return []
  const like = `upper(NAMOBJ) LIKE '%${escLike(query)}%'`
  const out: Wilayah[] = []
  for (const level of ['keldesa', 'kecamatan', 'kabkota'] as WilayahLevel[]) {
    try {
      // NOTE: server BIG menolak resultRecordCount ("Pagination is not supported")
      // → batasi di sisi klien. Geometri diambil terpisah agar pencarian ringan.
      const rows = await queryBig(level, { where: like }, 1, false)
      out.push(...rows.slice(0, limit))
    } catch {
      /* satu level gagal — lanjutkan level lain */
    }
    if (out.length >= limit) break
  }
  return out.slice(0, limit)
}

/**
 * TAHAP 2: ambil geometri batas satu wilayah (dipanggil saat user memilih
 * hasil pencarian). Mengembalikan objek baru yang rings-nya terisi.
 */
export async function fetchWilayahGeometry(w: Wilayah): Promise<Wilayah> {
  if (!w.objectId) throw new Error('ID wilayah tidak valid')
  const rows = await queryBig(
    w.level,
    { where: `OBJECTID = ${w.objectId}` },
    1,
    true,
  )
  const full = rows[0]
  if (!full || full.rings.length === 0) throw new Error('Batas wilayah tidak ditemukan')
  return full
}

/** Detail administrasi untuk satu titik (desa → provinsi + kode). */
export async function reverseGeocode(lon: number, lat: number): Promise<Wilayah | null> {
  const rows = await queryBig('keldesa', {
    geometry: `${lon},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    returnGeometry: 'false',
  })
  return rows[0] ?? null
}

/** Label ringkas: "Jomboran, Klaten Tengah, Klaten". */
export function wilayahLabel(w: Wilayah): string {
  const parts = [w.nama]
  if (w.level !== 'kecamatan' && w.kecamatan) parts.push(w.kecamatan)
  if (w.level === 'kabkota') {
    if (w.provinsi) parts.push(w.provinsi)
  } else if (w.kabkota) {
    parts.push(w.kabkota)
  }
  return parts.filter(Boolean).join(', ')
}

export const LEVEL_LABEL: Record<WilayahLevel, string> = {
  keldesa: 'Desa/Kelurahan',
  kecamatan: 'Kecamatan',
  kabkota: 'Kab/Kota',
}
