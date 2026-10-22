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

/**
 * Tutup ring (tambahkan vertex pertama di akhir) bila belum tertutup,
 * tanpa mutasi array masukan. Shoelace/spherical-excess membutuhkan
 * edge terakhir (vertex terakh → vertex pertama) — tanpa itu luas
 * sistematis kurang satu edge (D1: LUAS tapak + statistik luas peta).
 */
function closeRing(ring: Pt[]): Pt[] {
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (!first || !last) return ring
  if (first.lon !== last.lon || first.lat !== last.lat) return [...ring, first]
  return ring
}

/** Luas polygon (m²). Ring boleh belum tertutup (ditutup otomatis). Akurat ~0.1%. */
export function ringArea(ring: Pt[]): number {
  if (ring.length < 3) return 0
  const pts = closeRing(ring)
  const R = 6378137
  const rad = Math.PI / 180
  let total = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i]
    const p2 = pts[i + 1]
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

// ── Luas ellipsoidal WGS84 (eksak via authalic sphere) ──────────────────────
// QGIS $area (dengan ellipsoid WGS84) menghitung luas di atas ellipsoid,
// bukan bola. Dengan memetakan lintang ke lintang authalic (bola yang
// luasnya sama dengan ellipsoid), rumus spherical-excess menjadi EKSAK.
// Terverifikasi vs template tapak amdalnet: 0.6557225699213085 ha vs
// 0.655722569537535 ha di template (selisih ~4e-13 = noise float).

const WGS84_A = 6378137
const WGS84_F = 1 / 298.257223563
const WGS84_E2 = WGS84_F * (2 - WGS84_F)
const WGS84_E = Math.sqrt(WGS84_E2)

function authalicQ(phi: number): number {
  const s = Math.sin(phi)
  return (
    (1 - WGS84_E2) *
    (s / (1 - WGS84_E2 * s * s) -
      (1 / (2 * WGS84_E)) * Math.log((1 - WGS84_E * s) / (1 + WGS84_E * s)))
  )
}

const AUTHALIC_QP = authalicQ(Math.PI / 2)
const AUTHALIC_R = WGS84_A * Math.sqrt(AUTHALIC_QP / 2)

/** Luas polygon (m²) di atas ellipsoid WGS84 — sama dengan QGIS $area. */
export function ringAreaEllipsoidal(ring: Pt[]): number {
  if (ring.length < 3) return 0
  const pts = closeRing(ring)
  const rad = Math.PI / 180
  let total = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const b1 = Math.asin(authalicQ(p1.lat * rad) / AUTHALIC_QP)
    const b2 = Math.asin(authalicQ(p2.lat * rad) / AUTHALIC_QP)
    total += (p2.lon - p1.lon) * rad * (2 + Math.sin(b1) + Math.sin(b2))
  }
  return Math.abs((total * AUTHALIC_R * AUTHALIC_R) / 2)
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
