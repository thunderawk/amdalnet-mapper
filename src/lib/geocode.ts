/**
 * Nominatim (OpenStreetMap) — pencarian tempat umum & reverse-geocode
 * cadangan bila layanan BIG tidak menjawab.
 *
 * Kebijakan penggunaan: maks ~1 request/detik, sertakan referer wajar.
 * Tanpa API key.
 */

export interface PlaceResult {
  name: string
  detail: string
  lon: number
  lat: number
}

interface NominatimItem {
  display_name: string
  lat: string
  lon: string
}

export async function searchPlace(q: string, limit = 6): Promise<PlaceResult[]> {
  const query = q.trim()
  if (query.length < 3) return []
  const url =
    `https://nominatim.openstreetmap.org/search?format=json&limit=${limit}` +
    `&countrycodes=id&accept-language=id&q=${encodeURIComponent(query)}`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 20000)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`Nominatim merespons HTTP ${res.status}`)
    const data = (await res.json()) as NominatimItem[]
    return data
      .map((d) => {
        const parts = d.display_name.split(',').map((p) => p.trim())
        return {
          name: parts[0] ?? d.display_name,
          detail: parts.slice(1, 4).join(', '),
          lon: Number(d.lon),
          lat: Number(d.lat),
        }
      })
      .filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat))
  } finally {
    clearTimeout(timer)
  }
}

export async function reversePlace(lon: number, lat: number): Promise<string> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}` +
    `&lon=${lon}&zoom=14&accept-language=id`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 20000)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`Nominatim merespons HTTP ${res.status}`)
    const data = (await res.json()) as { display_name?: string }
    return data.display_name ?? ''
  } finally {
    clearTimeout(timer)
  }
}
