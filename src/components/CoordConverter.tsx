/**
 * CoordConverter — konversi satu per satu: tempel koordinat format apa pun
 * (DD / DMS / DMM / UTM), lihat hasil DD + DMS + DMM + UTM, lalu
 * masukkan ke daftar paste sebagai desimal derajat.
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ArrowDownToLine } from 'lucide-react'
import {
  formatDMM,
  formatDMS,
  formatUtm,
  lonLatToUtm,
  parseCoordPair,
  parseUtm,
} from '@/lib/coords'
import type { LonLat } from '@/lib/coords'

interface Props {
  onAppendDd: (lines: string[]) => void
}

interface Row {
  input: string
  pt: LonLat | null
  format: string
}

export default function CoordConverter({ onAppendDd }: Props) {
  const [text, setText] = useState('')

  const rows: Row[] = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((input) => {
      const pair = parseCoordPair(input)
      if (pair) return { input, pt: pair.pt, format: pair.format }
      const utm = parseUtm(input)
      if (utm) return { input, pt: utm, format: 'UTM' }
      return { input, pt: null, format: '-' }
    })

  const valid = rows.filter((r) => r.pt)

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">
        Tempel koordinat format apa pun — desimal (<code className="bg-muted rounded px-1">110.611, -7.73144</code>),
        DMS (<code className="bg-muted rounded px-1">110°36'39.6"E, 7°43'53"S</code>),
        DMM (<code className="bg-muted rounded px-1">110°36.66'E, 7°43.88'S</code>),
        atau UTM (<code className="bg-muted rounded px-1">49S 449000 9145000</code>).
      </p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'110°36\'39.6"E, 7°43\'52.8"S\n49S 449123 9145678'}
        className="h-28 font-mono text-xs"
      />
      {rows.length > 0 && (
        <div className="max-h-56 space-y-1.5 overflow-y-auto">
          {rows.map((r, i) => (
            <div key={i} className="rounded-md border p-2 text-xs">
              <div className="flex items-center gap-2">
                <Badge variant={r.pt ? 'default' : 'destructive'} className="shrink-0">
                  {r.format}
                </Badge>
                <span className="truncate font-mono text-[11px]">{r.input}</span>
              </div>
              {r.pt && (
                <div className="text-muted-foreground mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[11px]">
                  <span>DD: {r.pt.lon.toFixed(6)}, {r.pt.lat.toFixed(6)}</span>
                  <span>UTM: {formatUtm(lonLatToUtm(r.pt.lon, r.pt.lat))}</span>
                  <span>DMS: {formatDMS(r.pt.lon, false)}, {formatDMS(r.pt.lat, true)}</span>
                  <span>DMM: {formatDMM(r.pt.lon, false)}, {formatDMM(r.pt.lat, true)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={valid.length === 0}
        onClick={() => {
          onAppendDd(valid.map((r) => `${r.pt!.lon.toFixed(6)}, ${r.pt!.lat.toFixed(6)}`))
          setText('')
        }}
      >
        <ArrowDownToLine className="mr-1 h-3.5 w-3.5" />
        Masukkan {valid.length > 0 ? `${valid.length} koordinat` : ''} ke daftar paste
      </Button>
    </div>
  )
}
