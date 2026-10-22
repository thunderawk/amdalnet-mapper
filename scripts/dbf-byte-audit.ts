// Byte-level audit of the DBF we produce for 3 titik pantau.
// Check: record length consistency, deletion flags, field offsets, EOF marker.
import { buildAndVerify } from '../src/lib/shp'
import { emptyProject, makeFeature, attrsForFeature } from '../src/lib/project'
import { LAYER_BY_KEY } from '../src/lib/layers'

const p = emptyProject()
p.pemrakarsa = 'PT XYZ'
p.kegiatan = 'Test'
p.tahun = 2026
p.provinsi = 'DI Yogyakarta'
p.tipeDokumen = 'UKL-UPL'
p.features = [
  makeFeature('titik-pantau', { type: 'Point', c: { lon: 110, lat: -7 } }, 'B1', 'Kebisingan A'),
  makeFeature('titik-pantau', { type: 'Point', c: { lon: 110.1, lat: -7.1 } }, 'B2', 'Kebisingan B'),
  makeFeature('titik-pantau', { type: 'Point', c: { lon: 110.2, lat: -7.2 } }, 'U1', 'Udara C'),
]

const def = LAYER_BY_KEY['titik-pantau']
const set = buildAndVerify('titik', p.features.map(f => ({ geom: f.geom, attrs: attrsForFeature(p, f) })), def.fields)

const buf = Buffer.from(set.dbf)
console.log('Total DBF bytes:', buf.length)
console.log('Magic byte:', '0x' + buf[0].toString(16))

const numRec = buf.readUInt32LE(4)
const headerLen = buf.readUInt16LE(8)
const recLen = buf.readUInt16LE(10)
console.log('numRec:', numRec, 'headerLen:', headerLen, 'recLen:', recLen)

// field descriptor area
let off = 32
const fields: { name: string; type: string; len: number; dec: number }[] = []
while (true) {
  const b = buf[off]
  if (b === 0x0d) { off++; break }
  if (b === 0x00) break
  fields.push({ name: buf.slice(off, off+11).toString('utf8').replace(/\0+$/g,'').trim(), type: String.fromCharCode(buf[off+11]), len: buf[off+16], dec: buf[off+17] })
  off += 32
}
console.log('fields:', fields.length, '| field area ends at byte', off, '(0x0D at', off-1, ')')

// expected total = headerLen + numRec * recLen + 1
const expected = headerLen + numRec * recLen + 1
console.log('expected total:', expected, 'actual:', buf.length, buf.length === expected ? 'OK' : 'MISMATCH!')

// last byte should be 0x1a
console.log('last byte:', '0x' + buf[buf.length-1].toString(16), buf[buf.length-1] === 0x1a ? 'EOF OK' : 'NOT 0x1A!')

// per-record dump
const dataStart = headerLen // records begin right after the 0x0D terminator
console.log('\nPer-record byte dump (KETERANGAN field offset within record):')
const ketField = fields.find(f => f.name === 'KETERANGAN')!
let ketOffsetInRec = 1 // deletion flag
for (const f of fields) { if (f.name === 'KETERANGAN') break; ketOffsetInRec += f.len }
console.log('  KETERANGAN starts at offset', ketOffsetInRec, 'within each record')

for (let r = 0; r < numRec; r++) {
  const recOff = dataStart + r * recLen
  const delFlag = buf[recOff]
  const ketRaw = buf.slice(recOff + ketOffsetInRec, recOff + ketOffsetInRec + ketField.len)
  const ketStr = ketRaw.toString('utf8')
  // show last 40 chars to see if it got truncated
  console.log(`  row ${r}: del=0x${delFlag.toString(16)}  KETERANGAN=${JSON.stringify(ketStr.slice(0,60))}...  bytes=${ketRaw.length}`)
}

// check: all KETERANGAN same?
const kets = Array.from({length: numRec}, (_, r) => {
  const recOff = dataStart + r * recLen
  return buf.slice(recOff + ketOffsetInRec, recOff + ketOffsetInRec + ketField.len).toString('utf8').trim()
})
console.log('\nKETERANGAN values:', JSON.stringify(kets, null, 2))
const distinct = new Set(kets)
console.log('distinct:', distinct.size, 'of', numRec)
if (distinct.size < numRec) console.log('*** BUG: KETERANGAN values are NOT distinct ***')
else console.log('PASS: all distinct')
