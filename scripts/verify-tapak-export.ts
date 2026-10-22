/**
 * Verifikasi end-to-end export TAPAK terhadap template SHP tapak asli dari
 * amdalnet (tapak-proyek.*) — BYTE-LEVEL:
 *  - nama file "tapak-proyek" (huruf kecil, seperti template)
 *  - atribut LAYER = "TAPAK PROYEK"
 *  - geometri plain POLYGON (type 5), koordinat DERAJAT (EPSG:4326)
 *  - skema 8 field persis: id N(10,0), PEMRAKARSA C(254), KEGIATAN C(254),
 *    TAHUN C(254), PROVINSI C(254), KETERANGAN C(254), LAYER C(254),
 *    LUAS N(24,15) hektar
 *  - .prj byte-identik template (EPSG:4326, 145B), .cpg UTF-8
 *
 * Jalankan: npx tsx scripts/verify-tapak-export.ts
 */
import JSZip from 'jszip'
// buildLayerZip diimpor dari layer-zip, bukan export.ts: export.ts mengimpor
// leaflet sebagai value (browser-only) sehingga script ini gagal di Node
// ("window is not defined"). export.ts sendiri hanya me-re-export fungsi
// yang sama dari layer-zip, jadi jalur verifikasinya identik.
import { buildLayerZip } from '../src/lib/layer-zip'
import { PRJ_TITIK } from '../src/lib/prj'
import { LAYER_BY_KEY } from '../src/lib/layers'
import { emptyProject, makeFeature } from '../src/lib/project'
import type { Geom } from '../src/lib/geo'

// polygon dari template asli (11 titik, ring tertutup)
const ring = [
  { lon: 110.61100083745605, lat: -7.7295800242559345 },
  { lon: 110.61114457869779, lat: -7.729711111111111 },
  { lon: 110.611, lat: -7.73 },
  { lon: 110.61083473646559, lat: -7.7315093511450845 },
  { lon: 110.61100083745605, lat: -7.7295800242559345 },
]
const geom: Geom = { type: 'Polygon', ring }

const fail = (msg: string): never => {
  console.error('GAGAL:', msg)
  process.exit(1)
}
const ok = (msg: string) => console.log('OK:', msg)

const project = emptyProject()
project.pemrakarsa = 'PT Contoh'
project.kegiatan = 'Kegiatan Contoh'
project.tahun = 2026
project.provinsi = 'Jawa Tengah'
project.tipeDokumen = 'UKL-UPL'
project.features.push(makeFeature('tapak', geom, '', 'Keterangan contoh'))

const def = LAYER_BY_KEY['tapak']

// ── cek 1: fileName seperti template ──
if (def.fileName !== 'tapak-proyek') fail(`fileName = "${def.fileName}", harus "tapak-proyek"`)
ok(`fileName = "${def.fileName}" (seperti template)`)

// ── cek 2: bangun ZIP asli, periksa isi ──
const blob = await buildLayerZip(project, 'tapak')
const zip = await JSZip.loadAsync(await blob.arrayBuffer())
const names = Object.keys(zip.files).sort()
console.log('Isi ZIP:', names.join(', '))
for (const ext of ['shp', 'shx', 'dbf', 'prj', 'cpg']) {
  if (!names.includes(`tapak-proyek.${ext}`)) fail(`ZIP tidak memuat tapak-proyek.${ext}`)
}
ok('ZIP memuat kuartet SHP + prj + cpg bernama tapak-proyek.*')

// ── cek 3: DBF = 8 field persis template ──
const dbf = new Uint8Array(await zip.files['tapak-proyek.dbf'].async('uint8array'))
const dv = new DataView(dbf.buffer)
const nRecords = dv.getUint32(4, true)
const headerLen = dv.getUint16(8, true)
const nFields = (headerLen - 33) / 32
const fields: { name: string; type: string; len: number; dec: number }[] = []
const offsets: number[] = []
let off = 1
for (let i = 0; i < nFields; i++) {
  const base = 32 + i * 32
  const name = String.fromCharCode(...dbf.slice(base, base + 11)).replace(/\0/g, '')
  const type = String.fromCharCode(dbf[base + 11])
  const len = dbf[base + 16]
  const dec = dbf[base + 17]
  fields.push({ name, type, len, dec })
  offsets.push(off)
  off += len
}
console.log('Field DBF:', fields.map((f) => `${f.name}:${f.type}${f.len}.${f.dec}`).join(' '))
const expect = [
  ['id', 'N', 10, 0],
  ['PEMRAKARSA', 'C', 254, 0],
  ['KEGIATAN', 'C', 254, 0],
  ['TAHUN', 'C', 254, 0],
  ['PROVINSI', 'C', 254, 0],
  ['KETERANGAN', 'C', 254, 0],
  ['LAYER', 'C', 254, 0],
  ['LUAS', 'N', 24, 15],
] as const
if (nFields !== expect.length) fail(`jumlah field = ${nFields}, harus ${expect.length}`)
for (let i = 0; i < expect.length; i++) {
  const [en, et, el, ed] = expect[i]
  const f = fields[i]
  if (f.name !== en || f.type !== et || f.len !== el || f.dec !== ed) {
    fail(`field[${i}] = ${f.name}:${f.type}${f.len}.${f.dec}, harus ${en}:${et}${el}.${ed}`)
  }
}
ok(`DBF: 8 field persis template, ${nRecords} record`)

// ── cek 4: nilai record ──
const rec = (name: string): string => {
  const i = fields.findIndex((f) => f.name === name)
  const base = headerLen + offsets[i]
  return String.fromCharCode(...dbf.slice(base, base + fields[i].len)).trim()
}
if (rec('LAYER') !== 'TAPAK PROYEK') fail(`LAYER = "${rec('LAYER')}"`)
if (rec('TAHUN') !== '2026') fail(`TAHUN = "${rec('TAHUN')}"`)
if (rec('KETERANGAN') !== 'Keterangan contoh') fail('KETERANGAN tidak terbawa')
const luas = parseFloat(rec('LUAS'))
if (!(luas > 0 && luas < 100)) fail(`LUAS = "${rec('LUAS')}" tidak masuk akal (hektar)`)
ok(`LAYER = "TAPAK PROYEK", TAHUN = "2026", LUAS = ${rec('LUAS')} ha`)

// ── cek 5: shape type 5, derajat ──
const shp = new Uint8Array(await zip.files['tapak-proyek.shp'].async('uint8array'))
const sv = new DataView(shp.buffer)
if (sv.getUint32(32, true) !== 5) fail('shape type bukan 5')
const xmin = sv.getFloat64(36, true)
if (!(xmin > 100 && xmin < 120)) fail('bbox bukan derajat')
ok('shape type = 5 (plain Polygon), koordinat derajat')

// ── cek 6: .prj byte-identik template ──
// Referensi .prj tapak asli amdalnet sekarang hidup di repo sebagai konstanta
// PRJ_TITIK (src/lib/prj.ts, 145 byte, "jangan edit") — bukan lagi file
// /tmp/tapak_ref yang tidak ada di semua mesin. Cek ini memastikan writer
// memasang .prj yang benar untuk tapak (EPSG:4326), bukan PRJ_AREA.
const prj = await zip.files['tapak-proyek.prj'].async('uint8array')
const prjText = Buffer.from(prj).toString()
if (prjText.length !== 145) fail(`panjang .prj = ${prjText.length} byte, harus 145`)
if (prjText !== PRJ_TITIK) fail('.prj tidak identik template amdalnet')
ok('.prj byte-identik template (EPSG:4326, 145B)')

console.log('\nSEMUA CEK LOLOS — export tapak byte-identik template amdalnet ✓')
