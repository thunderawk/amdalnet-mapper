/**
 * AMDALNET Mapper — arah C "Sketsa Murni".
 * Shell: header ramping + sidebar slot (Profil + 5 konten upload amdalnet)
 * + peta. Mesin (SHP writer, validasi, BIG, ekspor) tidak berubah.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type L from 'leaflet'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FolderOpen, Moon, PanelBottom, RotateCcw, Save, Sun } from 'lucide-react'
import MapPanel from '@/components/MapPanel'
import type { AdminPick, DrawMode } from '@/components/MapPanel'
import SlotSidebar from '@/components/SlotSidebar'
import type { AccKey } from '@/components/SlotSidebar'
import PasteDialog from '@/components/PasteDialog'
import ImportDialog from '@/components/ImportDialog'
import { LAYER_BY_KEY } from '@/lib/layers'
import type { LayerKey } from '@/lib/layers'
import type { Geom } from '@/lib/geo'
import { fetchWilayahGeometry, reverseGeocode, wilayahLabel } from '@/lib/big'
import type { Wilayah } from '@/lib/big'
import { useTheme } from '@/lib/theme'
import {
  emptyProject,
  issueCount,
  loadLocal,
  makeFeature,
  sanitizeProject,
  saveLocal,
  slugify,
  validateProject,
} from '@/lib/project'
import type { Feature, Issue, Project } from '@/lib/project'
import {
  buildLayerPdf,
  buildLayerZip,
  downloadBlob,
  exportFolderZip,
} from '@/lib/export'
import type { ImportedFeature } from '@/lib/import'

export default function App() {
  const { theme, toggle } = useTheme()
  const [project, setProject] = useState<Project>(() => loadLocal() ?? emptyProject())
  const [activeLayer, setActiveLayer] = useState<LayerKey>('titik-pantau')
  const [openAcc, setOpenAcc] = useState<AccKey | null>('titik-pantau')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [drawMode, setDrawMode] = useState<DrawMode>('none')
  const [drawLayer, setDrawLayer] = useState<LayerKey | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)
  const [pasteSlot, setPasteSlot] = useState<LayerKey | null>(null)
  const [importSlot, setImportSlot] = useState<LayerKey | null>(null)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(true)
  // pencarian wilayah BIG + mode info administrasi
  const [wilayahBoundary, setWilayahBoundary] = useState<Wilayah | null>(null)
  const [infoMode, setInfoMode] = useState(false)
  const [adminPick, setAdminPick] = useState<AdminPick | null>(null)

  const mapRef = useRef<L.Map | null>(null)
  const mapElRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // autosave (debounce)
  useEffect(() => {
    const t = setTimeout(() => {
      saveLocal(project)
      setLastSaved(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }))
    }, 400)
    return () => clearTimeout(t)
  }, [project])

  const issues = useMemo(() => validateProject(project), [project])
  const { errors: totalErrors } = issueCount(issues)

  // ── fitur ──
  const addFeature = useCallback((geom: Geom, layer: LayerKey) => {
    setProject((p) => ({
      ...p,
      features: [...p.features, makeFeature(layer, geom)],
    }))
  }, [])

  const addFeaturesFromPaste = useCallback(
    (pts: { lon: number; lat: number }[], kodePrefix: string, layer: LayerKey) => {
      setProject((p) => ({
        ...p,
        features: [
          ...p.features,
          ...pts.map((pt, i) =>
            makeFeature(layer, { type: 'Point', c: pt }, kodePrefix ? `${kodePrefix}${i + 1}` : '', ''),
          ),
        ],
      }))
      toast.success(`${pts.length} titik ditambahkan ke ${LAYER_BY_KEY[layer].fileName}`)
    },
    [],
  )

  const updateFeature = useCallback((id: string, patch: Partial<Feature>) => {
    setProject((p) => ({
      ...p,
      features: p.features.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }))
  }, [])

  const importFeatures = useCallback((imported: ImportedFeature[], layer: LayerKey) => {
    setProject((p) => ({
      ...p,
      features: [
        ...p.features,
        ...imported.map((f) => makeFeature(layer, f.geom, f.kode, f.keterangan)),
      ],
    }))
    toast.success(`${imported.length} fitur diimpor ke ${LAYER_BY_KEY[layer].fileName}`)
  }, [])

  const deleteFeature = useCallback(
    (id: string) => {
      const doomed = project.features.find((f) => f.id === id)
      if (!doomed) return
      setProject((p) => ({ ...p, features: p.features.filter((f) => f.id !== id) }))
      setSelectedId((s) => (s === id ? null : s))
      if (editingId === id) setEditingId(null)
      toast.success('Fitur dihapus', {
        action: {
          label: 'Urungkan',
          onClick: () => setProject((p) => ({ ...p, features: [...p.features, doomed] })),
        },
      })
    },
    [project, editingId],
  )

  // ── gambar & edit ──
  const handleToggleDraw = useCallback(
    (layer: LayerKey) => {
      const mode = LAYER_BY_KEY[layer].geometry === 'point' ? 'point' : 'polygon'
      if (drawMode === mode && drawLayer === layer) {
        setDrawMode('none')
        setDrawLayer(null)
      } else {
        setEditingId(null)
        setSelectedId(null)
        setDrawLayer(layer)
        setActiveLayer(layer)
        setDrawMode(mode)
      }
    },
    [drawMode, drawLayer],
  )

  const handleStartEdit = useCallback((id: string) => {
    setEditingId(id)
    setSelectedId(id)
    setDrawMode('none')
    setDrawLayer(null)
  }, [])

  const handleMoveFeature = useCallback(
    (id: string, lon: number, lat: number) => {
      updateFeature(id, { geom: { type: 'Point', c: { lon, lat } } })
    },
    [updateFeature],
  )

  // ── accordion ──
  const handleToggleAcc = useCallback((key: AccKey) => {
    setOpenAcc((cur) => (cur === key ? null : key))
    if (key !== 'profil') setActiveLayer(key)
  }, [])

  // ── validasi per slot ──
  const layerErrorCount = useCallback(
    (layer: LayerKey): number =>
      issues.filter((i) => i.level === 'error' && (i.layer === 'profil' || i.layer === layer)).length,
    [issues],
  )
  const layerIssues = useCallback(
    (layer: LayerKey): Issue[] => issues.filter((i) => i.layer === layer),
    [issues],
  )

  const handleLocateIssue = useCallback((issue: Issue) => {
    if (issue.layer !== 'profil') {
      setActiveLayer(issue.layer as LayerKey)
      setOpenAcc(issue.layer as LayerKey)
    } else {
      setOpenAcc('profil')
    }
    if (issue.featureId) setSelectedId(issue.featureId)
    setSheetOpen(true)
  }, [])

  // ── ekspor ──
  const handleExportLayerZip = useCallback(
    async (layer: LayerKey) => {
      const n = layerErrorCount(layer)
      if (n > 0) {
        toast.error(
          `${n} error validasi pada ${LAYER_BY_KEY[layer].fileName} / profil — perbaiki dulu sebelum ekspor ZIP`,
        )
        return
      }
      setExporting(`zip:${layer}`)
      try {
          const blob = await buildLayerZip(project, layer)
          downloadBlob(blob, `${LAYER_BY_KEY[layer].fileName}.zip`)
        toast.success(`ZIP ${LAYER_BY_KEY[layer].fileName} diunduh`)
      } catch (e) {
          toast.error(e instanceof Error ? e.message : String(e))
      } finally {
        setExporting(null)
      }
    },
    [project, layerErrorCount],
  )

  const handleExportLayerPdf = useCallback(
    async (layer: LayerKey) => {
      const n = layerErrorCount(layer)
      if (n > 0) {
        toast.error(
          `${n} error validasi pada ${LAYER_BY_KEY[layer].fileName} / profil — perbaiki dulu sebelum ekspor PDF`,
        )
        return
      }
      setExporting(`pdf:${layer}`)
      try {
        if (!mapRef.current || !mapElRef.current) throw new Error('Peta belum siap')
        const blob = await buildLayerPdf(mapRef.current, mapElRef.current)
        downloadBlob(blob, `${LAYER_BY_KEY[layer].fileName}.pdf`)
        toast.success(`PDF ${LAYER_BY_KEY[layer].fileName} diunduh`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e))
      } finally {
        setExporting(null)
      }
    },
    [project, layerErrorCount],
  )

  /** Bulk: amdalnet_mapper.zip → 5 folder konten, tiap folder ZIP + PDF. */
  const handleBulkExport = useCallback(async () => {
    const { errors } = issueCount(validateProject(project))
    if (errors > 0) {
      toast.error(`Masih ada ${errors} error validasi — perbaiki dulu sebelum ekspor semua`)
      return
    }
    if (!mapRef.current || !mapElRef.current) {
      toast.error('Peta belum siap')
      return
    }
    setExporting('all')
    try {
      const res = await exportFolderZip(project, mapRef.current, mapElRef.current, (msg) =>
        toast.info(msg),
      )
      downloadBlob(res.blob, res.filename)
      const skipped = res.skipped.length
        ? ` Konten kosong dilewati: ${res.skipped.map((k) => LAYER_BY_KEY[k].fileName).join(', ')}.`
        : ''
      toast.success(`amdalnet_mapper.zip diunduh (${res.included.length} konten).${skipped}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setExporting(null)
    }
  }, [project])

  // ── proyek: backup / muat / baru ──
  const handleSaveJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
    downloadBlob(blob, `AMDALNET_proyek_${slugify(project.kegiatan || 'proyek')}.json`)
    toast.success('Proyek disimpan sebagai JSON')
  }, [project])

  const handleLoadJson = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const p = sanitizeProject(JSON.parse(String(reader.result)))
        setProject(p)
        toast.success(`Proyek dimuat — ${p.features.length} fitur`)
      } catch {
        toast.error('File JSON tidak valid')
      }
    }
    reader.readAsText(file)
  }, [])

  const handleNewProject = useCallback(() => {
    if (
      project.features.length > 0 &&
      !window.confirm('Buat proyek baru? Semua fitur di sesi ini akan hilang (simpan JSON dulu bila perlu).')
    ) {
      return
    }
    setProject(emptyProject())
    setSelectedId(null)
    setEditingId(null)
    toast.info('Proyek baru dimulai')
  }, [project])

  // ── bulk KODE berurutan ──
  const handleBulkKode = useCallback((prefix: string, ids: string[]) => {
    const order = new Map(ids.map((id, i) => [id, i] as [string, number]))
    setProject((p) => ({
      ...p,
      features: p.features.map((f) =>
        order.has(f.id) ? { ...f, kode: `${prefix}${(order.get(f.id) ?? 0) + 1}` } : f,
      ),
    }))
    toast.success(`${ids.length} fitur diberi KODE ${prefix}1…${prefix}${ids.length}`)
  }, [])

  // ── navigasi peta ──
  const handleFlyTo = useCallback((lon: number, lat: number, zoom = 14) => {
    mapRef.current?.flyTo([lat, lon], zoom, { duration: 1.2 })
  }, [])

  // ── wilayah BIG → gambar batas + isi profil otomatis ──
  const applyWilayahToProfile = useCallback((w: Wilayah) => {
    const patch: Partial<Project> = {}
    if (w.provinsi) patch.provinsi = w.provinsi
    if (w.kabkota) patch.kabupaten = w.kabkota
    if (w.level === 'kecamatan' && w.nama) patch.kecamatan = w.nama
    if (w.level === 'keldesa') {
      if (w.kecamatan) patch.kecamatan = w.kecamatan
      if (w.nama) patch.desa = w.nama
    }
    setProject((p) => ({ ...p, ...patch }))
  }, [])

  const wilayahSeqRef = useRef(0)
  const handleWilayah = useCallback(
    async (w: Wilayah | null) => {
      const seq = ++wilayahSeqRef.current
      if (!w) {
        setWilayahBoundary(null)
        return
      }
      toast.info(`Memuat batas ${wilayahLabel(w)}…`)
      try {
        const full = await fetchWilayahGeometry(w)
        if (wilayahSeqRef.current !== seq) return
        setWilayahBoundary(full)
        applyWilayahToProfile(full)
        toast.success(`Batas ${wilayahLabel(full)} ditampilkan — profil terisi otomatis`)
      } catch (e) {
        if (wilayahSeqRef.current !== seq) return
        toast.error(`Gagal memuat batas wilayah: ${e instanceof Error ? e.message : 'coba lagi'}`)
      }
    },
    [applyWilayahToProfile],
  )

  // ── mode info administrasi ──
  const handlePickAdmin = useCallback(async (lon: number, lat: number) => {
    setAdminPick({ lon, lat, loading: true, wilayah: null, error: '' })
    try {
      const w = await reverseGeocode(lon, lat)
      setAdminPick({ lon, lat, loading: false, wilayah: w, error: w ? '' : 'Titik di luar cakupan data BIG.' })
    } catch (e) {
      setAdminPick({
        lon, lat, loading: false, wilayah: null,
        error: e instanceof Error ? e.message : 'Gagal memuat data wilayah.',
      })
    }
  }, [])

  const handleUseAdmin = useCallback(
    (w: Wilayah) => {
      applyWilayahToProfile(w)
      setAdminPick(null)
      setInfoMode(false)
      toast.success('Profil proyek diisi dari detail administrasi')
    },
    [applyWilayahToProfile],
  )

  const updateProfile = useCallback((patch: Partial<Project>) => {
    setProject((p) => ({ ...p, ...patch }))
  }, [])

  const sidebar = (
    <SlotSidebar
      project={project}
      onChangeProfile={updateProfile}
      openAcc={openAcc}
      onToggleAcc={handleToggleAcc}
      drawMode={drawMode}
      drawLayer={drawLayer}
      onToggleDraw={handleToggleDraw}
      onOpenPaste={setPasteSlot}
      onOpenImport={setImportSlot}
      selectedId={selectedId}
      onSelect={setSelectedId}
      editingId={editingId}
      onStartEdit={handleStartEdit}
      onCancelEdit={() => setEditingId(null)}
      onSaveEdit={(id, kode, keterangan) => {
        updateFeature(id, { kode, keterangan })
        setEditingId(null)
      }}
      onDelete={deleteFeature}
      onExportZip={handleExportLayerZip}
      onExportPdf={handleExportLayerPdf}
      exporting={exporting}
      layerErrorCount={layerErrorCount}
      layerIssues={layerIssues}
      onLocateIssue={handleLocateIssue}
      onBulkKode={handleBulkKode}
      totalFeatures={project.features.length}
      totalErrors={totalErrors}
      onBulkExport={handleBulkExport}
    />
  )

  return (
    <div className="bg-background text-foreground flex h-dvh flex-col overflow-hidden">
      <header className="border-border flex h-14 flex-none items-center justify-between border-b px-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 md:hidden"
            onClick={() => setSheetOpen((v) => !v)}
            title="Panel konten"
          >
            <PanelBottom className="h-5 w-5" />
          </Button>
          <h1 className="truncate text-[15px] font-semibold tracking-tight">AMDALNET Mapper</h1>
          {lastSaved && (
            <span className="text-muted-foreground hidden text-[11px] lg:inline">
              Tersimpan otomatis · {lastSaved}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
            onClick={toggle}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="hidden h-8 w-8 sm:inline-flex"
            onClick={handleSaveJson}
            title="Backup proyek sebagai JSON"
          >
            <Save className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="hidden h-8 w-8 sm:inline-flex"
            onClick={() => fileInputRef.current?.click()}
            title="Muat proyek dari JSON"
          >
            <FolderOpen className="h-4 w-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleLoadJson(f)
              e.target.value = ''
            }}
          />
          <Button
            size="icon"
            variant="ghost"
            className="hidden h-8 w-8 sm:inline-flex"
            onClick={handleNewProject}
            title="Proyek baru"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="border-border hidden w-[320px] flex-none border-r md:block">
          {sidebar}
        </aside>
        <main className="relative min-w-0 flex-1">
          <div className="absolute inset-0 flex flex-col">
            <MapPanel
              project={project}
              activeLayer={activeLayer}
              selectedId={selectedId}
              onSelect={setSelectedId}
              drawMode={drawMode}
              onAddFeature={(geom) => {
                if (drawLayer) addFeature(geom, drawLayer)
              }}
              onExitDraw={() => {
                setDrawMode('none')
                setDrawLayer(null)
              }}
              mapRef={mapRef}
              mapElRef={mapElRef}
              wilayah={wilayahBoundary}
              onFlyTo={handleFlyTo}
              onWilayah={handleWilayah}
              infoMode={infoMode}
              onToggleInfoMode={() => {
                setInfoMode((v) => !v)
                setAdminPick(null)
              }}
              onPickAdmin={handlePickAdmin}
              adminPick={adminPick}
              onCloseAdmin={() => setAdminPick(null)}
              onUseAdmin={handleUseAdmin}
              editingId={editingId}
              onMoveFeature={handleMoveFeature}
            />
          </div>

          {/* bottom sheet — mobile */}
          {sheetOpen && (
            <div className="fixed inset-0 z-[1100] md:hidden">
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => setSheetOpen(false)}
                aria-hidden
              />
              <div className="bg-background border-border absolute inset-x-0 bottom-0 flex h-[62dvh] flex-col overflow-hidden rounded-t-2xl border-t">
                <button
                  type="button"
                  className="flex-none py-2.5"
                  onClick={() => setSheetOpen(false)}
                  aria-label="Tutup panel"
                >
                  <span className="bg-border mx-auto block h-1 w-10 rounded-full" />
                </button>
                <div className="min-h-0 flex-1">{sidebar}</div>
              </div>
            </div>
          )}
        </main>
      </div>

      <PasteDialog
        open={pasteSlot !== null}
        onOpenChange={(v) => !v && setPasteSlot(null)}
        onAdd={(pts, prefix) => {
          if (pasteSlot) addFeaturesFromPaste(pts, prefix, pasteSlot)
          setPasteSlot(null)
        }}
      />
      {importSlot && (
        <ImportDialog
          open
          onOpenChange={(v) => !v && setImportSlot(null)}
          geometryKind={LAYER_BY_KEY[importSlot].geometry}
          layerName={LAYER_BY_KEY[importSlot].fileName}
          onImport={(imported) => {
            importFeatures(imported, importSlot)
            setImportSlot(null)
          }}
        />
      )}
    </div>
  )
}
