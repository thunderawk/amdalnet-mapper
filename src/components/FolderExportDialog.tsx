/**
 * FolderExportDialog — ekspor paket per-section langsung ke folder proyek.
 * User memilih folder proyek (mis. 2026_PERMATA-REGENCY); tool membuat
 * <subPath>/<layer>/ berisi quartet SHP + ZIP + PDF + CSV per layer.
 */
import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, FolderOutput } from 'lucide-react'
import { LAYERS } from '@/lib/layers'
import type { LayerKey } from '@/lib/layers'
import { folderExportSupported } from '@/lib/folder-export'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  subPath: string
  counts: Record<string, number>
  busy: boolean
  onExport: (subPath: string, include: LayerKey[]) => void
}

export default function FolderExportDialog({
  open,
  onOpenChange,
  subPath,
  counts,
  busy,
  onExport,
}: Props) {
  const [path, setPath] = useState(subPath)
  const [selected, setSelected] = useState<Set<LayerKey>>(new Set())

  // sinkronkan saat dialog dibuka
  useEffect(() => {
    if (!open) return
    setPath(subPath)
    setSelected(
      new Set(LAYERS.filter((d) => (counts[d.key] ?? 0) > 0).map((d) => d.key)),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const supported = folderExportSupported()
  const toggle = (key: LayerKey) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const totalFeatures = LAYERS.filter((d) => selected.has(d.key)).reduce(
    (a, d) => a + (counts[d.key] ?? 0),
    0,
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOutput className="h-4 w-4" />
            Ekspor per-Layer ke Folder Proyek
          </DialogTitle>
          <DialogDescription>
            Pilih <b>folder proyek</b> (mis. <code className="bg-muted rounded px-1">2026_PERMATA-REGENCY</code>).
            Tool membuat subfolder per layer berisi quartet SHP + ZIP siap-upload + PDF peta + CSV —
            langsung bisa diunggah ke amdalnet tanpa perlu pindah file manual.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="subpath" className="text-xs">
              Path relatif di dalam folder proyek
            </Label>
            <Input
              id="subpath"
              value={path}
              placeholder="04_GIS/amdalnet"
              onChange={(e) => setPath(e.target.value)}
            />
            <p className="text-muted-foreground text-[11px]">
              Contoh hasil:{' '}
              <code className="bg-muted rounded px-1">
                {path || '04_GIS/amdalnet'}/titik_kelola/Titik Kelola.zip
              </code>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Layer yang diekspor</Label>
            <div className="space-y-1">
              {LAYERS.map((def) => {
                const n = counts[def.key] ?? 0
                return (
                  <label
                    key={def.key}
                    className={`flex items-center gap-2 text-xs ${n === 0 ? 'opacity-50' : 'cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      className="accent-primary h-3 w-3"
                      checked={selected.has(def.key)}
                      disabled={n === 0}
                      onChange={() => toggle(def.key)}
                    />
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: def.color }}
                    />
                    <span>{def.fileName}</span>
                    <span className="text-muted-foreground">
                      → {def.folder}/ ({n} fitur{n === 0 ? ' — kosong' : ''})
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          {!supported && (
            <div className="flex items-start gap-1.5 rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Browser ini tidak mendukung penulisan langsung ke folder (butuh Chrome/Edge).
                Alternatif: tombol <b>ZIP SHP</b> / <b>PDF Peta</b> per layer di tabel, atau{' '}
                <b>Export Semua</b> di header.
              </span>
            </div>
          )}

          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Badge variant="secondary">{totalFeatures} fitur total</Badge>
            <Badge variant="outline">{selected.size} folder layer</Badge>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Batal
          </Button>
          <Button
            onClick={() => onExport(path.trim(), Array.from(selected))}
            disabled={busy || selected.size === 0 || !supported || !path.trim()}
          >
            {busy ? 'Mengekspor…' : 'Pilih Folder & Ekspor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
