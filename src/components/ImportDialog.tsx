/**
 * ImportDialog — impor geometri dari SHP/GeoJSON/CSV ke layer aktif.
 * ZIP berisi quartet SHP didukung; CRS dideteksi dari .prj.
 */
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { importFiles } from '@/lib/import'
import type { ImportedFeature, ImportGeometryKind } from '@/lib/import'
import { formatArea } from '@/lib/geo'
import { centroid } from '@/lib/project'
import { ringArea } from '@/lib/geo'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  geometryKind: ImportGeometryKind
  layerName: string
  onImport: (features: ImportedFeature[]) => void
}

export default function ImportDialog({
  open,
  onOpenChange,
  geometryKind,
  layerName,
  onImport,
}: Props) {
  const [features, setFeatures] = useState<ImportedFeature[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setBusy(true)
    setError('')
    setFeatures(null)
    setFileName(Array.from(files).map((f) => f.name).join(', '))
    try {
      const parsed = await importFiles(Array.from(files), geometryKind)
      setFeatures(parsed)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleConfirm = () => {
    if (!features || features.length === 0) return
    onImport(features)
    setFeatures(null)
    setFileName('')
    onOpenChange(false)
  }

  const totalArea = (features ?? []).reduce(
    (a, f) => a + (f.geom.type === 'Polygon' ? ringArea(f.geom.ring) : 0),
    0,
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Impor Geometri ke {layerName}</DialogTitle>
          <DialogDescription>
            Format: <b>.zip</b> (quartet SHP .shp/.shx/.dbf/.prj), <b>.shp</b>,{' '}
            <b>.geojson</b>, atau <b>.csv</b> (kolom lon,lat atau WKT). CRS terbaca dari
            file .prj — Web Mercator, UTM, atau WGS84 derajat dideteksi otomatis.
            {geometryKind === 'point'
              ? ' Layer ini hanya menerima titik.'
              : ' Layer ini hanya menerima polygon.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <input
              type="file"
              accept=".zip,.shp,.geojson,.json,.csv"
              multiple
              className="block w-full cursor-pointer rounded-md border border-dashed p-6 text-center text-sm"
              onChange={(e) => void handleFiles(e.target.files)}
            />
            {busy && <p className="text-muted-foreground mt-1 text-xs">Membaca file…</p>}
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive rounded-md p-2 text-xs">
              {error}
            </div>
          )}

          {features && features.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="default">{features.length} fitur terbaca</Badge>
                <span className="text-muted-foreground">dari {fileName}</span>
                {geometryKind === 'polygon' && totalArea > 0 && (
                  <Badge variant="secondary">total {formatArea(totalArea)}</Badge>
                )}
              </div>
              <div className="bg-muted/50 max-h-40 overflow-y-auto rounded-md p-2 text-xs">
                <table className="w-full">
                  <tbody>
                    {features.slice(0, 50).map((f, i) => {
                      let coord = ''
                      if (f.geom.type === 'Point') {
                        coord = `${f.geom.c.lon.toFixed(6)}, ${f.geom.c.lat.toFixed(6)}`
                      } else {
                        const c = centroid(f.geom.ring)
                        coord = `pusat ${c.lon.toFixed(6)}, ${c.lat.toFixed(6)} · ${formatArea(ringArea(f.geom.ring))}`
                      }
                      return (
                        <tr key={i}>
                          <td className="w-8 text-right tabular-nums">{i + 1}</td>
                          <td className="font-mono">{coord}</td>
                          <td className="truncate pl-2">
                            <span className="text-muted-foreground">ID</span>{' '}
                            <span className="font-mono">{f.dbId || '0'}</span>
                            {' · '}
                            {f.kode || '—'} {f.keterangan ? `· ${f.keterangan}` : ''}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {features.length > 50 && (
                  <p className="text-muted-foreground mt-1">
                    … dan {features.length - 50} fitur lainnya
                  </p>
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                KODE &amp; Keterangan yang terbaca dari file otomatis masuk; bisa disunting
                lagi di tabel setelah impor.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={handleConfirm} disabled={!features || features.length === 0}>
            Impor {features ? `${features.length} fitur` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
