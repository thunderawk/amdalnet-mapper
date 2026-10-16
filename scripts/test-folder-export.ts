/**
 * Uji folder-export dengan mock File System Access API.
 * Memverifikasi: struktur folder, nama file, dan byte SHP hasil tulis.
 */
import { writeFileSync, mkdirSync } from 'node:fs'

// ── mock window & File System Access API (SEBELUM import leaflet) ──
const files = new Map<string, Uint8Array>()

interface MockDir {
  path: string
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<MockDir>
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<{
    createWritable(): Promise<{ write(d: Uint8Array | Blob | string): Promise<void>; close(): Promise<void> }>
  }>
}

function mockDir(path: string): MockDir {
  return {
    path,
    async getDirectoryHandle(name: string) {
      return mockDir(`${path}/${name}`)
    },
    async getFileHandle(name: string) {
      const full = `${path}/${name}`
      return {
        async createWritable() {
          return {
            async write(d: Uint8Array | Blob | string) {
              if (d instanceof Uint8Array) files.set(full, d)
              else if (d instanceof Blob) files.set(full, new Uint8Array(await d.arrayBuffer()))
              else files.set(full, new TextEncoder().encode(String(d)))
            },
            async close() {},
          }
        },
      }
    },
  }
}

// mock window & document minimal (leaflet/jsPDF/html2canvas butuh saat import)
const docMock = {
  createElement: (tag: string) =>
    tag === 'canvas'
      ? { getContext: () => null, style: {}, toDataURL: () => '' }
      : { style: {} },
  documentElement: { style: {} },
  body: { style: {} },
  location: { href: 'file:///test/' },
}
;(globalThis as unknown as { document: unknown }).document = docMock
;(globalThis as unknown as { window: unknown }).window = {
  showDirectoryPicker: async () => mockDir('<project-folder>'),
  devicePixelRatio: 1,
  screen: { deviceXDPI: 96, logicalXDPI: 96 },
  navigator: { userAgent: 'node' },
  atob: (s: string) => Buffer.from(s, 'base64').toString('binary'),
  btoa: (s: string) => Buffer.from(s, 'binary').toString('base64'),
  document: docMock,
  location: { href: 'file:///test/' },
}

async function main() {
  const { exportToFolder } = await import('../src/lib/folder-export')
  const { emptyProject, makeFeature } = await import('../src/lib/project')
  const { buildAndVerify } = await import('../src/lib/shp')

  // mock peta (fitBounds/capture tidak benar-benar render di Node)
  const mockMap = {
    getBounds: () => ({
      getSouth: () => -7.75,
      getWest: () => 110.6,
      getNorth: () => -7.7,
      getEast: () => 110.65,
    }),
    fitBounds: () => {},
    getContainer: () => ({}) as HTMLElement,
    getSize: () => ({ x: 800, y: 600 }),
    invalidateSize: () => {},
  }
  const mockMapEl = {} as HTMLElement

  let pass = 0
  let fail = 0
  const check = (cond: boolean, msg: string) => {
    console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${msg}`)
    if (cond) pass++
    else fail++
  }

  const p = emptyProject()
  p.pemrakarsa = 'Nanang Budiyanto'
  p.kegiatan = 'Perumahan Permata Regency'
  p.tahun = 2026
  p.provinsi = 'Jawa Tengah'
  p.features = [
    makeFeature('titik-pantau', { type: 'Point', c: { lon: 110.611, lat: -7.73144 } }, 'B1', 'Titik Pemantauan Kebisingan'),
    makeFeature('titik-kelola', { type: 'Point', c: { lon: 110.6105, lat: -7.7301 } }, 'U1', 'Ruang produksi'),
    makeFeature(
      'area-kelola',
      {
        type: 'Polygon',
        ring: [
          { lon: 110.6109, lat: -7.7297 },
          { lon: 110.6109, lat: -7.7296 },
          { lon: 110.6111, lat: -7.7296 },
          { lon: 110.6111, lat: -7.7297 },
        ],
      },
      'U1',
      'RTH',
    ),
  ]

  console.log('=== Ekspor folder (mock FS) ===')
  const res = await exportToFolder({
    project: p,
    subPath: '04_GIS/amdalnet',
    map: mockMap as never,
    mapEl: mockMapEl,
    include: ['titik-pantau', 'titik-kelola', 'area-kelola', 'tapak'],
    onProgress: () => {},
  })

  console.log('\n=== Hasil ===')
  console.log('Folder ditulis:', res.written.join(', '))
  console.log('Dilewati:', res.skipped.join(', ') || '(tidak ada)')
  console.log('\nFile yang ditulis:')
  for (const [path, data] of files) {
    console.log(`  ${path.split('<project-folder>')[1]}  (${data.length}B)`)
  }

  console.log('\n=== Pemeriksaan ===')
  const base = '<project-folder>/04_GIS/amdalnet'
  const expect = (path: string) => files.has(path)
  check(res.written.length === 3, `3 folder layer ditulis (dapat ${res.written.length})`)
  check(res.skipped.includes('tapak'), 'tapak (kosong) dilewati')
  check(expect(`${base}/titik_pantau/Titik Pantau.shp`), 'titik_pantau/Titik Pantau.shp ada')
  check(expect(`${base}/titik_pantau/Titik Pantau.shx`), 'titik_pantau/Titik Pantau.shx ada')
  check(expect(`${base}/titik_pantau/Titik Pantau.dbf`), 'titik_pantau/Titik Pantau.dbf ada')
  check(expect(`${base}/titik_pantau/Titik Pantau.prj`), 'titik_pantau/Titik Pantau.prj ada')
  check(expect(`${base}/titik_pantau/Titik Pantau.cpg`), 'titik_pantau/Titik Pantau.cpg ada')
  check(expect(`${base}/titik_pantau/Titik Pantau.zip`), 'titik_pantau/Titik Pantau.zip ada')
  check(expect(`${base}/titik_pantau/Titik Pantau.csv`), 'titik_pantau/Titik Pantau.csv ada')
  check(expect(`${base}/titik_kelola/Titik Kelola.dbf`), 'titik_kelola/Titik Kelola.dbf ada')
  check(expect(`${base}/area_kelola/Area Kelola.shp`), 'area_kelola/Area Kelola.shp ada')

  // verifikasi byte SHP hasil tulis vs builder langsung
  const written = files.get(`${base}/titik_pantau/Titik Pantau.shp`)!
  const direct = buildAndVerify(
    'titik',
    p.features
      .filter((f) => f.layer === 'titik-pantau')
      .map((f) => ({ geom: f.geom, attrs: {} })),
    [],
  )
  // catatan: direct tanpa attrs beda dbf, tapi .shp harus identik
  check(written.length === direct.shp.length, `ukuran .shp identik dengan builder (${written.length}B)`)

  // tulis ke disk untuk verifikasi pyshp
  mkdirSync('/tmp/folder-export-test/titik_pantau', { recursive: true })
  writeFileSync('/tmp/folder-export-test/titik_pantau/Titik Pantau.shp', written)
  writeFileSync('/tmp/folder-export-test/titik_pantau/Titik Pantau.dbf', files.get(`${base}/titik_pantau/Titik Pantau.dbf`)!)
  writeFileSync('/tmp/folder-export-test/titik_pantau/Titik Pantau.prj', files.get(`${base}/titik_pantau/Titik Pantau.prj`)!)
  mkdirSync('/tmp/folder-export-test/area_kelola', { recursive: true })
  writeFileSync('/tmp/folder-export-test/area_kelola/Area Kelola.shp', files.get(`${base}/area_kelola/Area Kelola.shp`)!)
  writeFileSync('/tmp/folder-export-test/area_kelola/Area Kelola.dbf', files.get(`${base}/area_kelola/Area Kelola.dbf`)!)
  console.log('\nFile ditulis ke /tmp/folder-export-test/ untuk verifikasi pyshp')

  console.log(`\n${fail === 0 ? 'SEMUA LOLOS' : `${fail} GAGAL`} (${pass} pass)`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('ERROR:', e)
  process.exit(1)
})
