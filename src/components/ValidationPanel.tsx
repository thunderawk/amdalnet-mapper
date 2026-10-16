/**
 * ValidationPanel — status kelengkapan paket upload: error wajib dibetulkan,
 * warning opsional.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AlertCircle, AlertTriangle, CheckCircle2, Crosshair } from 'lucide-react'
import type { Issue } from '@/lib/project'

interface Props {
  issues: Issue[]
  /** Klik issue ber-fitur → zoom ke fitur tersebut di peta. */
  onLocate?: (issue: Issue) => void
}

export default function ValidationPanel({ issues, onLocate }: Props) {
  const errors = issues.filter((i) => i.level === 'error')
  const warnings = issues.filter((i) => i.level === 'warning')

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Validasi Paket</CardTitle>
          {errors.length === 0 ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Siap export
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.length} error
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {issues.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            Semua pemeriksaan lolos. Paket siap diupload ke amdalnet.
          </p>
        ) : (
          <ScrollArea className="max-h-48">
            <ul className="space-y-1">
              {[...errors, ...warnings].map((iss, i) => {
                const clickable = !!iss.featureId && onLocate
                return (
                  <li key={i}>
                    <button
                      type="button"
                      disabled={!clickable}
                      onClick={() => clickable && onLocate(iss)}
                      className={`flex w-full items-start gap-1.5 rounded px-1 py-0.5 text-left text-xs ${
                        clickable ? 'hover:bg-muted cursor-pointer' : 'cursor-default'
                      }`}
                      title={clickable ? 'Klik untuk zoom ke fitur' : undefined}
                    >
                      {iss.level === 'error' ? (
                        <AlertCircle className="text-destructive mt-0.5 h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      )}
                      <span className="flex-1">
                        {iss.layer !== 'profil' && (
                          <span className="font-medium">{layerName(iss.layer)}: </span>
                        )}
                        {iss.message}
                      </span>
                      {clickable && (
                        <Crosshair className="text-muted-foreground mt-0.5 h-3 w-3 shrink-0" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

function layerName(layer: string): string {
  const map: Record<string, string> = {
    'titik-pantau': 'Titik Pantau',
    'titik-kelola': 'Titik Kelola',
    'area-pantau': 'Area Pantau',
    'area-kelola': 'Area Kelola',
    tapak: 'Tapak Proyek',
    profil: 'Profil',
  }
  return map[layer] ?? layer
}
