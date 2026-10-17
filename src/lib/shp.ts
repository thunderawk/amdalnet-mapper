/**
 * Writer shapefile quartet (.shp/.shx/.dbf/.prj/.cpg) — port TypeScript dari
 * write-gis-layer.py (skill gis-amdalnet) yang tervalidasi, PLUS PolygonZ.
 *
 * Menjaga tiga gotcha senyap:
 *  1. Header .shp/.shx: file code 9994 & total length (16-bit WORDS) BIG-endian;
 *     record header BIG-endian; isi record LITTLE-endian.
 *  2. Nama field DBF maks 10 karakter.
 *  3. Lebar field DBF yang tidak muat -> TRUNCATE SENYAP. Di sini: THROW.
 *
 * Format per layer (keputusan terverifikasi vs template asli amdalnet,
 * kecuali tapak yang mengikuti Panduan Tapak Proyek v2.5):
 *  - Titik : POINT (type 1), koordinat DERAJAT,  .prj = EPSG:4326
 *  - Area  : POLYGONZ (type 15, Z=0), koordinat METER Web Mercator, .prj = EPSG:3857
 *  - Tapak : POLYGON (type 5, tanpa Z), koordinat DERAJAT, .prj = EPSG:4326
 */
import { PRJ_TITIK, PRJ_AREA, CPG } from './prj'
import type { Geom, Pt } from './geo'
import { lonToMercX, latToMercY } from './geo'

export interface DbfField {
  name: string
  type: 'C' | 'N'
  length: number
  decimals: number
}

export type AttrValue = string | number
export type AttrRecord = Record<string, AttrValue>

export interface ShapefileSet {
  shp: Uint8Array
  shx: Uint8Array
  dbf: Uint8Array
  prj: Uint8Array
  cpg: Uint8Array
}

// ── byte writer ─────────────────────────────────────────────────────────────

class W {
  buf: Uint8Array
  view: DataView
  pos = 0
  constructor(size: number) {
    this.buf = new Uint8Array(size)
    this.view = new DataView(this.buf.buffer)
  }
  u8(v: number) {
    this.buf[this.pos++] = v & 0xff
  }
  i32le(v: number) {
    this.view.setInt32(this.pos, v, true)
    this.pos += 4
  }
  u32le(v: number) {
    this.view.setUint32(this.pos, v >>> 0, true)
    this.pos += 4
  }
  u16le(v: number) {
    this.view.setUint16(this.pos, v, true)
    this.pos += 2
  }
  f64le(v: number) {
    this.view.setFloat64(this.pos, v, true)
    this.pos += 8
  }
  i32be(v: number) {
    this.view.setInt32(this.pos, v, false)
    this.pos += 4
  }
  put(arr: ArrayLike<number>) {
    this.buf.set(arr as never, this.pos)
    this.pos += arr.length
  }
  zeros(n: number) {
    this.pos += n
  }
}

// ── header .shp/.shx (100 byte) ─────────────────────────────────────────────

function writeHeader(w: W, shapeType: number, bbox: number[]) {
  w.i32be(9994) // file code, BIG-endian
  w.zeros(20) // unused
  w.i32be(0) // placeholder file length (words), diisi pemanggil
  w.i32le(1000) // version
  w.i32le(shapeType)
  w.f64le(bbox[0]); w.f64le(bbox[1]); w.f64le(bbox[2]); w.f64le(bbox[3])
  w.f64le(0); w.f64le(0); w.f64le(0); w.f64le(0) // Zmin Zmax Mmin Mmax
}

// ── body record ─────────────────────────────────────────────────────────────

function pointBody(x: number, y: number): number[] {
  const w = new W(20)
  w.i32le(1)
  w.f64le(x)
  w.f64le(y)
  return Array.from(w.buf)
}

function polygonBody(ring: Pt[]): number[] {
  const n = ring.length
  const xs = ring.map((p) => p.lon)
  const ys = ring.map((p) => p.lat)
  const bbox = [
    Math.min(...xs), Math.min(...ys),
    Math.max(...xs), Math.max(...ys),
  ]
  const size = 4 + 32 + 4 + 4 + 4 + 16 * n
  const w = new W(size)
  w.i32le(5) // POLYGON (tanpa Z) — dipakai layer Tapak (Panduan v2.5)
  for (const b of bbox) w.f64le(b)
  w.i32le(1) // NumParts
  w.i32le(n) // NumPoints
  w.i32le(0) // Parts[0]
  for (const p of ring) { w.f64le(p.lon); w.f64le(p.lat) }
  return Array.from(w.buf)
}

function polygonZBody(ring: Pt[]): number[] {
  const n = ring.length
  const xs = ring.map((p) => p.lon)
  const ys = ring.map((p) => p.lat)
  const bbox = [
    Math.min(...xs), Math.min(...ys),
    Math.max(...xs), Math.max(...ys),
  ]
  const size = 4 + 32 + 8 + 4 + 16 * n + 16 + 8 * n
  const w = new W(size)
  w.i32le(15) // POLYGONZ
  for (const b of bbox) w.f64le(b)
  w.i32le(1) // NumParts
  w.i32le(n) // NumPoints
  w.i32le(0) // Parts[0]
  for (const p of ring) { w.f64le(p.lon); w.f64le(p.lat) }
  w.f64le(0) // Zmin
  w.f64le(0) // Zmax
  for (let i = 0; i < n; i++) w.f64le(0) // Z array = 0
  return Array.from(w.buf)
}

// ── DBF ─────────────────────────────────────────────────────────────────────

const enc = new TextEncoder()

function dbfValueBytes(f: DbfField, v: AttrValue | undefined): Uint8Array {
  let bytes: Uint8Array
  if (f.type === 'N') {
    const n = v === undefined || v === '' ? '' : Number(v)
    const s = isFinite(n as number) ? (n as number).toFixed(f.decimals) : ''
    // N selalu ASCII murni → byte == char, padStart per char aman
    bytes = enc.encode(s.padStart(f.length, ' '))
  } else {
    bytes = enc.encode(String(v ?? ''))
  }
  // Lebar field DBF dihitung dalam BYTE (CPG UTF-8), bukan char.
  if (bytes.length > f.length) {
    throw new Error(
      `DBF field "${f.name}": nilai ${bytes.length} byte > lebar field ${f.length} byte — persingkat teks / kurangi karakter non-ASCII.`,
    )
  }
  if (bytes.length === f.length) return bytes
  // padding spasi tepat f.length BYTE
  const out = new Uint8Array(f.length)
  out.fill(0x20)
  out.set(bytes)
  return out
}

/** Panjang byte UTF-8 dari nilai field setelah format DBF (tanpa padding). */
function dbfByteLength(f: DbfField, v: AttrValue | undefined): number {
  if (f.type === 'N') {
    const n = v === undefined || v === '' ? '' : Number(v)
    const s = isFinite(n as number) ? (n as number).toFixed(f.decimals) : ''
    return enc.encode(s).length
  }
  return enc.encode(String(v ?? '')).length
}

function buildDbf(fields: DbfField[], records: AttrRecord[]): Uint8Array {
  for (const f of fields) {
    if (f.name.length > 10) {
      throw new Error(`DBF field name >10 chars: "${f.name}"`)
    }
  }
  // pre-validasi semua nilai SEBELUM menulis byte apa pun.
  // Lebar field DBF = BYTE (CPG UTF-8): "—" = 3 byte, "é" = 2 byte.
  for (const rec of records) {
    for (const f of fields) {
      const byteLen = dbfByteLength(f, rec[f.name])
      if (byteLen > f.length) {
        throw new Error(
          `DBF field "${f.name}": nilai ${byteLen} byte > lebar field ${f.length} byte — persingkat teks / kurangi karakter non-ASCII.`,
        )
      }
    }
  }

  const headerLen = 32 + 32 * fields.length + 1
  const recordLen = 1 + fields.reduce((a, f) => a + f.length, 0)
  const now = new Date()
  const size = headerLen + recordLen * records.length + 1
  const w = new W(size)

  w.u8(0x03) // dBase III
  w.u8(now.getFullYear() - 1900)
  w.u8(now.getMonth() + 1)
  w.u8(now.getDate())
  w.u32le(records.length)
  w.u16le(headerLen)
  w.u16le(recordLen)
  w.zeros(20)

  for (const f of fields) {
    const nameBytes = enc.encode(f.name).slice(0, 10)
    for (let i = 0; i < 11; i++) w.u8(i < nameBytes.length ? nameBytes[i] : 0)
    w.u8(f.type.charCodeAt(0))
    w.zeros(4) // field data address
    w.u8(f.length)
    w.u8(f.decimals)
    w.zeros(14)
  }
  w.u8(0x0d) // terminator deskriptor field

  for (const rec of records) {
    w.u8(0x20) // deletion flag: aktif
    for (const f of fields) w.put(dbfValueBytes(f, rec[f.name]))
  }
  w.u8(0x1a) // EOF
  return w.buf.slice(0, w.pos)
}

// ── build quartet ───────────────────────────────────────────────────────────

export type LayerKind = 'titik' | 'area' | 'tapak'

export function buildShapefile(
  layerKind: LayerKind,
  features: { geom: Geom; attrs: AttrRecord }[],
  fields: DbfField[],
): ShapefileSet {
  const isTitik = layerKind === 'titik'
  const isTapak = layerKind === 'tapak'
  const shapeType = isTitik ? 1 : isTapak ? 5 : 15

  // siapkan body + bbox global
  const bodies: number[][] = []
  let bbox = isTitik
    ? [Infinity, Infinity, -Infinity, -Infinity]
    : [Infinity, Infinity, -Infinity, -Infinity]

  for (const f of features) {
    if (f.geom.type === 'Point') {
      if (!isTitik) throw new Error('Geometri Point pada layer Area')
      const { lon, lat } = f.geom.c
      bodies.push(pointBody(lon, lat))
      bbox[0] = Math.min(bbox[0], lon); bbox[1] = Math.min(bbox[1], lat)
      bbox[2] = Math.max(bbox[2], lon); bbox[3] = Math.max(bbox[3], lat)
    } else {
      if (isTitik) throw new Error('Geometri Polygon pada layer Titik')
      let ring = f.geom.ring
      // tutup ring bila belum
      const first = ring[0]
      const last = ring[ring.length - 1]
      if (first.lon !== last.lon || first.lat !== last.lat) {
        ring = [...ring, { lon: first.lon, lat: first.lat }]
      }
      if (ring.length < 4) throw new Error('Polygon butuh minimal 3 vertex unik')
      if (isTapak) {
        // Panduan Tapak v2.5: plain Polygon dalam DERAJAT (EPSG:4326),
        // TANPA konversi ke meter Web Mercator.
        bodies.push(polygonBody(ring))
        for (const p of ring) {
          bbox[0] = Math.min(bbox[0], p.lon); bbox[1] = Math.min(bbox[1], p.lat)
          bbox[2] = Math.max(bbox[2], p.lon); bbox[3] = Math.max(bbox[3], p.lat)
        }
      } else {
        // DERAJAT -> METER Web Mercator (sesuai template Area amdalnet)
        const ringMerc = ring.map((p) => ({ lon: lonToMercX(p.lon), lat: latToMercY(p.lat) }))
        bodies.push(polygonZBody(ringMerc))
        for (const p of ringMerc) {
          bbox[0] = Math.min(bbox[0], p.lon); bbox[1] = Math.min(bbox[1], p.lat)
          bbox[2] = Math.max(bbox[2], p.lon); bbox[3] = Math.max(bbox[3], p.lat)
        }
      }
    }
  }

  if (!isFinite(bbox[0])) bbox = [0, 0, 0, 0]

  // .shp
  let totalBytes = 100
  for (const b of bodies) totalBytes += 8 + b.length
  const shpW = new W(totalBytes)
  writeHeader(shpW, shapeType, bbox)
  shpW.view.setInt32(24, totalBytes / 2, false) // panjang file (kata), BE
  let offsetWords = 50
  const frames: { body: number[] }[] = []
  bodies.forEach((body, i) => {
    const words = body.length / 2
    shpW.i32be(i + 1) // record number, BE
    shpW.i32be(words) // content length (kata), BE
    shpW.put(body)
    frames.push({ body })
    offsetWords += words
  })
  void offsetWords

  // .shx
  const shxSize = 100 + 8 * bodies.length
  const shxW = new W(shxSize)
  writeHeader(shxW, shapeType, bbox)
  shxW.view.setInt32(24, shxSize / 2, false)
  let off = 50
  for (const b of bodies) {
    const words = b.length / 2
    shxW.i32be(off)
    shxW.i32be(words)
    off += words
  }

  const records = features.map((f) => f.attrs)

  const prjStr = isTitik || isTapak ? PRJ_TITIK : PRJ_AREA
  return {
    shp: shpW.buf.slice(0, shpW.pos),
    shx: shxW.buf.slice(0, shxW.pos),
    dbf: buildDbf(fields, records),
    prj: enc.encode(prjStr),
    cpg: enc.encode(CPG),
  }
}

// ── verifikasi struktur byte (cermin check_shp di skrip Python) ──────────────

export function verifyShpBytes(bytes: Uint8Array, expectType: number): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const code = view.getInt32(0, false)
  const words = view.getInt32(24, false)
  const stype = view.getInt32(32, true)
  if (code !== 9994) throw new Error(`bad file code ${code}`)
  if (words * 2 !== bytes.length) {
    throw new Error(`length field ${words} words != ${bytes.length} bytes`)
  }
  if (stype !== expectType) throw new Error(`shape type ${stype} != ${expectType}`)
}

export function buildAndVerify(
  layerKind: LayerKind,
  features: { geom: Geom; attrs: AttrRecord }[],
  fields: DbfField[],
): ShapefileSet {
  const set = buildShapefile(layerKind, features, fields)
  const expectType = layerKind === 'titik' ? 1 : layerKind === 'tapak' ? 5 : 15
  verifyShpBytes(set.shp, expectType)
  verifyShpBytes(set.shx, expectType)
  return set
}
