/**
 * ProfileAccordion — profil proyek: tampil ringkas (5 atribut), ubah lewat dialog.
 * Diisi sekali, diwarisi ke semua fitur saat ekspor.
 */
import { useState } from 'react'
import { CheckCircle2, ChevronDown, Pencil, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { LAYERS, TIPE_DOKUM_OPTIONS } from '@/lib/layers'
import { effectiveLayerAttr } from '@/lib/project'
import type { Project } from '@/lib/project'

export const PROVINSI_LIST = [
  'Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau',
  'Jambi', 'Sumatera Selatan', 'Bangka Belitung', 'Bengkulu', 'Lampung',
  'DKI Jakarta', 'Jawa Barat', 'Banten', 'Jawa Tengah', 'DI Yogyakarta',
  'Jawa Timur', 'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur',
  'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan',
  'Kalimantan Timur', 'Kalimantan Utara', 'Sulawesi Utara',
  'Gorontalo', 'Sulawesi Tengah', 'Sulawesi Barat', 'Sulawesi Selatan',
  'Sulawesi Tenggara', 'Maluku', 'Maluku Utara', 'Papua Barat',
  'Papua Barat Daya', 'Papua', 'Papua Tengah', 'Papua Pegunungan',
  'Papua Selatan',
]

interface Props {
  project: Project
  onChange: (patch: Partial<Project>) => void
  open: boolean
  onToggle: () => void
}

const ROWS: [string, (p: Project) => string][] = [
  ['Pemrakarsa', (p) => p.pemrakarsa],
  ['Kegiatan', (p) => p.kegiatan],
  ['Tahun', (p) => (p.tahun === '' ? '' : String(p.tahun))],
  ['Provinsi', (p) => p.provinsi],
  ['Tipe Dokumen', (p) => p.tipeDokumen],
]

export default function ProfileAccordion({ project, onChange, open, onToggle }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const complete = !!(project.pemrakarsa && project.kegiatan && project.tahun && project.provinsi)

  return (
    <div className={cn('acc border-b border-border', open && 'open')}>
      <button
        type="button"
        className="hover:bg-muted/50 flex w-full flex-none items-center gap-2.5 px-4 py-3 text-left transition-colors"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="h-2 w-2 flex-none rounded-full bg-foreground/30" aria-hidden />
        <span className="flex-1 text-[13px] font-medium">Profil Proyek</span>
        {complete ? (
          <CheckCircle2 className="h-4 w-4 flex-none text-emerald-600 dark:text-emerald-500" />
        ) : (
          <TriangleAlert className="h-4 w-4 flex-none text-amber-500" />
        )}
        <ChevronDown
          className={cn(
            'text-muted-foreground h-4 w-4 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      <div className="acc-body">
        <div className="acc-inner">
          <div className="px-4 pt-1 pb-4">
            <dl>
              {ROWS.map(([label, get]) => (
                <div
                  key={label}
                  className="flex items-baseline justify-between gap-3 border-t border-border py-1.5 first:border-t-0 first:pt-0"
                >
                  <dt className="text-muted-foreground flex-none text-xs">{label}</dt>
                  <dd className="truncate text-right text-[13px] font-medium">
                    {get(project) || <span className="text-muted-foreground font-normal">—</span>}
                  </dd>
                </div>
              ))}
            </dl>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-7 w-full text-xs"
              onClick={() => setDialogOpen(true)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Ubah Profil
            </Button>
          </div>
        </div>
      </div>
      <ProfileDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        project={project}
        onChange={onChange}
      />
    </div>
  )
}

function ProfileDialog({
  open,
  onOpenChange,
  project,
  onChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  project: Project
  onChange: (patch: Partial<Project>) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Profil Proyek</DialogTitle>
          <DialogDescription>
            Diisi sekali — diwarisi otomatis ke semua atribut fitur saat ekspor.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label htmlFor="pf-pemrakarsa" className="text-xs">Pemrakarsa</Label>
            <Input
              id="pf-pemrakarsa"
              value={project.pemrakarsa}
              placeholder="PT. Contoh Sejahtera"
              maxLength={50}
              onChange={(e) => onChange({ pemrakarsa: e.target.value })}
            />
            <FieldHint len={project.pemrakarsa.length} max={50} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pf-kegiatan" className="text-xs">Kegiatan</Label>
            <Input
              id="pf-kegiatan"
              value={project.kegiatan}
              placeholder="Pembangunan Kawasan Industri"
              maxLength={254}
              onChange={(e) => onChange({ kegiatan: e.target.value })}
            />
            <FieldHint len={project.kegiatan.length} max={50} note="batas titik: 50 char" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="pf-tahun" className="text-xs">Tahun</Label>
              <Input
                id="pf-tahun"
                type="number"
                min={2000}
                max={2099}
                value={project.tahun === '' ? '' : String(project.tahun)}
                onChange={(e) =>
                  onChange({ tahun: e.target.value === '' ? '' : Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipe Dokumen</Label>
              <Select
                value={project.tipeDokumen}
                onValueChange={(v) => onChange({ tipeDokumen: v ?? '' })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPE_DOKUM_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Provinsi</Label>
            <Select value={project.provinsi} onValueChange={(v) => onChange({ provinsi: v ?? '' })}>
              <SelectTrigger><SelectValue placeholder="Pilih provinsi" /></SelectTrigger>
              <SelectContent className="max-h-60">
                {PROVINSI_LIST.map((prov) => (
                  <SelectItem key={prov} value={prov}>{prov}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['kabupaten', 'Kab/Kota'],
                ['kecamatan', 'Kecamatan'],
                ['desa', 'Desa/Kel.'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={`pf-${key}`} className="text-xs">{label}</Label>
                <Input
                  id={`pf-${key}`}
                  value={project[key]}
                  placeholder="otomatis"
                  onChange={(e) => onChange({ [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <p className="text-muted-foreground text-[11px]">
            Terisi otomatis saat memakai “Cari wilayah” atau “Info Wilayah” di peta — bisa diubah manual.
          </p>
          <Separator />
          <div className="space-y-1">
            <Label className="text-xs">Nilai atribut LAYER (format JUKNIS)</Label>
            <div className="bg-muted/50 space-y-0.5 rounded-md p-2 text-[11px]">
              {LAYERS.map((def) => (
                <div key={def.key} className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">{def.fileName}:</span>
                  <span className="truncate font-mono">{effectiveLayerAttr(def.key)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Selesai
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FieldHint({ len, max, note }: { len: number; max: number; note?: string }) {
  const over = len > max
  return (
    <p className={cn('text-[11px]', over ? 'text-destructive font-medium' : 'text-muted-foreground')}>
      {len}/{max} char{over ? ' — MELEBIHI batas!' : ''}{note ? ` (${note})` : ''}
    </p>
  )
}
