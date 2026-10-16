/**
 * Konversi koordinat: DD / DMS / DMM / UTM (datum WGS84).
 *
 * Konsultan sering menerima koordinat dalam format campuran
 * (mis. dari GPS handheld: DMS; dari dokumen: UTM). Modul ini
 * menormalkan semuanya ke desimal derajat { lon, lat }.
 */

export interface LonLat {
  lon: number
  lat: number
}

/** Hasil parse satu nilai sudut beserta validasinya. */
export interface ParsedAngle {
  value: number
  format: 'DD' | 'DMS' | 'DMM'
}

const DIR_LAT = /([NS])/i
const DIR_LON = /([EW])/i

/**
 * Parse satu nilai sudut: desimal ("-7.73144"), DMS
 * ("7°43'52.8"S" / "7 43 52.8 S"), atau DMM ("7°43.880'S").
 * `isLat` menentukan interpretasi arah N/S vs E/W dan batas validasi.
 */
export function parseAngle(raw: string, isLat: boolean): ParsedAngle | null {
  let s = raw.trim()
  if (!s) return null
  // desimal polos, koma desimal Indonesia ditoleransi
  if (/^[+-]?[\d\s]*\d([.,]\d+)?\s*[NSEW]?$/i.test(s) && !/[°'"]/.test(s)) {
    const dirMatch = s.match(isLat ? DIR_LAT : DIR_LON)
    s = s.replace(/[NSEW]/gi, '').trim().replace(',', '.')
    const v = Number(s)
    if (!Number.isFinite(v)) return null
    const signed = dirMatch
      ? (dirMatch[1].toUpperCase() === 'S' || dirMatch[1].toUpperCase() === 'W' ? -Math.abs(v) : Math.abs(v))
      : v
    if (isLat && Math.abs(signed) > 90) return null
    if (!isLat && Math.abs(signed) > 180) return null
    return { value: signed, format: 'DD' }
  }
  // DMS / DMM: normalisasi simbol
  const norm = s
    .replace(/[°º]/g, '°')
    .replace(/[’‘`]/g, "'")
    .replace(/[”″]/g, '"')
  const m = norm.match(
    /^\s*([+-]?\d+(?:[.,]\d+)?)\s*°?\s*(?:(\d+(?:[.,]\d+)?)\s*['′]?\s*)?(?:(\d+(?:[.,]\d+)?)\s*["″]?\s*)?\s*([NSEW])?\s*$/i,
  )
  if (!m) return null
  const deg = Number(m[1].replace(',', '.'))
  const min = m[2] ? Number(m[2].replace(',', '.')) : 0
  const sec = m[3] ? Number(m[3].replace(',', '.')) : 0
  if (!Number.isFinite(deg) || !Number.isFinite(min) || !Number.isFinite(sec)) return null
  if (min >= 60 || sec >= 60) return null
  let v = Math.abs(deg) + min / 60 + sec / 3600
  const dir = m[4]?.toUpperCase()
  if (dir === 'S' || dir === 'W') v = -v
  else if (deg < 0) v = -v
  if (isLat && Math.abs(v) > 90) return null
  if (!isLat && Math.abs(v) > 180) return null
  return { value: v, format: sec > 0 ? 'DMS' : 'DMM' }
}

export type CoordFormat = 'DD' | 'DMS' | 'DMM' | 'UTM'

/** Parse sepasang "lat, lon" atau "lon, lat" dalam format campuran. */
export function parseCoordPair(line: string): { pt: LonLat; format: CoordFormat } | null {
  const parts = line.split(/[,;\t]/).map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return null
  // coba (lat, lon) dulu, lalu (lon, lat)
  for (const swap of [false, true]) {
    const a = parseAngle(parts[0], !swap)
    const b = parseAngle(parts[1], swap)
    if (a && b) {
      const lat = swap ? b.value : a.value
      const lon = swap ? a.value : b.value
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        return {
          pt: { lon, lat },
          format: a.format === 'DD' && b.format === 'DD' ? 'DD' : a.format !== 'DD' ? a.format : b.format,
        }
      }
    }
  }
  return null
}

// ── format tampilan ──────────────────────────────────────────────────────────

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function formatDMS(value: number, isLat: boolean): string {
  const dir = isLat ? (value < 0 ? 'S' : 'N') : value < 0 ? 'W' : 'E'
  const av = Math.abs(value)
  const d = Math.floor(av)
  const mFloat = (av - d) * 60
  const m = Math.floor(mFloat)
  const s = (mFloat - m) * 60
  return `${d}°${pad2(m)}'${s.toFixed(1).padStart(4, '0')}"${dir}`
}

export function formatDMM(value: number, isLat: boolean): string {
  const dir = isLat ? (value < 0 ? 'S' : 'N') : value < 0 ? 'W' : 'E'
  const av = Math.abs(value)
  const d = Math.floor(av)
  const m = (av - d) * 60
  return `${d}°${m.toFixed(3).padStart(6, '0')}'${dir}`
}

// ── UTM (WGS84) ─────────────────────────────────────────────────────────────
// Formula Transverse Mercator standar (Snyder).

const A = 6378137
const F = 1 / 298.257223563
const K0 = 0.9996
const E2 = 2 * F - F * F
const EP2 = E2 / (1 - E2)

export interface Utm {
  zone: number
  hemisphere: 'N' | 'S'
  easting: number
  northing: number
}

export function lonLatToUtm(lon: number, lat: number): Utm {
  const zone = Math.floor((lon + 180) / 6) + 1
  const lon0 = ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180)
  const latR = lat * (Math.PI / 180)
  const lonR = lon * (Math.PI / 180)
  const N = A / Math.sqrt(1 - E2 * Math.sin(latR) ** 2)
  const T = Math.tan(latR) ** 2
  const C = EP2 * Math.cos(latR) ** 2
  const A_ = Math.cos(latR) * (lonR - lon0)
  const M =
    A *
    ((1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256) * latR -
      ((3 * E2) / 8 + (3 * E2 ** 2) / 32 + (45 * E2 ** 3) / 1024) * Math.sin(2 * latR) +
      ((15 * E2 ** 2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * latR) -
      ((35 * E2 ** 3) / 3072) * Math.sin(6 * latR))
  const easting =
    K0 * N * (A_ + ((1 - T + C) * A_ ** 3) / 6 + ((5 - 18 * T + T ** 2 + 72 * C - 58 * EP2) * A_ ** 5) / 120) +
    500000
  let northing =
    K0 * (M + N * Math.tan(latR) * ((A_ ** 2) / 2 + ((5 - T + 9 * C + 4 * C ** 2) * A_ ** 4) / 24 +
      ((61 - 58 * T + T ** 2 + 600 * C - 330 * EP2) * A_ ** 6) / 720))
  const hemisphere: 'N' | 'S' = lat < 0 ? 'S' : 'N'
  if (hemisphere === 'S') northing += 10000000
  return { zone, hemisphere, easting: Math.round(easting), northing: Math.round(northing) }
}

export function utmToLonLat(u: Utm): LonLat {
  const lon0 = ((u.zone - 1) * 6 - 180 + 3) * (Math.PI / 180)
  const x = u.easting - 500000
  let y = u.northing
  if (u.hemisphere === 'S') y -= 10000000
  const M = y / K0
  const mu = M / (A * (1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256))
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2))
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu)
  const N1 = A / Math.sqrt(1 - E2 * Math.sin(phi1) ** 2)
  const T1 = Math.tan(phi1) ** 2
  const C1 = EP2 * Math.cos(phi1) ** 2
  const R1 = (A * (1 - E2)) / (1 - E2 * Math.sin(phi1) ** 2) ** 1.5
  const D = x / (N1 * K0)
  const lat =
    phi1 -
    ((N1 * Math.tan(phi1)) / R1) *
      (D ** 2 / 2 - ((5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * EP2) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * EP2 - 3 * C1 ** 2) * D ** 6) / 720)
  const lon =
    lon0 +
    (D - ((1 + 2 * T1 + C1) * D ** 3) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * EP2 + 24 * T1 ** 2) * D ** 5) / 120) /
      Math.cos(phi1)
  return { lon: (lon * 180) / Math.PI, lat: (lat * 180) / Math.PI }
}

/** Parse "49S 500000 9200000" / "49 S 500000 9200000" → LonLat. */
export function parseUtm(raw: string): LonLat | null {
  const m = raw
    .trim()
    .toUpperCase()
    .match(/^(\d{1,2})\s*([NS])\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)$/)
  if (!m) return null
  const zone = Number(m[1])
  if (zone < 1 || zone > 60) return null
  const easting = Number(m[3].replace(',', '.'))
  const northing = Number(m[4].replace(',', '.'))
  if (!Number.isFinite(easting) || !Number.isFinite(northing)) return null
  if (easting < 100000 || easting > 900000 || northing < 0 || northing > 10000000) return null
  return utmToLonLat({ zone, hemisphere: m[2] as 'N' | 'S', easting, northing })
}

export function formatUtm(u: Utm): string {
  return `${u.zone}${u.hemisphere} ${u.easting.toLocaleString('id-ID')} mT ${u.northing.toLocaleString('id-ID')} mU`
}
