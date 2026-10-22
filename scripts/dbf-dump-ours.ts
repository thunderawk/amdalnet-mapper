import { buildAndVerify } from '../src/lib/shp'
import { emptyProject, makeFeature, attrsForFeature } from '../src/lib/project'
import { LAYER_BY_KEY } from '../src/lib/layers'
import { writeFileSync } from 'fs'

const p = emptyProject()
p.pemrakarsa = 'Nanang Budiyanto'
p.kegiatan = 'Perumahan Permata Regency'
p.tahun = 2026
p.provinsi = 'Jawa Tengah'
p.tipeDokumen = 'UKL-UPL'
p.features = [
  makeFeature('titik-pantau', { type: 'Point', c: { lon: 110.4, lat: -7.0 } }, 'B1', 'Kebisingan A'),
  makeFeature('titik-pantau', { type: 'Point', c: { lon: 110.41, lat: -7.01 } }, 'B2', 'Kebisingan B'),
  makeFeature('titik-pantau', { type: 'Point', c: { lon: 110.42, lat: -7.02 } }, 'U1', 'Udara C'),
]

const def = LAYER_BY_KEY['titik-pantau']
const set = buildAndVerify('titik', p.features.map(f => ({ geom: f.geom, attrs: attrsForFeature(p, f) })), def.fields)
writeFileSync('/tmp/our-titik.dbf', Buffer.from(set.dbf))
console.log('wrote /tmp/our-titik.dbf')
