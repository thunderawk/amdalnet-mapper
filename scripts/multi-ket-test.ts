// Reproduce user's exact scenario: 3 titik pantau, different KETERANGAN.
// Build the SHP quartet in-memory and read the DBF back with a manual parser.
import { buildAndVerify } from '../src/lib/shp'
import { emptyProject, makeFeature, attrsForFeature } from '../src/lib/project'
import { LAYER_BY_KEY } from '../src/lib/layers'
import { featuresOf } from '../src/lib/project'

const p = emptyProject()
p.pemrakarsa = 'Nanang Budiyanto'
p.kegiatan = 'Perumahan Permata Regency'
p.tahun = 2026
p.provinsi = 'Jawa Tengah'
p.tipeDokumen = 'UKL-UPL'

const f1 = makeFeature('titik-pantau', { type: 'Point', c: { lon: 110.4, lat: -7.0 } }, 'B1', 'Titik Kebisingan Depan Gerbang')
const f2 = makeFeature('titik-pantau', { type: 'Point', c: { lon: 110.41, lat: -7.01 } }, 'B2', 'Titik Kebisingan Area Industri')
const f3 = makeFeature('titik-pantau', { type: 'Point', c: { lon: 110.42, lat: -7.02 } }, 'U1', 'Titik Kualitas Udara Blok A')
p.features = [f1, f2, f3]

const def = LAYER_BY_KEY['titik-pantau']
const feats = featuresOf(p, 'titik-pantau')
const set = buildAndVerify(
  'titik',
  feats.map((f) => ({ geom: f.geom, attrs: attrsForFeature(p, f) })),
  def.fields,
)

// Parse the DBF back
const buf = Buffer.from(set.dbf)
const numRec = buf.readUInt32LE(4)
console.log('DBF record count:', numRec)
const headerLen = buf.readUInt16LE(8)
let off = 32
const fields: { name: string; len: number; type: string }[] = []
while (true) {
  const raw = buf.slice(off, off + 11).toString('utf8')
  if (raw.charCodeAt(0) === 0 || raw.charCodeAt(0) === 0x0d) break
  fields.push({ name: raw.replace(/\0+$/g, '').trim(), len: buf[off + 16], type: String.fromCharCode(buf[off + 11]) })
  off += 32
}
console.log('DBF fields:', fields.map((f) => `${f.name}(${f.type}${f.len})`).join(' '))
const dataStart = 32 + 32 * fields.length + 1
for (let r = 0; r < numRec; r++) {
  let pos = dataStart + r * (1 + fields.reduce((a, f) => a + f.len, 0))
  pos += 1
  const row: Record<string, string> = {}
  for (const f of fields) {
    row[f.name] = buf.slice(pos, pos + f.len).toString('utf8').trim()
    pos += f.len
  }
  console.log(`ROW ${r}: KODE=${row.KODE}  KETERANGAN=${row.KETERANGAN}`)
}

const distinct = new Set()
for (let r = 0; r < numRec; r++) {
  const rowLen = 1 + fields.reduce((a, f) => a + f.len, 0)
  let pos = dataStart + r * rowLen + 1
  const ketField = fields.find((f) => f.name === 'KETERANGAN')!
  let p2 = dataStart + r * rowLen + 1
  for (const f of fields) { if (f.name === 'KETERANGAN') break; p2 += f.len }
  distinct.add(buf.slice(p2, p2 + ketField.len).toString('utf8').trim())
}
console.log('\nDistinct KETERANGAN values:', distinct.size)
if (distinct.size === numRec) {
  console.log('PASS — each row has its own KETERANGAN. Bug is NOT in the DBF writer.')
} else {
  console.log('*** BUG: multiple rows share the same KETERANGAN ***')
  process.exit(1)
}
