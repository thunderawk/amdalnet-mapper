/**
 * SlotAccordion — satu slot upload amdalnet (Titik/Area Kelola/Pantau, Tapak).
 * Arah C: header ramping (dot + nama + count + badge error + chevron),
 * isi: tombol ikon mode input, baris fitur (Edit/Hapus), export pills,
 * issue validasi slot ini.
 */
import { useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  ClipboardPaste,
  Crosshair,
  FileDown,
  FileText,
  MapPin,
  Pen,
  Pencil,
  Trash2,
  Upload,
  Wand2,
  X,
  ZoomIn,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { LayerDef } from '@/lib/layers'
import type { Feature, Issue } from '@/lib/project'
import { featureArea } from '@/lib/project'
import { formatArea } from '@/lib/geo'

interface Props {
  def: LayerDef
  features: Feature[]
  totalAreaM2: number
  open: boolean
  onToggle: () => void
  /** Mode gambar aktif untuk slot ini. */
  drawing: boolean
  onToggleDraw: () => void
  onOpenPaste: () => void
  onOpenImport: () => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** Zoom eksplisit ke satu fitur (pemisahan dari selection — W1). */
  onZoomToFeature: (id: string) => void
  editingId: string | null
  onStartEdit: (id: string) => void
  onCancelEdit: () => void
  onSaveEdit: (id: string, kode: string, keterangan: string, dbId: string) => void
  onDelete: (id: string) => void
  onExportZip: () => void
  onExportPdf: () => void
  exporting: boolean
  errorCount: number
  issues: Issue[]
  onLocateIssue: (issue: Issue) => void
  onBulkKode: (prefix: string, ids: string[]) => void
}

export default function SlotAccordion(p: Props) {
  const { def } = p
  const isPoint = def.geometry === 'point'
  const isTapak = def.key === 'tapak'
  const [filter, setFilter] = useState('')
  const [bulkPrefix, setBulkPrefix] = useState('')
  const [draft, setDraft] = useState<{
    id: string
    kode: string
    keterangan: string
    dbId: string
  } | null>(null)

  const q = filter.trim().toLowerCase()
  const visible = q
    ? p.features.filter(
        (f) =>
          f.kode.toLowerCase().includes(q) ||
          f.keterangan.toLowerCase().includes(q) ||
          f.dbId.includes(q),
      )
    : p.features

  const startEdit = (f: Feature) => {
    setDraft({ id: f.id, kode: f.kode, keterangan: f.keterangan, dbId: f.dbId })
    p.onStartEdit(f.id)
  }
  const cancelEdit = () => {
    setDraft(null)
    p.onCancelEdit()
  }
  const saveEdit = () => {
    if (!draft) return
    p.onSaveEdit(draft.id, draft.kode.trim(), draft.keterangan.trim(), draft.dbId.trim())
    setDraft(null)
  }

  return (
    <div className={cn('acc border-b border-border', p.open && 'open')}>
      <button
        type="button"
        className="hover:bg-muted/50 flex w-full flex-none items-center gap-2.5 px-4 py-3 text-left transition-colors"
        aria-expanded={p.open}
        onClick={p.onToggle}
      >
        <span
          className="h-2 w-2 flex-none rounded-full"
          style={{ background: def.color }}
          aria-hidden
        />
        <span className="flex-1 text-[13px] font-medium">{def.label}</span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {p.features.length} fitur
          {!isPoint && p.features.length > 0 && ` · ${formatArea(p.totalAreaM2)}`}
        </span>
        {p.errorCount > 0 && (
          <span className="bg-destructive text-destructive-foreground flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums">
            {p.errorCount}
          </span>
        )}
        <ChevronDown
          className={cn(
            'text-muted-foreground h-4 w-4 transition-transform duration-200',
            p.open && 'rotate-180',
          )}
        />
      </button>
      <div className="acc-body">
        <div className="acc-inner">
          <div className="px-4 pt-1 pb-4">
            {/* mode input — tombol ikon */}
            <div className="mb-2.5 flex gap-2">
              <ModeButton
                icon={isPoint ? MapPin : Pen}
                label={isPoint ? 'Tambah' : 'Gambar'}
                active={p.drawing}
                onClick={p.onToggleDraw}
                title={isPoint ? 'Klik peta untuk menambah titik' : 'Gambar polygon di peta'}
              />
              {isPoint && (
                <ModeButton
                  icon={ClipboardPaste}
                  label="Paste"
                  onClick={p.onOpenPaste}
                  title="Tempel daftar koordinat"
                />
              )}
              <ModeButton
                icon={Upload}
                label="Impor"
                onClick={p.onOpenImport}
                title="Impor dari file (SHP/GeoJSON/KML/CSV)"
              />
            </div>

            {/* daftar fitur (B8: empty state dengan aksi langsung, bukan cuma teks) */}
            {p.features.length === 0 ? (
              <div className="border-t border-border py-3">
                <p className="text-muted-foreground text-xs">
                  Belum ada {def.label.toLowerCase()} — tambah lewat peta, paste, atau impor.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7 w-full text-xs"
                  onClick={p.onToggleDraw}
                >
                  {isPoint ? (
                    <MapPin className="mr-1.5 h-3.5 w-3.5" />
                  ) : (
                    <Pen className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Mulai menggambar di peta
                </Button>
              </div>
            ) : (
              <>
                {p.features.length > 5 && (
                  <Input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Cari ID / KODE / keterangan…"
                    className="mb-1 h-7 text-xs"
                  />
                )}
                <div>
                  {visible.map((f) =>
                    draft?.id === f.id ? (
                      <div key={f.id} className="border-t border-border py-2.5">
                        {!isTapak && (
                          <Input
                            value={draft.kode}
                            onChange={(e) => setDraft({ ...draft, kode: e.target.value })}
                            placeholder="KODE (mis. AP1)"
                            maxLength={50}
                            className="mb-1.5 h-7 font-mono text-xs"
                          />
                        )}
                        <Input
                          value={draft.keterangan}
                          onChange={(e) => setDraft({ ...draft, keterangan: e.target.value })}
                          placeholder="nama lokasi + jenis dampak"
                          maxLength={254}
                          className="mb-1.5 h-7 text-xs"
                        />
                        <Input
                          value={draft.dbId}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              dbId: e.target.value.replace(/\D/g, '').slice(0, 10),
                            })
                          }
                          placeholder="ID (default 0)"
                          inputMode="numeric"
                          maxLength={10}
                          className="mb-1.5 h-7 font-mono text-xs"
                          title="Kolom ID pada DBF — angka, default 0"
                        />
                        {isPoint && (
                          <p className="text-muted-foreground mb-1.5 text-[11px]">
                            Seret titik di peta untuk memindahkan lokasinya.
                          </p>
                        )}
                        <div className="flex gap-1.5">
                          <Button size="sm" className="h-7 text-xs" onClick={saveEdit}>
                            <Check className="mr-1 h-3.5 w-3.5" />
                            Simpan
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={cancelEdit}
                          >
                            <X className="mr-1 h-3.5 w-3.5" />
                            Batal
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div key={f.id} className="feature-row border-t border-border py-2">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => p.onSelect(f.id === p.selectedId ? null : f.id)}
                            title="Klik untuk pilih fitur (kamera tetap; double-klik marker / tombol zoom untuk memindahkan kamera)"
                          >
                            <div className="font-mono text-[13px] font-medium tabular-nums">
                              <span
                                className="text-muted-foreground mr-1 text-[10px] font-normal"
                                title="Kolom ID pada DBF"
                              >
                                ID
                              </span>
                              {f.dbId || '0'}
                              {!isTapak && (
                                <span className="ml-2">
                                  {f.kode || (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </span>
                              )}
                            </div>
                            <div className="text-muted-foreground truncate text-xs">
                              {f.keterangan || '—'}
                              {!isPoint && ` · ${formatArea(featureArea(f))}`}
                            </div>
                          </button>
                          <div className="flex flex-none items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground h-7 w-7"
                              onClick={() => p.onZoomToFeature(f.id)}
                              title="Zoom peta ke fitur ini"
                            >
                              <ZoomIn className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 px-2 text-xs"
                              onClick={() => startEdit(f)}
                              title="Ubah atribut (titik: seret di peta)"
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive h-7 w-7"
                              onClick={() => p.onDelete(f.id)}
                              title="Hapus fitur"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                  {visible.length === 0 && (
                    <p className="text-muted-foreground py-3 text-center text-xs">
                      Tidak ada yang cocok dengan “{filter}”.
                    </p>
                  )}
                </div>
                {/* KODE berurutan (W8: isi seluruh layer, bukan hanya hasil filter) */}
                {!isTapak && (
                  <div className="flex gap-1.5 pt-1">
                    <Input
                      value={bulkPrefix}
                      onChange={(e) => setBulkPrefix(e.target.value)}
                      placeholder="Awalan KODE mis. B"
                      className="h-7 w-28 text-xs"
                      title="Isi KODE berurutan (B1, B2, …)"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={!bulkPrefix.trim() || p.features.length === 0}
                      onClick={() => {
                        p.onBulkKode(bulkPrefix.trim(), p.features.map((f) => f.id))
                        setBulkPrefix('')
                      }}
                    >
                      <Wand2 className="mr-1 h-3.5 w-3.5" />
                      Isi KODE ({p.features.length})
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* ekspor lapisan ini */}
            <div className="mt-1 flex items-center justify-between border-t border-border pt-2.5">
              <span className="text-muted-foreground text-xs">Ekspor lapisan ini</span>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full px-3 text-xs"
                  // W5/W6: tombol ekspor mati saat ada error validasi layer
                  // (App tetap menjaga gate — double safeguard, UX jelas).
                  disabled={p.exporting || p.features.length === 0 || p.errorCount > 0}
                  onClick={p.onExportZip}
                  title={
                    p.errorCount > 0
                      ? `${p.errorCount} error validasi — perbaiki dulu`
                      : 'Unduh ZIP (SHP) untuk slot amdalnet ini'
                  }
                >
                  <FileDown className="mr-1 h-3.5 w-3.5" />
                  ZIP
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full px-3 text-xs"
                  disabled={p.exporting || p.features.length === 0 || p.errorCount > 0}
                  onClick={p.onExportPdf}
                  title={
                    p.errorCount > 0
                      ? `${p.errorCount} error validasi — perbaiki dulu`
                      : 'Unduh PDF peta untuk slot amdalnet ini'
                  }
                >
                  <FileText className="mr-1 h-3.5 w-3.5" />
                  PDF
                </Button>
              </div>
            </div>

            {/* issue validasi slot ini */}
            {p.issues.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {p.issues.map((iss, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={!iss.featureId}
                    onClick={() => iss.featureId && p.onLocateIssue(iss)}
                    className="text-muted-foreground hover:text-foreground flex w-full items-start gap-1.5 rounded px-1 py-1 text-left text-xs disabled:cursor-default"
                    title={iss.featureId ? 'Klik untuk zoom ke fitur' : undefined}
                  >
                    {iss.level === 'error' ? (
                      <AlertCircle className="text-destructive mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    )}
                    <span className="flex-1">{iss.message}</span>
                    {iss.featureId && (
                      <Crosshair className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ModeButton({
  icon: Icon,
  label,
  active,
  onClick,
  title,
}: {
  icon: typeof MapPin
  label: string
  active?: boolean
  onClick: () => void
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={!!active}
      className={cn(
        // B1/B2: press-scale micro-feedback + transisi properti spesifik.
        'flex flex-1 flex-col items-center gap-1 rounded-lg border py-2.5 text-xs font-medium transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.96]',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-background hover:bg-muted text-foreground',
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={1.75} />
      {label}
    </button>
  )
}
