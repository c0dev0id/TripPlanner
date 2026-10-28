/** The parts of libheif's browser bundle the photo conversion uses. */
declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
  interface HeifImage {
    get_width(): number;
    get_height(): number;
    display(target: { data: Uint8ClampedArray<ArrayBuffer>; width: number; height: number }, done: (shown: { data: Uint8ClampedArray<ArrayBuffer> } | null) => void): void;
  }
  interface LibHeif {
    HeifDecoder: new () => { decode(bytes: Uint8Array): HeifImage[] };
  }
  const factory: () => Promise<LibHeif>;
  export default factory;
}
