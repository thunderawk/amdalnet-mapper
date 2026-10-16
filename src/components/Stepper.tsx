/**
 * Stepper — alur kerja terpandu: Profil → Gambar → Validasi → Ekspor.
 * Klik step untuk menyorot panel yang relevan; step Ekspor membuka dialog.
 */
import { Check, FileArchive, MapPinned, ShieldCheck, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export type StepKey = 'profil' | 'gambar' | 'validasi' | 'ekspor'

interface StepDef {
  key: StepKey
  label: string
  icon: typeof UserRound
}

const STEPS: StepDef[] = [
  { key: 'profil', label: 'Profil', icon: UserRound },
  { key: 'gambar', label: 'Gambar', icon: MapPinned },
  { key: 'validasi', label: 'Validasi', icon: ShieldCheck },
  { key: 'ekspor', label: 'Ekspor', icon: FileArchive },
]

interface Props {
  active: StepKey
  done: Record<StepKey, boolean>
  errorCount: number
  onSelect: (s: StepKey) => void
}

export default function Stepper({ active, done, errorCount, onSelect }: Props) {
  return (
    <nav aria-label="Alur kerja" className="flex items-center gap-1 overflow-x-auto">
      {STEPS.map((s, i) => {
        const Icon = s.icon
        const isActive = active === s.key
        const isDone = done[s.key]
        return (
          <div key={s.key} className="flex shrink-0 items-center gap-1">
            {i > 0 && <div className="bg-border mx-1 h-px w-4 sm:w-8" aria-hidden />}
            <button
              type="button"
              onClick={() => onSelect(s.key)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors sm:px-3 sm:py-1.5 ${
                isActive
                  ? 'border-primary bg-primary text-primary-foreground font-medium'
                  : isDone
                    ? 'border-primary/40 bg-primary/5 text-foreground'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
              }`}
              title={
                s.key === 'profil'
                  ? 'Isi profil proyek (sekali di awal)'
                  : s.key === 'gambar'
                    ? 'Gambar titik & area di peta'
                    : s.key === 'validasi'
                      ? 'Periksa kelengkapan paket'
                      : 'Ekspor paket siap upload'
              }
            >
              {isDone && s.key !== 'ekspor' ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{s.label}</span>
              {s.key === 'validasi' && errorCount > 0 && (
                <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                  {errorCount}
                </Badge>
              )}
            </button>
          </div>
        )
      })}
    </nav>
  )
}
