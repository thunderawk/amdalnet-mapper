/**
 * ExportDialog — satu pintu ekspor: per-layer (ZIP/PDF + slot upload tujuan),
 * paket semua, dan ekspor ke folder proyek.
 */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { AlertCircle, FileArchive, FileDown, FolderOutput, Loader2 } from 'lucide-react'
import { LAYERS } from '@/lib/layers'
import type { LayerKey } from '@/lib/layers'
import type { Project } from '@/lib/project'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
  counts: Record<string, number>
  errorCount: number
  exporting: string | null
  onExportLayerZip: (layer: LayerKey) => void
  onExportLayerPdf: (layer: LayerKey) => void
  onExportAll: () => void
  onOpenFolderExport: () => void
}

export default function ExportDialog(props: Props) {
  const {
    open, onOpenChange, counts, errorCount, exporting,
    onExportLayerZip, onExportLayerPdf, onExportAll, onOpenFolderExport,
  } = props
  const blocked = errorCount > 0
  const busy = exporting !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Ekspor Paket Upload</DialogTitle>
          <DialogDescription>
            Setiap ZIP berisi kuartet SHP siap upload ke slot amdalnet yang tertera.
          </DialogDescription>
        </DialogHeader>

        {blocked && (
          <div className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-md p-2.5 text-xs">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Masih ada {errorCount} error validasi — perbaiki dulu di panel Validasi
              sebelum mengekspor.
            </span>
          </div>
        )}

        <div className="space-y-2">
          {LAYERS.map((def) => {
            const n = counts[def.key] ?? 0
            return (
              <div
                key={def.key}
                className="flex items-center gap-2 rounded-md border p-2.5"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: def.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{def.fileName}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {n} fitur
                    </Badge>
                  </div>
                  <p className="text-muted-foreground truncate text-[11px]">
                    Slot upload: “{def.slot}”
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={n === 0 || blocked || busy}
                    onClick={() => onExportLayerZip(def.key)}
                    title={n === 0 ? 'Layer kosong' : `Unduh ${def.fileName}.zip`}
                  >
                    {exporting === `zip:${def.key}` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileArchive className="h-3.5 w-3.5" />
                    )}
                    <span className="ml-1 hidden sm:inline">ZIP</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={n === 0 || blocked || busy}
                    onClick={() => onExportLayerPdf(def.key)}
                    title={n === 0 ? 'Layer kosong' : `Unduh ${def.fileName}.pdf`}
                  >
                    {exporting === `pdf:${def.key}` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileDown className="h-3.5 w-3.5" />
                    )}
                    <span className="ml-1 hidden sm:inline">PDF</span>
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        <Separator />

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="flex-1"
            disabled={blocked || busy}
            onClick={onExportAll}
          >
            {exporting === 'all' ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <FileArchive className="mr-1 h-4 w-4" />
            )}
            {exporting === 'all' ? 'Menyiapkan paket…' : 'Export Semua Layer'}
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            disabled={blocked || busy}
            onClick={onOpenFolderExport}
            title="Tulis paket per-layer langsung ke folder proyek (04_GIS/amdalnet/…)"
          >
            <FolderOutput className="mr-1 h-4 w-4" />
            Ekspor ke Folder Proyek
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
