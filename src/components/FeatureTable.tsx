/**
 * FeatureTable — tabel atribut layer aktif: edit KODE & KETERANGAN,
 * luas otomatis (area), aksi zoom/hapus, tombol gambar & ekspor per layer.
 */
import { useMemo, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Crosshair, Pen, MapPin, Trash2, FileDown, ClipboardPaste, Search, Upload, Wand2 } from 'lucide-react'
import { LAYER_BY_KEY } from '@/lib/layers'
import type { LayerKey } from '@/lib/layers'
import {
  allFeaturesArea,
  featureArea,
  featuresOf,
} from '@/lib/project'
import type { Feature, Project } from '@/lib/project'
import { formatArea } from '@/lib/geo'
import PasteDialog from './PasteDialog'
import ImportDialog from './ImportDialog'
import type { ImportedFeature } from '@/lib/import'

interface Props {
  project: Project
  activeLayer: LayerKey
  selectedId: string | null
  drawMode: 'none' | 'point' | 'polygon'
  onSelect: (id: string | null) => void
  onUpdateFeature: (id: string, patch: Partial<Feature>) => void
  onDeleteFeature: (id: string) => void
  onStartDraw: (mode: 'point' | 'polygon') => void
  onAddFeatures: (pts: { lon: number; lat: number }[], kodePrefix: string) => void
  onImportFeatures: (features: ImportedFeature[]) => void
  onOpenExport: () => void
  onBulkKode: (prefix: string, ids: string[]) => void
  exporting: string | null
}

export default function FeatureTable(props: Props) {
  const {
    project,
    activeLayer,
    selectedId,
    drawMode,
    onSelect,
    onUpdateFeature,
    onDeleteFeature,
    onStartDraw,
    onAddFeatures,
    onImportFeatures,
    onOpenExport,
    onBulkKode,
    exporting,
  } = props
  const [pasteOpen, setPasteOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [bulkPrefix, setBulkPrefix] = useState('')
  const def = LAYER_BY_KEY[activeLayer]
  const feats = featuresOf(project, activeLayer)
  const isPoint = def.geometry === 'point'
  // Panduan Tapak v2.5 tidak mengenal KODE — sembunyikan kolom & bulk-nya
  const isTapak = activeLayer === 'tapak'
  const totalArea = allFeaturesArea(project, activeLayer)

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return feats
    return feats.filter(
      (f) =>
        f.kode.toLowerCase().includes(q) || f.keterangan.toLowerCase().includes(q),
    )
  }, [feats, filter])

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Badge variant="outline" style={{ borderColor: def.color, color: def.color }}>
              {def.fileName}
            </Badge>
            <span className="text-muted-foreground text-xs font-normal">
              {feats.length} fitur
              {!isPoint && feats.length > 0 && ` · ${formatArea(totalArea)}`}
            </span>
          </CardTitle>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {isPoint ? (
            <Button
              size="sm"
              variant={drawMode === 'point' ? 'default' : 'outline'}
              onClick={() => onStartDraw('point')}
            >
              <MapPin className="mr-1 h-3.5 w-3.5" />
              Tambah Titik
            </Button>
          ) : (
            <Button
              size="sm"
              variant={drawMode === 'polygon' ? 'default' : 'outline'}
              onClick={() => onStartDraw('polygon')}
            >
              <Pen className="mr-1 h-3.5 w-3.5" />
              Gambar Area
            </Button>
          )}
          {isPoint && (
            <Button size="sm" variant="outline" onClick={() => setPasteOpen(true)}>
              <ClipboardPaste className="mr-1 h-3.5 w-3.5" />
              Paste Koordinat
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1 h-3.5 w-3.5" />
            Impor
          </Button>
          <Button
            size="sm"
            disabled={feats.length === 0 || exporting !== null}
            onClick={onOpenExport}
            title="Buka dialog ekspor (ZIP SHP / PDF per layer)"
          >
            <FileDown className="mr-1 h-3.5 w-3.5" />
            Ekspor…
          </Button>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        {feats.length === 0 ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 p-4 text-center">
            <Crosshair className="h-6 w-6 opacity-40" />
            <p className="text-xs font-medium">Belum ada {def.label.toLowerCase()}.</p>
            <p className="text-muted-foreground text-[11px]">Pilih salah satu cara menambah:</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onStartDraw(isPoint ? 'point' : 'polygon')}
              >
                {isPoint ? <MapPin className="mr-1 h-3.5 w-3.5" /> : <Pen className="mr-1 h-3.5 w-3.5" />}
                {isPoint ? 'Gambar manual' : 'Gambar manual'}
              </Button>
              {isPoint && (
                <Button size="sm" variant="outline" onClick={() => setPasteOpen(true)}>
                  <ClipboardPaste className="mr-1 h-3.5 w-3.5" />
                  Paste koordinat
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="mr-1 h-3.5 w-3.5" />
                Impor file
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col gap-2">
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
                <Input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Cari KODE / keterangan…"
                  className="h-7 pl-7 text-xs"
                />
              </div>
            </div>
            <div className="flex gap-1.5">
              {!isTapak && (
                <>
                  <Input
                    value={bulkPrefix}
                    onChange={(e) => setBulkPrefix(e.target.value)}
                    placeholder="Awalan KODE mis. B"
                    className="h-7 w-28 text-xs"
                    title="Isi KODE berurutan (B1, B2, …) untuk baris yang tampil"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={!bulkPrefix.trim() || filtered.length === 0}
                    onClick={() => {
                      onBulkKode(bulkPrefix.trim(), filtered.map((f) => f.id))
                      setBulkPrefix('')
                    }}
                    title={`Isi KODE berurutan untuk ${filtered.length} baris yang tampil`}
                  >
                <Wand2 className="mr-1 h-3.5 w-3.5" />
                Isi KODE ({filtered.length})
              </Button>
                </>
              )}
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    {!isTapak && <TableHead className="w-20">KODE</TableHead>}
                    <TableHead>KETERANGAN</TableHead>
                    {!isPoint && <TableHead className="w-20 text-right">Luas</TableHead>}
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((f, i) => (
                    <TableRow
                      key={f.id}
                      className={f.id === selectedId ? 'bg-accent' : undefined}
                    >
                      <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                      {!isTapak && (
                        <TableCell>
                          <Input
                            className="h-7 w-20 px-1.5 text-xs"
                            value={f.kode}
                            placeholder="—"
                            onChange={(e) => onUpdateFeature(f.id, { kode: e.target.value })}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <Input
                          className="h-7 px-1.5 text-xs"
                          value={f.keterangan}
                          placeholder="nama lokasi + jenis dampak"
                          onChange={(e) => onUpdateFeature(f.id, { keterangan: e.target.value })}
                        />
                      </TableCell>
                      {!isPoint && (
                        <TableCell className="text-right text-xs tabular-nums">
                          {formatArea(featureArea(f))}
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Zoom ke fitur"
                            onClick={() => onSelect(f.id)}
                          >
                            <Crosshair className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive h-7 w-7"
                            title="Hapus fitur"
                            onClick={() => onDeleteFeature(f.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filtered.length === 0 && (
                <p className="text-muted-foreground p-4 text-center text-xs">
                  Tidak ada yang cocok dengan “{filter}”.
                </p>
              )}
            </ScrollArea>
          </div>
        )}
      </CardContent>
      <PasteDialog
        open={pasteOpen}
        onOpenChange={setPasteOpen}
        onAdd={onAddFeatures}
      />
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        geometryKind={def.geometry}
        layerName={def.fileName}
        onImport={onImportFeatures}
      />
    </Card>
  )
}
