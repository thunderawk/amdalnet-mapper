/**
 * Phase 1 regression tests — data integrity:
 *  - Skema DBF titik & area PERSIS template amdalnet (9 field, urutan template).
 *  - Index .shx menunjuk record .shp yang benar (offset + header 8 byte).
 *  - `ID` diisi pengguna (default 0), bukan nomor urut otomatis.
 *  - Atribut per baris berbeda (KODE/KETERANGAN tidak menempel ke baris lain).
 *  - Validasi: KODE/KETERANGAN/ID invalid hanya peringatan; KODE ganda diabaikan.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import JSZip from 'jszip'
import { buildLayerZipBytes } from '../layer-zip'
import { LAYER_BY_KEY } from '../layers'
import { emptyProject, makeFeature, validateProject } from '../project'
import type { Project } from '../project'
import { verifyShpIndex } from '../shp'
import type { DbfField } from '../shp'

const TEMPLATE_NAMES = [
  'PEMRAKARSA',
  'KEGIATAN',
  'TAHUN',
  'PROVINSI',
  'KETERANGAN',
  'TIPE_DOKUM',
  'KODE',
  'LAYER',
  'ID',
]

interface ParsedDbf {
  nRecords: number
  fields: DbfField[]
  records: Record<string, string>[]
}

function parseDbf(bytes: Uint8Array): ParsedDbf {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const nRecords = dv.getUint32(4, true)
  const headerLen = dv.getUint16(8, true)
  const recordLen = dv.getUint16(10, true)
  const nFields = (headerLen - 33) / 32
  const fields: DbfField[] = []
  for (let i = 0; i < nFields; i++) {
    const base = 32 + i * 32
    const name = new TextDecoder('latin1')
      .decode(bytes.slice(base, base + 11))
      .replace(/\0/g, '')
    fields.push({
      name,
      type: String.fromCharCode(bytes[base + 11]) as 'C' | 'N',
      length: bytes[base + 16],
      decimals: bytes[base + 17],
    })
  }
  const records: Record<string, string>[] = []
  const dec = new TextDecoder('utf-8')
  for (let r = 0; r < nRecords; r++) {
    let p = headerLen + r * recordLen + 1
    const rec: Record<string, string> = {}
    for (const f of fields) {
      rec[f.name] = dec.decode(bytes.slice(p, p + f.length)).trim()
      p += f.length
    }
    records.push(rec)
  }
  return { nRecords, fields, records }
}

function templateFields(rel: string): DbfField[] {
  const url = new URL(`../../../reference/peta-amdalnet/${rel}`, import.meta.url)
  return parseDbf(new Uint8Array(readFileSync(fileURLToPath(url)))).fields
}

async function dbfOfLayerZip(project: Project, layer: keyof typeof LAYER_BY_KEY) {
  const { bytes } = await buildLayerZipBytes(project, layer)
  const zip = await JSZip.loadAsync(bytes)
  const name = Object.keys(zip.files).find((n) => /\.dbf$/i.test(n))!
  const dbf = await zip.file(name)!.async('uint8array')
  return parseDbf(dbf)
}

async function shpPairOfLayerZip(project: Project, layer: keyof typeof LAYER_BY_KEY) {
  const { bytes } = await buildLayerZipBytes(project, layer)
  const zip = await JSZip.loadAsync(bytes)
  const find = (ext: string) => Object.keys(zip.files).find((n) => new RegExp(`\\.${ext}$`, 'i').test(n))!
  return {
    shp: await zip.file(find('shp'))!.async('uint8array'),
    shx: await zip.file(find('shx'))!.async('uint8array'),
  }
}

function profile(p: Project): Project {
  p.pemrakarsa = 'PT Contoh'
  p.kegiatan = 'Kegiatan Contoh'
  p.tahun = 2026
  p.provinsi = 'Jawa Tengah'
  p.tipeDokumen = 'UKL-UPL'
  return p
}

describe('skema DBF vs template amdalnet', () => {
  it('titik-pantau & titik-kelola: 9 field sesuai urutan template', () => {
    for (const key of ['titik-pantau', 'titik-kelola'] as const) {
      expect(LAYER_BY_KEY[key].fields.map((f) => f.name)).toEqual(TEMPLATE_NAMES)
      expect(LAYER_BY_KEY[key].fields).toEqual(templateFields('template_titik_pantau/Titik Pantau.dbf'))
    }
  })

  it('area-kelola & area-pantau: 9 field sesuai urutan template', () => {
    for (const key of ['area-kelola', 'area-pantau'] as const) {
      expect(LAYER_BY_KEY[key].fields.map((f) => f.name)).toEqual(TEMPLATE_NAMES)
      expect(LAYER_BY_KEY[key].fields).toEqual(templateFields('template_area_pantau/Area Pantau.dbf'))
    }
  })

  it('tapak mengikuti file yang diterima amdalnet + LUAS', () => {
    expect(LAYER_BY_KEY['tapak'].fields).toEqual([
      { name: 'id', type: 'N', length: 10, decimals: 0 },
      { name: 'PEMRAKARSA', type: 'C', length: 254, decimals: 0 },
      { name: 'KEGIATAN', type: 'C', length: 254, decimals: 0 },
      { name: 'TAHUN', type: 'C', length: 254, decimals: 0 },
      { name: 'PROVINSI', type: 'C', length: 254, decimals: 0 },
      { name: 'KETERANGAN', type: 'C', length: 254, decimals: 0 },
      { name: 'LAYER', type: 'C', length: 254, decimals: 0 },
      { name: 'LUAS', type: 'N', length: 24, decimals: 15 },
    ])
  })
})

describe('index .shx', () => {
  it('titik: offset menunjuk record yang benar (bukan tengah record sebelumnya)', async () => {
    const p = profile(emptyProject())
    p.features = [
      makeFeature('titik-pantau', { type: 'Point', c: { lon: 110.4, lat: -7.0 } }, 'B1', 'A'),
      makeFeature('titik-pantau', { type: 'Point', c: { lon: 110.41, lat: -7.01 } }, 'B2', 'B'),
      makeFeature('titik-pantau', { type: 'Point', c: { lon: 110.42, lat: -7.02 } }, 'U1', 'C'),
    ]
    const { shp, shx } = await shpPairOfLayerZip(p, 'titik-pantau')
    expect(() => verifyShpIndex(shp, shx, 1)).not.toThrow()
    const xv = new DataView(shx.buffer, shx.byteOffset, shx.byteLength)
    expect([0, 1, 2].map((i) => xv.getInt32(100 + i * 8, false) * 2)).toEqual([100, 128, 156])
  })

  it('area: offset tetap benar untuk record PolygonZ', async () => {
    const p = profile(emptyProject())
    const ring = [
      { lon: 110.4, lat: -7.0 },
      { lon: 110.41, lat: -7.01 },
      { lon: 110.42, lat: -7.0 },
      { lon: 110.4, lat: -7.0 },
    ]
    p.features = [
      makeFeature('area-pantau', { type: 'Polygon', ring }, 'A1', 'satu'),
      makeFeature('area-pantau', { type: 'Polygon', ring }, 'A2', 'dua'),
    ]
    const { shp, shx } = await shpPairOfLayerZip(p, 'area-pantau')
    expect(() => verifyShpIndex(shp, shx, 15)).not.toThrow()
  })
})

describe('atribut per baris', () => {
  it('titik: KODE/KETERANGAN tidak menempel, ID default 0', async () => {
    const p = profile(emptyProject())
    p.features = [
      makeFeature('titik-pantau', { type: 'Point', c: { lon: 110.4, lat: -7.0 } }, 'B1', 'Bising A'),
      makeFeature('titik-pantau', { type: 'Point', c: { lon: 110.41, lat: -7.01 } }, 'B2', 'Bising B'),
      makeFeature('titik-pantau', { type: 'Point', c: { lon: 110.42, lat: -7.02 } }, 'U1', 'Udara C'),
    ]
    const { nRecords, records, fields } = await dbfOfLayerZip(p, 'titik-pantau')
    expect(nRecords).toBe(3)
    expect(fields.map((f) => f.name)).toEqual(TEMPLATE_NAMES)
    expect(records.map((r) => r.KODE)).toEqual(['B1', 'B2', 'U1'])
    expect(records.map((r) => r.KETERANGAN)).toEqual(['Bising A', 'Bising B', 'Udara C'])
    expect(records.map((r) => r.ID)).toEqual(['0', '0', '0'])
    expect(records.map((r) => r.LAYER)).toEqual([
      'Titik Pemantauan',
      'Titik Pemantauan',
      'Titik Pemantauan',
    ])
  })

  it('titik: ID manual tersimpan per fitur (duplikat 0 diperbolehkan)', async () => {
    const p = profile(emptyProject())
    p.features = [
      makeFeature('titik-pantau', { type: 'Point', c: { lon: 110.4, lat: -7.0 } }, 'B1', 'A', '7'),
      makeFeature('titik-pantau', { type: 'Point', c: { lon: 110.41, lat: -7.01 } }, 'B2', 'B', '7'),
      makeFeature('titik-pantau', { type: 'Point', c: { lon: 110.42, lat: -7.02 } }, 'U1', 'C', '12'),
    ]
    const { records } = await dbfOfLayerZip(p, 'titik-pantau')
    expect(records.map((r) => r.ID)).toEqual(['7', '7', '12'])
  })

  it('tapak: id manual default 0, LAYER "TAPAK PROYEK", LUAS terisi', async () => {
    const p = profile(emptyProject())
    const ring = [
      { lon: 110.61, lat: -7.73 },
      { lon: 110.611, lat: -7.731 },
      { lon: 110.612, lat: -7.729 },
      { lon: 110.61, lat: -7.73 },
    ]
    p.features = [
      makeFeature('tapak', { type: 'Polygon', ring }, '', 'Tapak A'),
      makeFeature('tapak', { type: 'Polygon', ring }, '', 'Tapak B', '3'),
    ]
    const { nRecords, records } = await dbfOfLayerZip(p, 'tapak')
    expect(nRecords).toBe(2)
    expect(records.map((r) => r.id)).toEqual(['0', '3'])
    expect(records.map((r) => r.LAYER)).toEqual(['TAPAK PROYEK', 'TAPAK PROYEK'])
    expect(Number(records[0].LUAS)).toBeGreaterThan(0)
  })
})

describe('arsip bulk datar (byte, tanpa Blob bersarang)', () => {
  it('atribut per baris tetap utuh setelah ZIP di dalam ZIP', async () => {
    const p = profile(emptyProject())
    p.features = [
      makeFeature('titik-pantau', { type: 'Point', c: { lon: 110.4, lat: -7.0 } }, 'B1', 'Bising A'),
      makeFeature('titik-pantau', { type: 'Point', c: { lon: 110.41, lat: -7.01 } }, 'B2', 'Bising B'),
    ]
    const master = new JSZip()
    const { bytes, records } = await buildLayerZipBytes(p, 'titik-pantau')
    expect(records).toBe(2)
    master.file(`${LAYER_BY_KEY['titik-pantau'].fileName}.zip`, bytes)
    const archive = await master.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })

    const outer = await JSZip.loadAsync(archive)
    const inner = await outer.file('Titik Pantau.zip')!.async('uint8array')
    const innerZip = await JSZip.loadAsync(inner)
    const dbf = await innerZip.file('Titik Pantau.dbf')!.async('uint8array')
    const rows = parseDbf(dbf).records
    expect(rows.map((r) => r.KODE)).toEqual(['B1', 'B2'])
    expect(rows.map((r) => r.KETERANGAN)).toEqual(['Bising A', 'Bising B'])
  })
})

describe('validasi longgar (warn only)', () => {
  it('KODE/KETERANGAN kosong → warning, bukan error', () => {
    const p = profile(emptyProject())
    p.features = [makeFeature('titik-pantau', { type: 'Point', c: { lon: 110, lat: -7 } })]
    const issues = validateProject(p)
    expect(issues.some((i) => i.level === 'error')).toBe(false)
    expect(issues.filter((i) => i.level === 'warning').length).toBeGreaterThanOrEqual(2)
  })

  it('KODE ganda tidak dilaporkan', () => {
    const p = profile(emptyProject())
    p.features = [
      makeFeature('titik-pantau', { type: 'Point', c: { lon: 110, lat: -7 } }, 'A', 'satu'),
      makeFeature('titik-pantau', { type: 'Point', c: { lon: 110.1, lat: -7 } }, 'A', 'dua'),
    ]
    const issues = validateProject(p)
    expect(issues.some((i) => i.message.toLowerCase().includes('dipakai lebih dari sekali'))).toBe(
      false,
    )
  })

  it('ID non-angka → warning, tetapi diekspor sebagai 0', async () => {
    const p = profile(emptyProject())
    const f = makeFeature('titik-pantau', { type: 'Point', c: { lon: 110, lat: -7 } }, 'A', 'satu')
    f.dbId = 'abc'
    p.features = [f]
    const issues = validateProject(p)
    expect(issues.some((i) => i.level === 'warning' && i.message.includes('ID'))).toBe(true)
    expect(issues.some((i) => i.level === 'error')).toBe(false)
    const { records } = await dbfOfLayerZip(p, 'titik-pantau')
    expect(records[0].ID).toBe('0')
  })
})
