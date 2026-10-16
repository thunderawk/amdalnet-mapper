/**
 * ProfilePanel — profil proyek (diisi sekali, diwarisi ke semua fitur)
 * + kontrol varian nilai atribut LAYER.
 */
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { LAYERS, TIPE_DOKUM_OPTIONS } from '@/lib/layers'
import { effectiveLayerAttr } from '@/lib/project'
import type { Project } from '@/lib/project'

interface Props {
  project: Project
  onChange: (patch: Partial<Project>) => void
}

const PROVINSI_LIST = [
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

export default function ProfilePanel({ project, onChange }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Profil Proyek</CardTitle>
        <p className="text-muted-foreground text-xs">
          Diisi sekali — diwarisi otomatis ke semua atribut fitur.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="pemrakarsa" className="text-xs">
            Pemrakarsa
          </Label>
          <Input
            id="pemrakarsa"
            value={project.pemrakarsa}
            placeholder="PT. Contoh Sejahtera"
            onChange={(e) => onChange({ pemrakarsa: e.target.value })}
          />
          <FieldHint len={project.pemrakarsa.length} max={50} note="Titik: 50 char" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="kegiatan" className="text-xs">
            Kegiatan
          </Label>
          <Input
            id="kegiatan"
            value={project.kegiatan}
            placeholder="Perumahan Contoh Regency"
            onChange={(e) => onChange({ kegiatan: e.target.value })}
          />
          <FieldHint len={project.kegiatan.length} max={254} note="Titik: 50 char" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="tahun" className="text-xs">
              Tahun
            </Label>
            <Input
              id="tahun"
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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPE_DOKUM_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Provinsi</Label>
          <Select value={project.provinsi} onValueChange={(v) => onChange({ provinsi: v ?? '' })}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih provinsi" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {PROVINSI_LIST.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label htmlFor="kabupaten" className="text-xs">
              Kab/Kota
            </Label>
            <Input
              id="kabupaten"
              value={project.kabupaten}
              placeholder="otomatis"
              onChange={(e) => onChange({ kabupaten: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="kecamatan" className="text-xs">
              Kecamatan
            </Label>
            <Input
              id="kecamatan"
              value={project.kecamatan}
              placeholder="otomatis"
              onChange={(e) => onChange({ kecamatan: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="desa" className="text-xs">
              Desa/Kel.
            </Label>
            <Input
              id="desa"
              value={project.desa}
              placeholder="otomatis"
              onChange={(e) => onChange({ desa: e.target.value })}
            />
          </div>
        </div>
        <p className="text-muted-foreground -mt-1 text-[11px]">
          Terisi otomatis saat memakai “Cari wilayah” atau “Info Wilayah” di peta — bisa diubah manual.
        </p>

        <Separator />

        <div className="space-y-1.5">
          <Label className="text-xs">Nilai atribut LAYER (format JUKNIS)</Label>
          <div className="bg-muted/50 space-y-0.5 rounded-md p-2 text-[11px]">
            {LAYERS.map((def) => (
              <div key={def.key} className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">{def.fileName}:</span>
                <span className="truncate font-mono">
                  {effectiveLayerAttr(def.key)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function FieldHint({ len, max, note }: { len: number; max: number; note: string }) {
  const over = len > max
  return (
    <p className={`text-[11px] ${over ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
      {len}/{max} char{over ? ' — MELEBIHI batas!' : ''} ({note})
    </p>
  )
}
