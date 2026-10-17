/**
 * SlotSidebar — isi panel samping arah C: accordion Profil + 5 slot konten,
 * footer "Ekspor Semua Konten" yang selalu kelihatan (pinned).
 * Dipakai di <aside> desktop dan bottom-sheet mobile.
 */
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LAYERS } from '@/lib/layers'
import type { LayerKey } from '@/lib/layers'
import type { DrawMode } from '@/components/MapPanel'
import {
  allFeaturesArea,
  featuresOf,
} from '@/lib/project'
import type { Feature, Issue, Project } from '@/lib/project'
import ProfileAccordion from './ProfileAccordion'
import SlotAccordion from './SlotAccordion'

export type AccKey = 'profil' | LayerKey

interface Props {
  project: Project
  onChangeProfile: (patch: Partial<Project>) => void
  openAcc: AccKey | null
  onToggleAcc: (key: AccKey) => void
  drawMode: DrawMode
  drawLayer: LayerKey | null
  onToggleDraw: (layer: LayerKey) => void
  onOpenPaste: (layer: LayerKey) => void
  onOpenImport: (layer: LayerKey) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  editingId: string | null
  onStartEdit: (id: string) => void
  onCancelEdit: () => void
  onSaveEdit: (id: string, kode: string, keterangan: string) => void
  onDelete: (id: string) => void
  onExportZip: (layer: LayerKey) => void
  onExportPdf: (layer: LayerKey) => void
  exporting: string | null
  layerErrorCount: (layer: LayerKey) => number
  layerIssues: (layer: LayerKey) => Issue[]
  onLocateIssue: (issue: Issue) => void
  onBulkKode: (prefix: string, ids: string[]) => void
  // footer bulk export
  totalFeatures: number
  totalErrors: number
  onBulkExport: () => void
}

export default function SlotSidebar(p: Props) {
  const { project } = p
  const nFeat = p.totalFeatures

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="acc-scroll">
        <ProfileAccordion
          project={project}
          onChange={p.onChangeProfile}
          open={p.openAcc === 'profil'}
          onToggle={() => p.onToggleAcc('profil')}
        />
        {LAYERS.map((def) => {
          const feats: Feature[] = featuresOf(project, def.key)
          return (
            <SlotAccordion
              key={def.key}
              def={def}
              features={feats}
              totalAreaM2={allFeaturesArea(project, def.key)}
              open={p.openAcc === def.key}
              onToggle={() => p.onToggleAcc(def.key)}
              drawing={p.drawMode !== 'none' && p.drawLayer === def.key}
              onToggleDraw={() => p.onToggleDraw(def.key)}
              onOpenPaste={() => p.onOpenPaste(def.key)}
              onOpenImport={() => p.onOpenImport(def.key)}
              selectedId={p.selectedId}
              onSelect={p.onSelect}
              editingId={p.editingId}
              onStartEdit={p.onStartEdit}
              onCancelEdit={p.onCancelEdit}
              onSaveEdit={p.onSaveEdit}
              onDelete={p.onDelete}
              onExportZip={() => p.onExportZip(def.key)}
              onExportPdf={() => p.onExportPdf(def.key)}
              exporting={p.exporting === `zip:${def.key}` || p.exporting === `pdf:${def.key}`}
              errorCount={p.layerErrorCount(def.key)}
              issues={p.layerIssues(def.key)}
              onLocateIssue={p.onLocateIssue}
              onBulkKode={p.onBulkKode}
            />
          )
        })}
      </div>
      {/* footer pinned */}
      <div className="flex-none border-t border-border p-4">
        <p className="mb-1 flex items-center gap-2 text-[13px] font-semibold">
          <Download className="h-4 w-4" />
          Ekspor Semua Konten
        </p>
        <p className="text-muted-foreground mb-3 text-xs tabular-nums">
          5 konten · {nFeat} fitur — tiap konten ZIP + PDF
        </p>
        {p.totalErrors > 0 && (
          <p className="text-destructive mb-2 text-xs">
            {p.totalErrors} error validasi — perbaiki dulu sebelum mengunduh.
          </p>
        )}
        <Button
          className="w-full"
          disabled={p.exporting !== null || p.totalErrors > 0 || nFeat === 0}
          onClick={p.onBulkExport}
          title="Unduh amdalnet_mapper.zip — 5 folder konten, tiap folder berisi ZIP + PDF"
        >
          {p.exporting === 'all' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Unduh ZIP
        </Button>
      </div>
    </div>
  )
}
