/**
 * Verifikasi end-to-end export TAPAK terhadap Panduan Tapak Proyek v2.5:
 *  - nama file HURUF KAPITAL semua di dalam ZIP
 *  - atribut LAYER = "Tapak Proyek"
 *  - geometri plain POLYGON (type 5), koordinat DERAJAT (EPSG:4326)
 *  - skema 7 field: id, PEMRAKARSA, KEGIATAN, TAHUN, PROVINSI, LAYER,
 *    KETERANGAN (tanpa KODE & TIPE_DOKUM; LUAS = virtual, tidak disimpan)
 *
 * Jalankan: npx tsx scripts/verify-tapak-export.ts
 */
import JSZip from 'jszip'
import { buildLayerZip } from '../src/lib/export'
import { LAYER_BY_KEY } from '../src/lib/layers'
import { emptyProject, makeFeature } from '../src/lib/project'
import type { Geom } from '../src/lib/geo'

// 1 polygon contoh (persegi kecil)
const ring = [
  { lon: 110.611, lat: -7.731 },
  { lon: 110.612, lat: -7.731 },
  { lon: 110.612, lat: -7.73 },
  { lon: 110.611, lat: -7.73 },
  { lon: 110.611, lat: -7.731 },
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
project.features.push(makeFeature('tapak', geom, 'TP1', 'Tapak proyek contoh'))

const def = LAYER_BY_KEY['tapak']

// ── cek 1: fileName HURUF KAPITAL ──
if (def.fileName !== 'TAPAK PROYEK') fail(`fileName = "${def.fileName}", harus "TAPAK PROYEK"`)
ok(`fileName = "${def.fileName}" (huruf kapital semua)`)

// ── cek 2: nilai atribut LAYER ──
if (def.layerJuknis !== 'Tapak Proyek') fail(`layerJuknis = "${def.layerJuknis}", harus "Tapak Proyek"`)
ok(`nilai atribut LAYER = "${def.layerJuknis}"`)

// ── cek 3: bangun ZIP asli via buildLayerZip, periksa isi ──
const blob = await buildLayerZip(project, 'tapak')
const zip = await JSZip.loadAsync(await blob.arrayBuffer())
const names = Object.keys(zip.files).sort()
console.log('Isi ZIP:', names.join(', '))
for (const ext of ['shp', 'shx', 'dbf', 'prj', 'cpg']) {
  if (!names.includes(`TAPAK PROYEK.${ext}`)) fail(`ZIP tidak memuat TAPAK PROYEK.${ext}`)
}
ok('ZIP memuat kuartet SHP + prj + cpg bernama TAPAK PROYEK.*')

// ── cek 4: DBF = 7 field panduan, LAYER = "Tapak Proyek", tanpa KODE/TIPE_DOKUM/LUAS ──
const dbf = new Uint8Array(await zip.files['TAPAK PROYEK.dbf'].async('uint8array'))
const dv = new DataView(dbf.buffer)
const nRecords = dv.getUint32(4, true)
const headerLen = dv.getUint16(8, true)
const nFields = (headerLen - 33) / 32
const fields: { name: string; len: number; type: string }[] = []
let layerOffset = -1
let off = 1
for (let i = 0; i < nFields; i++) {
  const base = 32 + i * 32
  const name = String.fromCharCode(...dbf.slice(base, base + 11)).replace(/\0/g, '')
  const len = dbf[base + 16]
  const type = String.fromCharCode(dbf[base + 11])
  fields.push({ name, len, type })
  if (name === 'LAYER') layerOffset = off
  off += len
}
console.log('Field DBF:', fields.map((f) => `${f.name}:${f.type}${f.len}`).join(' '))
const expectNames = ['id', 'PEMRAKARSA', 'KEGIATAN', 'TAHUN', 'PROVINSI', 'LAYER', 'KETERANGAN']
const gotNames = fields.map((f) => f.name)
if (JSON.stringify(gotNames) !== JSON.stringify(expectNames)) {
  fail(`field = [${gotNames}], harus [${expectNames}]`)
}
for (const bad of ['KODE', 'TIPE_DOKUM', 'LUAS']) {
  if (gotNames.includes(bad)) fail(`field ${bad} tidak boleh ada di DBF tapak`)
}
if (layerOffset < 0) fail('field LAYER tidak ditemukan di DBF')
const recBase = headerLen + layerOffset
const raw = String.fromCharCode(...dbf.slice(recBase, recBase + fields.find((f) => f.name === 'LAYER')!.len)).trim()
if (raw !== 'Tapak Proyek') fail(`nilai LAYER di DBF = "${raw}", harus "Tapak Proyek"`)
ok(`DBF: 7 field panduan, ${nRecords} record, LAYER = "${raw}"`)

// ── cek 5: shape type 5 (plain Polygon), koordinat DERAJAT ──
const shp = new Uint8Array(await zip.files['TAPAK PROYEK.shp'].async('uint8array'))
const sv = new DataView(shp.buffer)
const shapeType = sv.getUint32(32, true)
if (shapeType !== 5) fail(`shape type = ${shapeType}, harus 5 (plain Polygon)`)
const xmin = sv.getFloat64(36, true)
const xmax = sv.getFloat64(52, true)
if (!(xmin > 100 && xmin < 120 && xmax > 100 && xmax < 120)) {
  fail(`bbox x = ${xmin}..${xmax} — bukan derajat (EPSG:4326)`)
}
ok(`shape type = 5 (plain Polygon), bbox derajat x ${xmin.toFixed(3)}..${xmax.toFixed(3)}`)

// ── cek 6: .prj = EPSG:4326 ──
const prj = await zip.files['TAPAK PROYEK.prj'].async('string')
if (!prj.includes('GCS_WGS_1984') || prj.includes('Mercator')) {
  fail('.prj bukan EPSG:4326')
}
ok('.prj = EPSG:4326 (GCS_WGS_1984)')

console.log('\nSEMUA CEK LOLOS — format export tapak sesuai Panduan v2.5 ✓')
