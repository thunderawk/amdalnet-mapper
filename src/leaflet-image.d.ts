declare module 'leaflet-image' {
  interface LeafletImageOptions {
    width?: number
    height?: number
  }
  function leafletImage(
    map: unknown,
    callback: (err: Error | null, canvas?: HTMLCanvasElement) => void,
    options?: LeafletImageOptions,
  ): void
  export = leafletImage
}
