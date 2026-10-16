/**
 * Util geospasial AMDALNET.
 * Semua geometri internal disimpan dalam DERAJAT WGS84 (lon, lat).
 * Konversi ke meter Web Mercator HANYA saat menulis file SHP layer Area.
 */

export interface Pt {
  lon: number
  lat: number
}

export type Geom =
  | { type: 'Point'; c: Pt }
  | { type: 'Polygon'; ring: Pt[] }

// ── Web Mercator (EPSG:3857) ────────────────────────────────────────────────

const MERC_R = 20037508.342789244 // setengah keliling bumi

export function lonToMercX(lon: number): number {
  return (lon * MERC_R) / 180
}

export function latToMercY(lat: number): number {
  return (
    (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) *
    (MERC_R / 180)
  )
}

export function mercToLon(x: number): number {
  return (x / MERC_R) * 180
}

export function mercToLat(y: number): number {
  return (2 * Math.atan(Math.exp((y / MERC_R) * Math.PI)) * 180) / Math.PI - 90
}

// ── Luas geodesic (rumus spherical-excess, R=6378137) ───────────────────────

/** Luas polygon (m²). Ring boleh belum tertutup. Deterministik & akurat ~0.1%. */
export function ringArea(ring: Pt[]): number {
  if (ring.length < 3) return 0
  const R = 6378137
  const rad = Math.PI / 180
  let total = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const p1 = ring[i]
    const p2 = ring[i + 1]
    total +=
      (p2.lon - p1.lon) * rad *
      (2 + Math.sin(p1.lat * rad) + Math.sin(p2.lat * rad))
  }
  return Math.abs((total * R * R) / 2)
}

export function formatArea(m2: number): string {
  if (m2 >= 10000) return `${(m2 / 10000).toFixed(4)} ha`
  return `${m2.toFixed(1)} m²`
}

// ── Zona UTM (untuk info di PDF; luas dihitung geodesic, bukan UTM) ──────────

export function utmZone(lon: number, lat: number): string {
  const zone = Math.floor((lon + 180) / 6) + 1
  const band = lat >= 0 ? 'N' : 'S'
  return `${zone}${band}`
}

// ── Format koordinat ────────────────────────────────────────────────────────

export function fmtCoord(v: number, digits = 6): string {
  return v.toFixed(digits)
}

/** Parse satu baris koordinat: "lon,lat" / "lon lat" / "lat,lon" (auto-detect). */
export function parseCoordLine(line: string): Pt | null {
  const parts = line
    .trim()
    .split(/[,\t;]+|\s{2,}/)
    .map((s) => s.trim().replace(',', '.'))
    .filter((s) => s.length > 0)
  if (parts.length !== 2) return null
  const a = Number(parts[0])
  const b = Number(parts[1])
  if (!isFinite(a) || !isFinite(b)) return null
  // Indonesia: lon ~95..141, lat ~-11..6. Jika dibalik, tukar.
  if (Math.abs(a) <= 90 && Math.abs(b) > 90) return { lon: b, lat: a }
  return { lon: a, lat: b }
}
