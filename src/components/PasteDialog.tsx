/**
 * PasteDialog — input bulk koordinat (dari Excel/CSV) untuk layer titik.
 * Menerima "lon,lat" per baris; auto-detect urutan lat,lon.
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
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { parseCoordLine } from '@/lib/geo'
import CoordConverter from './CoordConverter'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (pts: { lon: number; lat: number }[], kodePrefix: string) => void
}

const SAMPLE = '110.611000, -7.731440\n110.610970, -7.730540\n110.610960, -7.729640'

export default function PasteDialog({ open, onOpenChange, onAdd }: Props) {
  const [text, setText] = useState('')
  const [prefix, setPrefix] = useState('')

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  const parsed = lines.map((l) => ({ line: l, pt: parseCoordLine(l) }))
  const okCount = parsed.filter((p) => p.pt).length
  const badLines = parsed.filter((p) => !p.pt)

  const handleAdd = () => {
    const pts = parsed.map((p) => p.pt).filter((p): p is { lon: number; lat: number } => p !== null)
    if (pts.length === 0) return
    onAdd(pts, prefix.trim())
    setText('')
    setPrefix('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah Titik dari Koordinat</DialogTitle>
          <DialogDescription>
            Tempel banyak titik sekaligus, atau konversi format koordinat (DMS/UTM) ke
            desimal derajat dulu.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="paste">
          <TabsList className="w-full">
            <TabsTrigger value="paste" className="flex-1">
              Paste bulk
            </TabsTrigger>
            <TabsTrigger value="convert" className="flex-1">
              Konverter koordinat
            </TabsTrigger>
          </TabsList>
          <TabsContent value="paste" className="mt-3">
            <PasteForm
              text={text}
              setText={setText}
              prefix={prefix}
              setPrefix={setPrefix}
              okCount={okCount}
              badLines={badLines}
              onAdd={handleAdd}
              onClose={() => onOpenChange(false)}
            />
          </TabsContent>
          <TabsContent value="convert" className="mt-3">
            <CoordConverter
              onAppendDd={(lines) => setText((t) => (t ? t + '\n' : '') + lines.join('\n'))}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

/** Form paste bulk (isi asli dialog). */
function PasteForm({
  text,
  setText,
  prefix,
  setPrefix,
  okCount,
  badLines,
  onAdd,
  onClose,
}: {
  text: string
  setText: (t: string) => void
  prefix: string
  setPrefix: (p: string) => void
  okCount: number
  badLines: { line: string; pt: { lon: number; lat: number } | null }[]
  onAdd: () => void
  onClose: () => void
}) {
  return (
    <div>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="paste-area" className="text-xs">
              Koordinat
            </Label>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => setText(SAMPLE)}
            >
              Isi contoh
            </Button>
          </div>
          <Textarea
            id="paste-area"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'110.611000, -7.731440\n110.610970, -7.730540'}
            className="h-40 font-mono text-xs"
          />
          <p className="text-muted-foreground text-[11px]">
            Satu titik per baris, format <code className="bg-muted rounded px-1">lon, lat</code>{' '}
            desimal (bisa juga spasi/tab). Urutan terbalik dideteksi otomatis. Untuk
            format DMS/DMM/UTM pakai tab Konverter.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="kode-prefix" className="text-xs">
            Awalan KODE (opsional)
          </Label>
          <Input
            id="kode-prefix"
            value={prefix}
            placeholder="mis. B → B1, B2, B3…"
            onChange={(e) => setPrefix(e.target.value)}
          />
          {prefix.trim() && okCount > 0 && (
            <p className="text-muted-foreground text-xs">
              {Array.from({ length: Math.min(okCount, 3) }, (_, i) => `${prefix.trim()}${i + 1}`).join(', ')}
              {okCount > 3 ? `, … ${prefix.trim()}${okCount}` : ''}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          {text.trim().length > 0 && (
            <>
              <Badge variant={okCount > 0 ? 'default' : 'destructive'}>
                {okCount} koordinat valid
              </Badge>
              {badLines.length > 0 && (
                <Badge variant="destructive">{badLines.length} baris tidak terbaca</Badge>
              )}
            </>
          )}
        </div>

        {badLines.length > 0 && (
          <div className="bg-destructive/10 text-destructive rounded-md p-2 text-xs">
            Baris bermasalah:
            <ul className="mt-1 list-inside list-disc font-mono">
              {badLines.slice(0, 5).map((b, i) => (
                <li key={i}>{b.line}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={onClose}>
          Batal
        </Button>
        <Button onClick={onAdd} disabled={okCount === 0}>
          Tambahkan {okCount > 0 ? `${okCount} titik` : ''}
        </Button>
      </DialogFooter>
    </div>
  )
}
