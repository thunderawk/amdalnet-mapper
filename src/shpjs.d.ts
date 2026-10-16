declare module 'shpjs' {
  interface ShpjsGeometry {
    type: string
    coordinates: unknown
  }
  interface ShpjsFeature {
    type: 'Feature'
    geometry: ShpjsGeometry | null
    properties: Record<string, unknown> | null
  }
  interface ShpjsFeatureCollection {
    type: 'FeatureCollection'
    features: ShpjsFeature[]
  }
  interface ShpjsPart {
    name: string
    content: ArrayBuffer
  }
  interface ShpjsObject {
    shp: ArrayBuffer
    dbf?: ArrayBuffer
    prj?: string
    cpg?: string
  }
  function shpjs(input: ArrayBuffer | string | ShpjsObject): Promise<ShpjsFeatureCollection>
  namespace shpjs {
    function combine(parts: ShpjsPart[]): Promise<ShpjsFeatureCollection>
    function parseShp(buffer: ArrayBuffer): Promise<ShpjsGeometry[]>
    function parseDbf(buffer: ArrayBuffer): Promise<Record<string, unknown>[]>
    function parseZip(buffer: ArrayBuffer): Promise<ShpjsFeatureCollection>
  }
  export = shpjs
}
