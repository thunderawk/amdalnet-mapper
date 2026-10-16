/**
 * Verifikasi end-to-end export TAPAK terhadap Panduan Tapak Proyek v2.5:
 *  - nama file HURUF KAPITAL semua di dalam ZIP
 *  - atribut LAYER = "Tapak Proyek"
 *  - geometri polygon, skema 9 field
 *
 * Jalankan: npx tsx scripts/verify-tapak-export.ts
 */
import JSZip from 'jszip'
import { buildLayerZip } from '../src/lib/export'
import { LAYER_BY_KEY } from '../src/lib/layers'
import { emptyProject, makeFeature } from '../src/lib/project'
import type { Geom } from '../src/lib/geo'

const fail = (msg: string): never => {
  console.error('GAGAL:', msg)
  process.exit(1)
}
const ok = (msg: string) => console.log('OK:', msg)

// 1 polygon contoh (persegi kecil)
const ring: [number, number][] = [
  [110.611, -7.731],
  [110.612, -7.731],
  [110.612, -7.730],
  [110.611, -7.730],
  [110.611, -7.731],
]
const geom: Geom = { type: 'Polygon', ring }

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

// ── cek 4: baca kembali DBF, pastikan field LAYER = "Tapak Proyek" ──
const dbf = new Uint8Array(await zip.files['TAPAK PROYEK.dbf'].async('uint8array'))
const dv = new DataView(dbf.buffer)
const nRecords = dv.getUint32(4, true)
const headerLen = dv.getUint16(8, true)
const nFields = (headerLen - 33) / 32
if (nFields !== 9) fail(`jumlah field = ${nFields}, harus 9`)
const fields: { name: string; len: number }[] = []
let layerOffset = -1
let off = 1
for (let i = 0; i < nFields; i++) {
  const base = 32 + i * 32
  const name = String.fromCharCode(...dbf.slice(base, base + 11)).replace(/\0/g, '')
  const len = dbf[base + 16]
  fields.push({ name, len })
  if (name === 'LAYER') layerOffset = off
  off += len
}
if (layerOffset < 0) fail('field LAYER tidak ditemukan di DBF')
const recBase = headerLen + layerOffset
const raw = String.fromCharCode(...dbf.slice(recBase, recBase + fields.find(f => f.name === 'LAYER')!.len)).trim()
if (raw !== 'Tapak Proyek') fail(`nilai LAYER di DBF = "${raw}", harus "Tapak Proyek"`)
ok(`DBF: 9 field, ${nRecords} record, LAYER = "${raw}"`)

// ── cek 5: tipe shape polygon (15) ──
const shp = new Uint8Array(await zip.files['TAPAK PROYEK.shp'].async('uint8array'))
const shapeType = new DataView(shp.buffer).getUint32(32, true)
if (shapeType !== 15) fail(`shape type = ${shapeType}, harus 15 (polygon)`)
ok('shape type = 15 (polygon)')

console.log('\nSEMUA CEK LOLOS — format export tapak sesuai Panduan v2.5 ✓')
