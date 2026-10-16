/**
 * Overlay otomatis dari OpenStreetMap via Overpass API (tanpa API key):
 * jaringan jalan + batas administrasi (desa/kota/provinsi) di area pandang.
 */
export interface OverpassWay {
  coords: [number, number][] // [lon, lat]
  name?: string
}

/** bbox = [south, west, north, east] */
export type BBox = [number, number, number, number]

const ENDPOINT = 'https://overpass-api.de/api/interpreter'

interface OverpassElement {
  type: string
  geometry?: { lat: number; lon: number }[]
  members?: { type: string; role?: string; geometry?: { lat: number; lon: number }[] }[]
  tags?: Record<string, string>
}

async function runQuery(q: string, signal?: AbortSignal): Promise<OverpassElement[]> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(q)}`,
    signal,
  })
  if (!res.ok) {
    throw new Error(`Overpass menolak permintaan (HTTP ${res.status}) — coba lagi sebentar`)
  }
  const json = (await res.json()) as { elements?: OverpassElement[] }
  return json.elements ?? []
}

function bboxStr(b: BBox): string {
  return `${b[0]},${b[1]},${b[2]},${b[3]}`
}

export async function fetchRoads(b: BBox, signal?: AbortSignal): Promise<OverpassWay[]> {
  const q = `[out:json][timeout:30];
way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified|service"](${bboxStr(b)});
out geom;`
  const els = await runQuery(q, signal)
  const ways: OverpassWay[] = []
  for (const el of els) {
    if (!el.geometry || el.geometry.length < 2) continue
    ways.push({
      coords: el.geometry.map((g) => [g.lon, g.lat] as [number, number]),
      name: el.tags?.name,
    })
  }
  return ways
}

/** admin_level Indonesia: 7 = desa/kelurahan, 6 = kota/kabupaten, 4 = provinsi. */
export async function fetchAdminBoundary(
  b: BBox,
  level: 4 | 6 | 7,
  signal?: AbortSignal,
): Promise<OverpassWay[]> {
  const q = `[out:json][timeout:60];
relation["boundary"="administrative"]["admin_level"="${level}"](${bboxStr(b)});
out geom;`
  const els = await runQuery(q, signal)
  const ways: OverpassWay[] = []
  for (const el of els) {
    for (const m of el.members ?? []) {
      if (m.type !== 'way' || !m.geometry || m.geometry.length < 2) continue
      ways.push({
        coords: m.geometry.map((g) => [g.lon, g.lat] as [number, number]),
        name: el.tags?.name,
      })
    }
  }
  return ways
}

export const OVERLAY_DEFS = [
  { key: 'jalan', label: 'Jaringan Jalan', color: '#78716c', admin: null },
  { key: 'desa', label: 'Batas Desa/Kelurahan', color: '#16a34a', admin: 7 as const },
  { key: 'kota', label: 'Batas Kota/Kabupaten', color: '#2563eb', admin: 6 as const },
  { key: 'provinsi', label: 'Batas Provinsi', color: '#dc2626', admin: 4 as const },
] as const

export type OverlayKey = (typeof OVERLAY_DEFS)[number]['key']

/** true bila bbox berubah signifikan (>15% dari sisi terpanjang). */
export function bboxChangedEnough(a: BBox, b: BBox): boolean {
  const dLat = Math.abs(a[0] - b[0])
  const dLon = Math.abs(a[1] - b[1])
  const span = Math.max(a[2] - a[0], a[1] - b[3])
  return dLat > span * 0.15 || dLon > span * 0.15
}
