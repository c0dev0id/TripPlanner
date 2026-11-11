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
 * Has the map draw each of the pictures when a style first needs it, by its id; every new
 * base map needs them again. The map waits for the drawing, which an SVG takes a moment for.
 */
export function provideImages(map: MapLibreMap, images: ReadonlyMap<string, MapImage>): void {
  map.setMissingStyleImageResolver(async (id) => {
    const image = images.get(id);
    if (!image) return;
    const side = image.size * image.pixelRatio;
    const picture = new Image(side, side);
    picture.src = image.url;
    await picture.decode();
    if (!map.hasImage(id)) map.addImage(id, picture, { pixelRatio: image.pixelRatio });
  });
}

/** A square picture from the SVG markup of a drawing in a box of `size` × `size`. */
export function svgImage(size: number, pixelRatio: number, drawing: string): MapImage {
  const side = size * pixelRatio;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="0 0 ${size} ${size}">${drawing}</svg>`;
  return { url: `data:image/svg+xml,${encodeURIComponent(svg)}`, size, pixelRatio };
}

/** The drawing of an icon set's SVG document, moved to (x, y), scaled and filled, to place in a picture of our own. */
export function svgInlay(document: string, x: number, y: number, scale: number, fill: string): string {
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="${fill}">${/<svg[^>]*>(.*)<\/svg>/s.exec(document)![1]!}</g>`;
}
