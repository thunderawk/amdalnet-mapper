import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type L from 'leaflet'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileDown, FolderOpen, Moon, RotateCcw, Save, Sun } from 'lucide-react'
import MapPanel from '@/components/MapPanel'
import type { AdminPick, DrawMode } from '@/components/MapPanel'
import ProfilePanel from '@/components/ProfilePanel'
import FeatureTable from '@/components/FeatureTable'
import ValidationPanel from '@/components/ValidationPanel'
import FolderExportDialog from '@/components/FolderExportDialog'
import ExportDialog from '@/components/ExportDialog'
import Stepper from '@/components/Stepper'
import type { StepKey } from '@/components/Stepper'
import { LAYERS, LAYER_BY_KEY } from '@/lib/layers'
import type { LayerKey } from '@/lib/layers'
import type { Geom } from '@/lib/geo'
import { fetchWilayahGeometry, reverseGeocode, wilayahLabel } from '@/lib/big'
import type { Wilayah } from '@/lib/big'
import { useTheme } from '@/lib/theme'
import {
  emptyProject,
  featuresOf,
  issueCount,
  loadLocal,
  makeFeature,
  sanitizeProject,
  saveLocal,
  slugify,
  validateProject,
} from '@/lib/project'
import type { Feature, Issue, Project } from '@/lib/project'
import { buildLayerPdf, buildLayerZip, downloadBlob, exportAll } from '@/lib/export'
import type { ImportedFeature } from '@/lib/import'
import { exportToFolder } from '@/lib/folder-export'

export default function App() {
  const { theme, toggle } = useTheme()
  const [project, setProject] = useState<Project>(() => loadLocal() ?? emptyProject())
  const [activeLayer, setActiveLayer] = useState<LayerKey>('titik-pantau')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawMode, setDrawMode] = useState<DrawMode>('none')
  const [exporting, setExporting] = useState<string | null>(null)
  const [folderExportOpen, setFolderExportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  // stepper alur kerja
  const [step, setStep] = useState<StepKey>('profil')
  const [highlight, setHighlight] = useState<'profil' | 'gambar' | 'validasi' | null>(null)
  // pencarian wilayah BIG + mode info administrasi
  const [wilayahBoundary, setWilayahBoundary] = useState<Wilayah | null>(null)
  const [infoMode, setInfoMode] = useState(false)
  const [adminPick, setAdminPick] = useState<AdminPick | null>(null)
  // tab panel untuk mobile
  const [mobileTab, setMobileTab] = useState<'peta' | 'profil' | 'data' | 'validasi'>('peta')

  const mapRef = useRef<L.Map | null>(null)
  const mapElRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // autosave (debounce) — indikator "tersimpan otomatis" ikut diperbarui
  useEffect(() => {
    const t = setTimeout(() => {
      saveLocal(project)
      setLastSaved(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }))
    }, 400)
    return () => clearTimeout(t)
  }, [project])

  const issues = useMemo(() => validateProject(project), [project])
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const def of LAYERS) c[def.key] = featuresOf(project, def.key).length
    return c
  }, [project])

  const updateProfile = useCallback((patch: Partial<Project>) => {
    setProject((p) => ({ ...p, ...patch }))
  }, [])

  const addFeature = useCallback(
    (geom: Geom) => {
      setProject((p) => ({
        ...p,
        features: [...p.features, makeFeature(activeLayer, geom)],
      }))
    },
    [activeLayer],
  )

  const addFeaturesFromPaste = useCallback(
    (pts: { lon: number; lat: number }[], kodePrefix: string) => {
      setProject((p) => ({
        ...p,
        features: [
          ...p.features,
          ...pts.map((pt, i) =>
            makeFeature(
              activeLayer,
              { type: 'Point', c: pt },
              kodePrefix ? `${kodePrefix}${i + 1}` : '',
              '',
            ),
          ),
        ],
      }))
      toast.success(`${pts.length} titik ditambahkan ke ${LAYER_BY_KEY[activeLayer].fileName}`)
    },
    [activeLayer],
  )

  const updateFeature = useCallback((id: string, patch: Partial<Feature>) => {
    setProject((p) => ({
      ...p,
      features: p.features.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }))
  }, [])

  const importFeatures = useCallback(
    (imported: ImportedFeature[]) => {
      setProject((p) => ({
        ...p,
        features: [
          ...p.features,
          ...imported.map((f) =>
            makeFeature(activeLayer, f.geom, f.kode, f.keterangan),
          ),
        ],
      }))
      toast.success(
        `${imported.length} fitur diimpor ke ${LAYER_BY_KEY[activeLayer].fileName}`,
      )
    },
    [activeLayer],
  )

  const deleteFeature = useCallback(
    (id: string) => {
      const doomed = project.features.find((f) => f.id === id)
      if (!doomed) return
      setProject((p) => ({ ...p, features: p.features.filter((f) => f.id !== id) }))
      setSelectedId((s) => (s === id ? null : s))
      toast.success('Fitur dihapus', {
        action: {
          label: 'Urungkan',
          onClick: () =>
            setProject((p) => ({ ...p, features: [...p.features, doomed] })),
        },
      })
    },
    [project],
  )

  const startDraw = useCallback((mode: 'point' | 'polygon') => {
    setDrawMode((m) => (m === mode ? 'none' : mode))
    setSelectedId(null)
  }, [])

  // ── ekspor ──
  /** Error validasi yang menyentuh layer aktif atau profil (wajib bersih sebelum ekspor layer). */
  const layerExportErrors = useCallback(
    (layer: LayerKey): number =>
      validateProject(project).filter(
        (i) => i.level === 'error' && (i.layer === 'profil' || i.layer === layer),
      ).length,
    [project],
  )

  const handleExportLayerZip = useCallback(
    async (layer: LayerKey) => {
      const n = layerExportErrors(layer)
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
    [project, layerExportErrors],
  )

  const handleExportLayerPdf = useCallback(
    async (layer: LayerKey) => {
      const n = layerExportErrors(layer)
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
    [project, layerExportErrors],
  )

  const handleExportAll = useCallback(async () => {
    const { errors } = issueCount(validateProject(project))
    if (errors > 0) {
      toast.error(`Masih ada ${errors} error validasi — perbaiki dulu sebelum export semua`)
      return
    }
    setExporting('all')
    try {
      if (!mapRef.current || !mapElRef.current) throw new Error('Peta belum siap')
      const res = await exportAll(project, mapRef.current, mapElRef.current, (msg) =>
        toast.info(msg),
      )
      downloadBlob(res.blob, res.filename)
      const skipped = res.skipped.length
        ? ` Layer kosong dilewati: ${res.skipped.map((k) => LAYER_BY_KEY[k].fileName).join(', ')}.`
        : ''
      toast.success(`Paket lengkap diunduh (${res.included.length} layer).${skipped}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setExporting(null)
    }
  }, [project])

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
      !window.confirm(
        'Buat proyek baru? Semua fitur di sesi ini akan hilang (simpan JSON dulu bila perlu).',
      )
    ) {
      return
    }
    setProject(emptyProject())
    setSelectedId(null)
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

  // ── klik issue validasi → pindah layer + zoom ke fitur ──
  const handleLocateIssue = useCallback((issue: Issue) => {
    if (issue.layer !== 'profil') {
      setActiveLayer(issue.layer as LayerKey)
    }
    if (issue.featureId) {
      setSelectedId(issue.featureId)
    }
    setMobileTab('peta')
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
      // tahap 2: ambil geometri batas (tahap 1 hanya atribut ringan)
      toast.info(`Memuat batas ${wilayahLabel(w)}…`)
      try {
        const full = await fetchWilayahGeometry(w)
        if (wilayahSeqRef.current !== seq) return
        setWilayahBoundary(full)
        applyWilayahToProfile(full)
        toast.success(`Batas ${wilayahLabel(full)} ditampilkan — profil terisi otomatis`)
      } catch (e) {
        if (wilayahSeqRef.current !== seq) return
        toast.error(
          `Gagal memuat batas wilayah: ${e instanceof Error ? e.message : 'coba lagi'}`,
        )
      }
    },
    [applyWilayahToProfile],
  )

  // ── mode info administrasi ──
  const handlePickAdmin = useCallback(async (lon: number, lat: number) => {
    setAdminPick({ lon, lat, loading: true, wilayah: null, error: '' })
    try {
      const w = await reverseGeocode(lon, lat)
      setAdminPick({
        lon,
        lat,
        loading: false,
        wilayah: w,
        error: w ? '' : 'Titik di luar cakupan data BIG.',
      })
    } catch (e) {
      setAdminPick({
        lon,
        lat,
        loading: false,
        wilayah: null,
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

  // ── stepper ──
  const { errors: validationErrors } = issueCount(issues)
  const stepDone: Record<StepKey, boolean> = {
    profil: !!(project.pemrakarsa && project.kegiatan && project.tahun && project.provinsi),
    gambar: project.features.length > 0,
    validasi: project.features.length > 0 && validationErrors === 0,
    ekspor: false,
  }
  const handleStepSelect = useCallback((s: StepKey) => {
    setStep(s)
    if (s === 'ekspor') {
      setExportOpen(true)
      return
    }
    setHighlight(s)
    if (s === 'profil') setMobileTab('profil')
    else if (s === 'gambar') setMobileTab('peta')
    else if (s === 'validasi') setMobileTab('validasi')
  }, [])

  // ── ekspor per-layer langsung ke folder proyek ──
  const handleFolderExport = useCallback(
    async (subPath: string, include: LayerKey[]) => {
      if (!mapRef.current || !mapElRef.current) {
        toast.error('Peta belum siap')
        return
      }
      const { errors } = issueCount(validateProject(project))
      if (errors > 0) {
        toast.error(`Masih ada ${errors} error validasi — perbaiki dulu sebelum ekspor`)
        return
      }
      setExporting('folder')
      try {
        const res = await exportToFolder({
          project,
          subPath,
          map: mapRef.current,
          mapEl: mapElRef.current,
          include,
          onProgress: (msg) => toast.info(msg),
        })
        updateProfile({ exportSubPath: subPath })
        const skipped = res.skipped.length
          ? ` Dilewati: ${res.skipped.map((k) => LAYER_BY_KEY[k].fileName).join(', ')}.`
          : ''
        toast.success(
          `${res.written.length} folder layer ditulis ke ${subPath}/.${skipped}`,
        )
        setFolderExportOpen(false)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e))
      } finally {
        setExporting(null)
      }
    },
    [project, updateProfile],
  )

  return (
    <div className="bg-muted/30 flex h-screen flex-col">
      <header className="bg-background flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-sm font-semibold">AMDALNET Mapper</h1>
            <p className="text-muted-foreground text-xs">
              Peta Titik &amp; Area Kelola/Pantau — paket SHP + PDF siap upload amdalnet
            </p>
          </div>
          {project.kegiatan && (
            <Badge variant="secondary" className="hidden md:inline-flex">
              {project.kegiatan}
            </Badge>
          )}
          {lastSaved && (
            <span className="text-muted-foreground hidden text-[11px] lg:inline">
              Tersimpan otomatis • {lastSaved}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
            onClick={toggle}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSaveJson}
            title="Unduh arsip proyek sebagai JSON (data sudah tersimpan otomatis di browser)"
            className="hidden sm:inline-flex"
          >
            <Save className="mr-1 h-3.5 w-3.5" />
            Backup
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="hidden sm:inline-flex"
          >
            <FolderOpen className="mr-1 h-3.5 w-3.5" />
            Muat
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
            size="sm"
            variant="outline"
            onClick={handleNewProject}
            className="hidden sm:inline-flex"
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Baru
          </Button>
          <Button size="sm" onClick={() => setExportOpen(true)} disabled={exporting !== null} className="ml-1">
            <FileDown className="mr-1 h-3.5 w-3.5" />
            Ekspor
          </Button>
        </div>
      </header>

      {/* stepper alur kerja */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-background px-3 py-1.5 sm:px-4">
        <Stepper
          active={step}
          done={stepDone}
          errorCount={validationErrors}
          onSelect={handleStepSelect}
        />
      </div>

      <main className="flex min-h-0 flex-1 flex-col p-2 lg:grid lg:grid-cols-[300px_1fr_360px] lg:gap-3 lg:p-3">
        {/* tab panel untuk mobile */}
        <div className="mb-2 flex shrink-0 gap-1 lg:hidden" role="tablist" aria-label="Panel">
          {(
            [
              ['peta', 'Peta'],
              ['profil', 'Profil'],
              ['data', 'Data'],
              ['validasi', 'Validasi'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={mobileTab === key}
              onClick={() => setMobileTab(key)}
              className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${
                mobileTab === key
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground'
              }`}
            >
              {label}
              {key === 'validasi' && validationErrors > 0 && ` (${validationErrors})`}
            </button>
          ))}
        </div>

        <div
          className={`${mobileTab === 'profil' ? 'flex' : 'hidden'} min-h-0 flex-col gap-3 overflow-y-auto lg:flex ${
            highlight === 'profil' ? 'rounded-lg ring-2 ring-primary ring-offset-2' : ''
          }`}
        >
          <ProfilePanel project={project} onChange={updateProfile} />
          <div className="hidden lg:block">
            <ValidationPanel issues={issues} onLocate={handleLocateIssue} />
          </div>
        </div>

        <div
          className={`${mobileTab === 'peta' ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col gap-3 lg:flex ${
            highlight === 'gambar' ? 'rounded-lg ring-2 ring-primary ring-offset-2' : ''
          }`}
        >
          {/* pemilih layer: dropdown compact di HP, tab di desktop */}
          <div className="sm:hidden">
            <Select
              value={activeLayer}
              onValueChange={(v) => {
                setActiveLayer(v as LayerKey)
                setDrawMode('none')
                setSelectedId(null)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LAYERS.map((def) => (
                  <SelectItem key={def.key} value={def.key}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: def.color }}
                      />
                      {def.label}
                      <span className="text-muted-foreground tabular-nums">
                        ({counts[def.key]})
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Tabs
            value={activeLayer}
            onValueChange={(v) => {
              setActiveLayer(v as LayerKey)
              setDrawMode('none')
              setSelectedId(null)
            }}
            className="hidden sm:block"
          >
            <TabsList className="w-full">
              {LAYERS.map((def) => (
                <TabsTrigger key={def.key} value={def.key} className="flex-1 gap-1.5 text-xs">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: def.color }}
                  />
                  {def.label}
                  <span className="text-muted-foreground tabular-nums">{counts[def.key]}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <MapPanel
            project={project}
            activeLayer={activeLayer}
            selectedId={selectedId}
            onSelect={setSelectedId}
            drawMode={drawMode}
            onAddFeature={addFeature}
            onExitDraw={() => setDrawMode('none')}
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
          />
        </div>

        <div className={`${mobileTab === 'data' ? 'flex' : 'hidden'} min-h-0 lg:flex`}>
          <FeatureTable
            project={project}
            activeLayer={activeLayer}
            selectedId={selectedId}
            drawMode={drawMode}
            onSelect={setSelectedId}
            onUpdateFeature={updateFeature}
            onDeleteFeature={deleteFeature}
            onStartDraw={startDraw}
            onAddFeatures={addFeaturesFromPaste}
            onImportFeatures={importFeatures}
            onOpenExport={() => setExportOpen(true)}
            onBulkKode={handleBulkKode}
            exporting={exporting}
          />
        </div>

        {/* validasi khusus mobile (di desktop menempel di kolom kiri) */}
        <div
          className={`${mobileTab === 'validasi' ? 'block' : 'hidden'} min-h-0 overflow-y-auto lg:hidden ${
            highlight === 'validasi' ? 'rounded-lg ring-2 ring-primary ring-offset-2' : ''
          }`}
        >
          <ValidationPanel issues={issues} onLocate={handleLocateIssue} />
        </div>
      </main>
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        project={project}
        counts={counts}
        errorCount={validationErrors}
        exporting={exporting}
        onExportLayerZip={handleExportLayerZip}
        onExportLayerPdf={handleExportLayerPdf}
        onExportAll={handleExportAll}
        onOpenFolderExport={() => {
          setExportOpen(false)
          setFolderExportOpen(true)
        }}
      />
      <FolderExportDialog
        open={folderExportOpen}
        onOpenChange={setFolderExportOpen}
        subPath={project.exportSubPath}
        counts={counts}
        busy={exporting === 'folder'}
        onExport={handleFolderExport}
      />
    </div>
  )
}
