import type { Map as MapLibreMap } from 'maplibre-gl';

/** A square picture for the map's layers, drawn from an SVG address. */
export interface MapImage {
  url: string;
  /** Its side in CSS pixels at icon size 1. */
  size: number;
  /** How many pixels it is drawn with per CSS pixel: more for a picture the map enlarges. */
  pixelRatio: number;
}

/**
 * Gives the map each of the pictures when a style asks for it by its id, which every new
 * base map does again. A style has to be answered at once and an SVG takes a moment to
 * draw, so a picture asked for too early is empty first and filled in when it is drawn.
 */
export function provideImages(map: MapLibreMap, images: ReadonlyMap<string, MapImage>): void {
  const drawn = new Map<string, HTMLImageElement>();
  map.on('styleimagemissing', ({ id }) => {
    const image = images.get(id);
    if (!image || map.hasImage(id)) return;
    const side = image.size * image.pixelRatio;
    map.addImage(id, drawn.get(id) ?? { width: side, height: side, data: new Uint8Array(side * side * 4) }, { pixelRatio: image.pixelRatio });
  });
  for (const [id, image] of images) {
    const side = image.size * image.pixelRatio;
    const picture = new Image(side, side);
    picture.src = image.url;
    void picture.decode().then(() => {
      drawn.set(id, picture);
      if (map.hasImage(id)) map.updateImage(id, picture);
    });
  }
}

/** The drawing inside an icon set's SVG document, to place in a picture of our own. */
export const svgContent = (document: string): string => /<svg[^>]*>(.*)<\/svg>/s.exec(document)![1]!;

export const svgUrl = (svg: string): string => `data:image/svg+xml,${encodeURIComponent(svg)}`;
