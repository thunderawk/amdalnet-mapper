/**
 * LocationSearch — cari lokasi di atas peta.
 * Dua sumber: wilayah resmi BIG (desa/kecamatan/kab-kota + kode wilayah)
 * dan tempat umum (Nominatim). Pilih hasil wilayah BIG untuk menggambar
 * batasnya di peta + mengisi otomatis profil proyek.
 */
import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, MapPin, Search, X } from 'lucide-react'
import { LEVEL_LABEL, searchWilayah, wilayahLabel } from '@/lib/big'
import type { Wilayah } from '@/lib/big'
import { searchPlace } from '@/lib/geocode'
import type { PlaceResult } from '@/lib/geocode'

interface Props {
  onFlyTo: (lon: number, lat: number) => void
  onWilayah: (w: Wilayah | null) => void
  activeWilayahLabel: string | null
}

export default function LocationSearch({ onFlyTo, onWilayah, activeWilayahLabel }: Props) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [wilayah, setWilayah] = useState<Wilayah[]>([])
  const [places, setPlaces] = useState<PlaceResult[]>([])
  const boxRef = useRef<HTMLDivElement>(null)
  const seqRef = useRef(0)

  useEffect(() => {
    if (q.trim().length < 3) {
      setWilayah([])
      setPlaces([])
      setOpen(false)
      return
    }
    setLoading(true)
    setError('')
    const seq = ++seqRef.current
    const t = setTimeout(async () => {
      try {
        const [w, p] = await Promise.all([
          searchWilayah(q.trim()),
          searchPlace(q.trim()),
        ])
        if (seqRef.current !== seq) return
        setWilayah(w)
        setPlaces(p)
        if (w.length === 0 && p.length === 0) {
          setError('Tidak ditemukan di data BIG maupun tempat umum.')
        }
        setOpen(true)
      } catch (e) {
        if (seqRef.current === seq) {
          setWilayah([])
          setPlaces([])
          setError(
            e instanceof Error
              ? `Pencarian gagal: ${e.message}`
              : 'Pencarian gagal — periksa koneksi internet.',
          )
          setOpen(true)
        }
      } finally {
        if (seqRef.current === seq) setLoading(false)
      }
    }, 450)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const pickWilayah = (w: Wilayah) => {
    onWilayah(w)
    setOpen(false)
    setQ('')
  }
  const pickPlace = (p: PlaceResult) => {
    onFlyTo(p.lon, p.lat)
    setOpen(false)
    setQ('')
  }
  const clearWilayah = () => onWilayah(null)

  return (
    <div ref={boxRef} className="relative w-64 sm:w-72">
      <div className="flex items-center gap-1.5 rounded-md border bg-background/95 px-2.5 py-1.5 shadow-sm backdrop-blur">
        {loading ? (
          <Loader2 className="text-muted-foreground h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <Search className="text-muted-foreground h-4 w-4 shrink-0" />
        )}
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => (wilayah.length > 0 || places.length > 0) && setOpen(true)}
          placeholder="Cari desa, kecamatan, lokasi…"
          className="h-6 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
        />
        {activeWilayahLabel && (
          <button
            type="button"
            onClick={clearWilayah}
            className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px]"
            title="Hapus batas wilayah"
          >
            <span className="max-w-24 truncate">{activeWilayahLabel}</span>
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full right-0 left-0 z-[600] mt-1 max-h-72 overflow-y-auto rounded-md border bg-background shadow-lg">
          {wilayah.length === 0 && places.length === 0 && !loading && (
            <p className="text-muted-foreground p-3 text-xs">
              {error || 'Tidak ditemukan. Coba kata kunci lain.'}
            </p>
          )}
          {wilayah.length > 0 && (
            <div className="p-1.5">
              <p className="text-muted-foreground px-1.5 py-1 text-[10px] font-medium tracking-wide uppercase">
                Wilayah resmi (BIG)
              </p>
              {wilayah.map((w, i) => (
                <button
                  key={`${w.level}-${w.kode}-${i}`}
                  type="button"
                  onClick={() => pickWilayah(w)}
                  className="hover:bg-muted flex w-full items-start gap-2 rounded px-1.5 py-1.5 text-left"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium">
                      {wilayahLabel(w)}
                    </span>
                    <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                      <Badge variant="outline" className="h-4 px-1 text-[9px]">
                        {LEVEL_LABEL[w.level]}
                      </Badge>
                      {w.kode && <span className="font-mono">{w.kode}</span>}
                      {w.luasKm2 > 0 && <span>· {w.luasKm2.toLocaleString('id-ID', { maximumFractionDigits: 1 })} km²</span>}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {places.length > 0 && (
            <div className="border-t p-1.5">
              <p className="text-muted-foreground px-1.5 py-1 text-[10px] font-medium tracking-wide uppercase">
                Tempat
              </p>
              {places.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickPlace(p)}
                  className="hover:bg-muted flex w-full items-start gap-2 rounded px-1.5 py-1.5 text-left"
                >
                  <Search className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium">{p.name}</span>
                    <span className="text-muted-foreground block truncate text-[10px]">
                      {p.detail}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
