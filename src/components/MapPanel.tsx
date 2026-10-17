/**
 * MapPanel — peta Leaflet dengan draw custom (titik & polygon), 5 layer,
 * basemap switcher, seleksi & zoom fitur.
 */
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Info, Loader2, Undo2, X } from 'lucide-react'
import type { Geom, Pt } from '@/lib/geo'
import { formatArea, ringArea } from '@/lib/geo'
import { LAYERS, LAYER_BY_KEY } from '@/lib/layers'
import type { LayerKey } from '@/lib/layers'
import { featuresOf } from '@/lib/project'
import type { Feature, Project } from '@/lib/project'
import { LEVEL_LABEL } from '@/lib/big'
import type { Wilayah } from '@/lib/big'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export type DrawMode = 'none' | 'point' | 'polygon'

/** Hasil klik mode info administrasi. */
export interface AdminPick {
  lon: number
  lat: number
  loading: boolean
  wilayah: Wilayah | null
  error: string
}

interface Props {
  project: Project
  activeLayer: LayerKey
  selectedId: string | null
  onSelect: (id: string | null) => void
  drawMode: DrawMode
  onAddFeature: (geom: Geom) => void
  onExitDraw: () => void
  mapRef: React.RefObject<L.Map | null>
  mapElRef: React.RefObject<HTMLDivElement | null>
  /** Mode info administrasi (klik peta → detail wilayah). */
  infoMode: boolean
  onToggleInfoMode: () => void
  onPickAdmin: (lon: number, lat: number) => void
  adminPick: AdminPick | null
  onCloseAdmin: () => void
  onUseAdmin: (w: Wilayah) => void
  /** Fitur titik yang sedang diedit — markernya bisa diseret di peta. */
  editingId: string | null
  onMoveFeature: (id: string, lon: number, lat: number) => void
}

/**
 * Satu-satunya basemap: citra satelit Esri World Imagery — sesuai contoh
 * JUKNIS & pratinjau peta di amdalnet (satelit + titik/polygon merah).
 * Opsi basemap: Esri World Imagery (bawaan) + Google Satellite (atas permintaan user 2026-10-18).
 */
const BASEMAPS: Record<string, { url: string; attribution: string; maxZoom: number }> = {
  'Esri Satelit': {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  'Google Satelit': {
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: 'Google',
    maxZoom: 20,
  },
}
const DEFAULT_BASEMAP = 'Esri Satelit'

export default function MapPanel(props: Props) {
  const {
    project,
    activeLayer,
    selectedId,
    onSelect,
    drawMode,
    onAddFeature,
    onExitDraw,
    mapRef,
    mapElRef,
    infoMode,
    onToggleInfoMode,
    onPickAdmin,
    adminPick,
    onCloseAdmin,
    onUseAdmin,
    editingId,
    onMoveFeature,
  } = props

  const groupsRef = useRef<Map<LayerKey, L.LayerGroup>>(new Map())
  const tempRef = useRef<{ pts: Pt[]; line: L.Polyline | null; verts: L.CircleMarker[] }>({
    pts: [],
    line: null,
    verts: [],
  })
  /** Undo vertex terakhir saat menggambar polygon (diisi oleh efek draw). */
  const undoVertexRef = useRef<(() => void) | null>(null)
  const initedRef = useRef(false)
  /** Statistik gambar berjalan: jumlah vertex + luas sementara (m²). */
  const [drawStats, setDrawStats] = useState<{ verts: number; areaM2: number }>({
    verts: 0,
    areaM2: 0,
  })

  // ── init peta sekali ──
  useEffect(() => {
    const el = mapElRef.current
    if (!el || initedRef.current) return
    initedRef.current = true

    const map = L.map(el, { center: [-2.5, 118], zoom: 5, zoomControl: false })
    mapRef.current = map
    // kontrol zoom di kanan atas (kiri atas dipakai panel status layer)
    L.control.zoom({ position: 'topright' }).addTo(map)

    const baseLayers: Record<string, L.TileLayer> = {}
    for (const [name, b] of Object.entries(BASEMAPS)) {
      baseLayers[name] = L.tileLayer(b.url, {
        attribution: b.attribution,
        maxZoom: b.maxZoom,
        crossOrigin: true,
      })
    }
    baseLayers[DEFAULT_BASEMAP].addTo(map)

    for (const def of LAYERS) {
      groupsRef.current.set(def.key, L.layerGroup().addTo(map))
    }

    // class penanda basemap satelit — dark mode memakai filter khusus
    map.getContainer().classList.add('basemap-satellite')

    // kontrol layer: pilihan basemap + overlay 5 layer konten
    const overlayObj: Record<string, L.LayerGroup> = {}
    for (const def of LAYERS) overlayObj[def.label] = groupsRef.current.get(def.key)!
    L.control.layers(baseLayers, overlayObj, { position: 'topright' }).addTo(map)

    setTimeout(() => map.invalidateSize(), 100)
    return () => {
      map.remove()
      mapRef.current = null
      initedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── render ulang semua fitur ──
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const def of LAYERS) {
      const g = groupsRef.current.get(def.key)!
      g.clearLayers()
      const feats = featuresOf(project, def.key)
      for (const f of feats) {
        const isSel = f.id === selectedId
        const isEditing = f.id === editingId && def.geometry === 'point'
        const layer: L.Layer = isEditing
          ? editingPointMarker(def, f, onMoveFeature)
          : def.geometry === 'point'
            ? pointLayer(def, f, isSel)
            : areaLayer(def, f, isSel)
        const tip = isEditing
          ? 'Seret untuk memindahkan titik ini'
          : `${f.kode || '?'}${f.keterangan ? ' — ' + f.keterangan : ''}`
        layer.bindTooltip(tip, { permanent: false, direction: 'top', className: 'amdal-tip' })
        if (!isEditing) layer.on('click', () => onSelect(f.id))
        g.addLayer(layer)
      }
    }
  }, [project, selectedId, editingId, onSelect, onMoveFeature, mapRef])

  // ── zoom ke layer aktif saat ganti tab ──
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const feats = featuresOf(project, activeLayer)
    const b = boundsOf(feats)
    if (b) map.fitBounds(b, { padding: [40, 40], maxZoom: 17 })
  }, [activeLayer, project, mapRef])

  // ── zoom ke fitur terseleksi ──
  useEffect(() => {
    if (!selectedId) return
    const map = mapRef.current
    if (!map) return
    const f = project.features.find((x) => x.id === selectedId)
    if (!f) return
    const b = boundsOf([f])
    if (b) map.fitBounds(b, { padding: [80, 80], maxZoom: 18 })
  }, [selectedId, project, mapRef])

  // ── mode info administrasi: klik peta → reverse-geocode ──
  useEffect(() => {
    const map = mapRef.current
    if (!map || !infoMode) return
    map.getContainer().style.cursor = 'help'
    const onClick = (e: L.LeafletMouseEvent) => {
      onPickAdmin(e.latlng.lng, e.latlng.lat)
    }
    map.on('click', onClick)
    return () => {
      map.off('click', onClick)
      map.getContainer().style.cursor = ''
    }
  }, [infoMode, onPickAdmin, mapRef])

  // ── mode gambar titik ──
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (drawMode !== 'point') return
    const onClick = (e: L.LeafletMouseEvent) => {
      onAddFeature({ type: 'Point', c: { lon: e.latlng.lng, lat: e.latlng.lat } })
    }
    map.on('click', onClick)
    map.getContainer().style.cursor = 'crosshair'
    return () => {
      map.off('click', onClick)
      map.getContainer().style.cursor = ''
    }
  }, [drawMode, onAddFeature, mapRef])

  // ── mode gambar polygon ──
  useEffect(() => {
    const map = mapRef.current
    if (!map || drawMode !== 'polygon') return
    map.getContainer().style.cursor = 'crosshair'
    const t = tempRef.current
    t.pts = []
    clearTemp(map, t)

    const syncStats = () => {
      const n = t.pts.length
      const areaM2 = n >= 3 ? ringArea([...t.pts, t.pts[0]]) : 0
      setDrawStats({ verts: n, areaM2 })
    }
    // undo vertex terakhir — dipanggil dari tombol di bar status gambar
    undoVertexRef.current = () => {
      if (t.pts.length === 0) return
      t.pts.pop()
      redraw()
      syncStats()
    }
    syncStats()

    const redraw = () => {
      if (t.line) {
        t.line.setLatLngs(t.pts.map((p) => [p.lat, p.lon] as L.LatLngTuple))
      } else if (t.pts.length >= 2) {
        t.line = L.polyline(
          t.pts.map((p) => [p.lat, p.lon] as L.LatLngTuple),
          { color: '#111', weight: 2, dashArray: '6 4' },
        ).addTo(map)
      }
      while (t.verts.length < t.pts.length) {
        const p = t.pts[t.verts.length]
        const m = L.circleMarker([p.lat, p.lon], { radius: 4, color: '#111', fillOpacity: 1 }).addTo(map)
        t.verts.push(m)
      }
      while (t.verts.length > t.pts.length) {
        const m = t.verts.pop()
        if (m) map.removeLayer(m)
      }
    }

    const onClick = (e: L.LeafletMouseEvent) => {
      const p: Pt = { lon: e.latlng.lng, lat: e.latlng.lat }
      const last = t.pts[t.pts.length - 1]
      // dedup klik ganda (dblclick memicu 2 click di titik yang sama)
      if (last) {
        const a = map.latLngToContainerPoint([last.lat, last.lon])
        const b = map.latLngToContainerPoint([p.lat, p.lon])
        if (a.distanceTo(b) < 12) return
      }
      t.pts.push(p)
      redraw()
      syncStats()
    }
    const onDbl = () => finish()
    const finish = () => {
      if (t.pts.length >= 3) {
        const ring = [...t.pts]
        onAddFeature({ type: 'Polygon', ring })
      }
      clearTemp(map, t)
      onExitDraw()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearTemp(map, t)
        onExitDraw()
      } else if (e.key === 'Enter') {
        finish()
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        undoVertexRef.current?.()
      }
    }
    map.on('click', onClick)
    map.on('dblclick', onDbl)
    window.addEventListener('keydown', onKey)
    return () => {
      map.off('click', onClick)
      map.off('dblclick', onDbl)
      window.removeEventListener('keydown', onKey)
      clearTemp(map, t)
      undoVertexRef.current = null
      setDrawStats({ verts: 0, areaM2: 0 })
      map.getContainer().style.cursor = ''
    }
  }, [drawMode, onAddFeature, onExitDraw, mapRef])

  const def = LAYER_BY_KEY[activeLayer]
  const nFeat = featuresOf(project, activeLayer).length

  return (
    <Card className="relative flex-1 overflow-hidden p-0">
      <div ref={mapElRef} className="absolute inset-0 z-0" />
      {/* bar status layer + pencarian lokasi */}
      <div className="pointer-events-none absolute top-3 left-3 z-[500] flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="pointer-events-auto flex items-center gap-2 rounded-md border bg-background/95 px-3 py-1.5 shadow-sm backdrop-blur">
            <Badge variant="outline" style={{ borderColor: def.color, color: def.color }}>
              {def.fileName}
            </Badge>
            <span className="text-muted-foreground text-xs">{nFeat} fitur</span>
          </div>
          <Button
            size="sm"
            variant={infoMode ? 'default' : 'outline'}
            className="pointer-events-auto h-8 bg-background/95 shadow-sm backdrop-blur"
            onClick={onToggleInfoMode}
            title="Mode info: klik peta untuk melihat detail administrasi (desa–provinsi)"
          >
            <Info className="h-3.5 w-3.5" />
            <span className="ml-1 hidden sm:inline">Info Wilayah</span>
          </Button>
        </div>
        {drawMode !== 'none' && (
          <div className="pointer-events-auto max-w-72 rounded-md border bg-background/95 px-3 py-1.5 text-xs shadow-sm backdrop-blur">
            <p>
              {drawMode === 'point'
                ? 'Klik di peta untuk menambah titik. Esc untuk batal.'
                : 'Klik sudut-sudut area, double-click / Enter untuk selesai, Esc untuk batal.'}
            </p>
            {drawMode === 'polygon' && (
              <div className="mt-1.5 flex items-center justify-between gap-2 border-t pt-1.5">
                <span className="text-muted-foreground tabular-nums">
                  {drawStats.verts} titik
                  {drawStats.verts >= 3 && ` · ${formatArea(drawStats.areaM2)}`}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5 text-[11px]"
                  disabled={drawStats.verts === 0}
                  onClick={() => undoVertexRef.current?.()}
                  title="Urungkan titik terakhir (Backspace)"
                >
                  <Undo2 className="mr-1 h-3 w-3" />
                  Urungkan titik
                </Button>
              </div>
            )}
          </div>
        )}
        {infoMode && (
          <div className="pointer-events-auto max-w-72 rounded-md border border-primary/40 bg-background/95 px-3 py-1.5 text-xs shadow-sm backdrop-blur">
            Klik di peta untuk melihat desa, kecamatan, kabupaten/kota, dan provinsi titik tersebut.
          </div>
        )}
      </div>
      {/* tombol keluar mode gambar */}
      {drawMode !== 'none' && (
        <div className="absolute bottom-4 left-1/2 z-[500] -translate-x-1/2">
          <Button size="sm" variant="secondary" onClick={onExitDraw}>
            Selesai menggambar
          </Button>
        </div>
      )}
      {/* kartu detail administrasi */}
      {adminPick && (
        <div className="absolute bottom-3 left-3 z-[500] w-72 max-w-[calc(100%-1.5rem)]">
          <Card className="p-3 shadow-lg">
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <p className="text-xs font-semibold">Detail Administrasi</p>
              <button
                type="button"
                onClick={onCloseAdmin}
                className="text-muted-foreground hover:text-foreground"
                title="Tutup"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {adminPick.loading ? (
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat batas wilayah…
              </p>
            ) : adminPick.wilayah ? (
              <AdminDetail wilayah={adminPick.wilayah} onUse={() => onUseAdmin(adminPick.wilayah!)} />
            ) : (
              <p className="text-destructive text-xs">
                {adminPick.error || 'Tidak ditemukan di data BIG.'}
              </p>
            )}
            <p className="text-muted-foreground mt-1.5 font-mono text-[10px]">
              {adminPick.lon.toFixed(5)}, {adminPick.lat.toFixed(5)}
            </p>
          </Card>
        </div>
      )}
    </Card>
  )
}

/** Marker titik yang sedang diedit — bisa diseret langsung di peta. */
function editingPointMarker(
  def: (typeof LAYERS)[number],
  f: Feature,
  onMove: (id: string, lon: number, lat: number) => void,
): L.Marker {
  const c = f.geom.type === 'Point' ? f.geom.c : { lon: 0, lat: 0 }
  const m = L.marker([c.lat, c.lon], {
    icon: L.divIcon({
      html: `<div style="width:20px;height:20px;border-radius:9999px;background:${def.color};border:3px solid #fff;box-shadow:0 0 0 4px ${def.color}44,0 2px 6px rgba(0,0,0,.45);cursor:grab"></div>`,
      className: '',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    }),
    draggable: true,
    zIndexOffset: 1000,
  })
  m.on('dragend', () => {
    const ll = m.getLatLng()
    onMove(f.id, ll.lng, ll.lat)
  })
  return m
}

function pointLayer(def: (typeof LAYERS)[number], f: Feature, isSel: boolean): L.CircleMarker {
  const c = f.geom.type === 'Point' ? f.geom.c : { lon: 0, lat: 0 }
  return L.circleMarker([c.lat, c.lon], {
    radius: isSel ? 9 : 6,
    color: isSel ? '#111' : def.color,
    weight: isSel ? 3 : 2,
    fillColor: def.fill,
    fillOpacity: 1,
  })
}

function areaLayer(def: (typeof LAYERS)[number], f: Feature, isSel: boolean): L.Polygon {
  const ring = f.geom.type === 'Polygon' ? f.geom.ring : []
  const latlngs = ring.map((p) => [p.lat, p.lon] as L.LatLngTuple)
  return L.polygon(latlngs, {
    color: isSel ? '#111' : def.color,
    weight: isSel ? 4 : 2,
    fillColor: def.color,
    fillOpacity: def.key === 'tapak' ? 0.08 : 0.18,
  })
}

export function boundsOf(feats: Feature[]): L.LatLngBounds | null {
  const pts: Pt[] = feats.flatMap((f) =>
    f.geom.type === 'Point' ? [f.geom.c] : f.geom.ring,
  )
  if (pts.length === 0) return null
  return L.latLngBounds(pts.map((p) => [p.lat, p.lon] as L.LatLngTuple))
}

interface TempState {
  pts: Pt[]
  line: L.Polyline | null
  verts: L.CircleMarker[]
}

function clearTemp(map: L.Map, t: TempState): void {
  if (t.line) map.removeLayer(t.line)
  for (const m of t.verts) map.removeLayer(m)
  t.pts = []
  t.line = null
  t.verts = []
}

/** Isi kartu detail administrasi (hasil reverse-geocode BIG). */
function AdminDetail({ wilayah, onUse }: { wilayah: Wilayah; onUse: () => void }) {
  const rows: [string, string][] = [
    ['Desa/Kelurahan', wilayah.nama],
    ['Kecamatan', wilayah.kecamatan],
    ['Kab/Kota', wilayah.kabkota],
    ['Provinsi', wilayah.provinsi],
  ]
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <Badge variant="outline" className="text-[10px]">
          {LEVEL_LABEL[wilayah.level]}
        </Badge>
        {wilayah.kode && (
          <span className="text-muted-foreground font-mono text-[10px]">{wilayah.kode}</span>
        )}
      </div>
      <dl className="space-y-0.5 text-xs">
        {rows.map(
          ([k, v]) =>
            v && (
              <div key={k} className="flex gap-2">
                <dt className="text-muted-foreground w-24 shrink-0">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ),
        )}
      </dl>
      <Button size="sm" variant="outline" className="mt-2 w-full" onClick={onUse}>
        Pakai untuk profil proyek
      </Button>
      <p className="text-muted-foreground mt-1 text-[10px]">
        Sumber: BIG RBI (tidak resmi untuk dokumen — verifikasi ulang).
      </p>
    </div>
  )
}
