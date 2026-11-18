import '@fontsource-variable/newsreader';
import { LngLatBounds, Map as MapLibreMap, type StyleSpecification } from 'maplibre-gl';
import { t } from '../i18n/t';
import { bestBearing, CARD_HEIGHT, CARD_PITCH, CARD_WIDTH, dayEnds } from '../model/shareCard';
import type { LngLat } from '../model/trip';
import { BASE_MAPS } from './baseMaps';

/**
 * The picture of a shared trip's card: its routes on a map without names, tilted and
 * turned to fill the picture, and under it the trip's name and the places it goes to.
 * Drawn on a map of its own that is never seen, and read off it as a JPEG.
 */

/** The colours of the trip's page in its light scheme, which the card is drawn in. */
const [PAPER, INK, SOFT, MARK] = ['#fdfdfb', '#1b1d1f', '#5d6166', '#b4440f'];
const PROSE = "'Newsreader Variable', Georgia, serif";
const LABEL = "system-ui, -apple-system, 'Segoe UI', sans-serif";
/** How far the text and the routes stay off the card's edges. */
const EDGE = 64;
/** How long the map may take to draw. */
const DRAWN_WITHIN_MS = 45_000;
const ATTRIBUTION = '© OpenStreetMap · OpenFreeMap';
const STYLE_URL = BASE_MAPS.find((map) => map.id === 'positron')!.style as string;

/** Words set in lines no wider than `width`, at most `most` of them; a mark stands for those left out. */
function linesOf(context: CanvasRenderingContext2D, words: readonly string[], width: number, most: number): string[] {
  const lines: string[] = [];
  for (const word of words) {
    const longer = `${lines.at(-1)} ${word}`;
    if (lines.length > 0 && context.measureText(longer).width <= width) lines[lines.length - 1] = longer;
    else if (lines.length < most) lines.push(word);
    else {
      lines[most - 1] = `${lines[most - 1]!.replace(/ –$/, '')} …`;
      break;
    }
  }
  return lines;
}

/** What stands under the map: the trip's name and the places it goes to, each in its lines, and how high that is. */
function captionOf(context: CanvasRenderingContext2D, name: string, destinations: readonly string[]) {
  const width = CARD_WIDTH - 2 * EDGE;
  context.font = `600 64px ${PROSE}`;
  const title = linesOf(context, name.split(/\s+/), width, 2);
  context.font = `500 30px ${LABEL}`;
  const places = destinations.length > 1 ? linesOf(context, destinations.map((place, i) => (i < destinations.length - 1 ? `${place} –` : place)), width, 2) : [];
  return { title, places, height: 40 + title.length * 70 + (places.length > 0 ? 10 + places.length * 40 : 0) + 44 };
}

/** The map's style without its names and signs, and with the routes and the ends of the days on it. */
async function styleOf(days: readonly LngLat[][][]): Promise<StyleSpecification> {
  const base = (await (await fetch(STYLE_URL)).json()) as StyleSpecification;
  const round = { 'line-cap': 'round', 'line-join': 'round' } as const;
  return {
    ...base,
    sources: {
      ...base.sources,
      routes: { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: days.flat() } } },
      ends: { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'MultiPoint', coordinates: dayEnds(days) } } },
    },
    layers: [
      ...base.layers.filter((layer) => layer.type !== 'symbol'),
      { id: 'card-casing', type: 'line', source: 'routes', layout: round, paint: { 'line-color': '#ffffff', 'line-width': 11 } },
      { id: 'card-routes', type: 'line', source: 'routes', layout: round, paint: { 'line-color': MARK, 'line-width': 6 } },
      { id: 'card-ends', type: 'circle', source: 'ends', paint: { 'circle-radius': 8, 'circle-color': '#ffffff', 'circle-stroke-color': MARK, 'circle-stroke-width': 4 } },
    ],
  };
}

/** Moves the tilted map until the points fill the box of the picture given, which a fit that reckons without the tilt leaves them short of or beyond. */
function fill(map: MapLibreMap, points: readonly LngLat[], box: { left: number; top: number; right: number; bottom: number }): void {
  for (let round = 0; round < 6; round++) {
    let [left, right, top, bottom] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const point of points) {
      const { x, y } = map.project(point);
      [left, right, top, bottom] = [Math.min(left, x), Math.max(right, x), Math.min(top, y), Math.max(bottom, y)];
    }
    const scale = Math.min((box.right - box.left) / Math.max(right - left, 1), (box.bottom - box.top) / Math.max(bottom - top, 1));
    map.panBy([(left + right) / 2 - (box.left + box.right) / 2, (top + bottom) / 2 - (box.top + box.bottom) / 2], { animate: false });
    map.setZoom(map.getZoom() + Math.log2(scale));
  }
}

/** The card of a trip with these lines by day, headed with its name and the places named; throws where the map cannot be drawn. */
export async function cardPicture(name: string, days: readonly LngLat[][][], destinations: readonly string[]): Promise<Blob> {
  await Promise.all([document.fonts.load(`600 64px ${PROSE}`), document.fonts.load(`500 30px ${LABEL}`)]);
  const picture = Object.assign(document.createElement('canvas'), { width: CARD_WIDTH, height: CARD_HEIGHT });
  const context = picture.getContext('2d')!;
  const caption = captionOf(context, name, destinations);
  const lines = days.flat();
  const container = document.createElement('div');
  container.style.cssText = `position: fixed; left: -${2 * CARD_WIDTH}px; top: 0; width: ${CARD_WIDTH}px; height: ${CARD_HEIGHT}px;`;
  document.body.append(container);
  const map = new MapLibreMap({ container, style: await styleOf(days), interactive: false, attributionControl: false, pixelRatio: 1, fadeDuration: 0, canvasContextAttributes: { preserveDrawingBuffer: true } });
  try {
    await new Promise<void>((drawn, failed) => {
      const late = setTimeout(() => failed(new Error(t('The map of the share card took too long to draw.'))), DRAWN_WITHIN_MS);
      map.once('load', () => {
        const area = lines.flat().reduce((all, point) => all.extend(point), new LngLatBounds());
        map.fitBounds(area, { bearing: bestBearing(lines, CARD_WIDTH / (CARD_HEIGHT - caption.height), CARD_PITCH), pitch: CARD_PITCH, padding: EDGE, animate: false });
        fill(map, lines.flat(), { left: EDGE, top: EDGE, right: CARD_WIDTH - EDGE, bottom: CARD_HEIGHT - caption.height - EDGE / 2 });
        map.once('idle', () => {
          clearTimeout(late);
          drawn();
        });
      });
    });
    context.drawImage(map.getCanvas(), 0, 0);
  } finally {
    map.remove();
    container.remove();
  }
  const top = CARD_HEIGHT - caption.height;
  const fade = context.createLinearGradient(0, top - 40, 0, top);
  fade.addColorStop(0, `${PAPER}00`);
  fade.addColorStop(1, PAPER);
  context.fillStyle = fade;
  context.fillRect(0, top - 40, CARD_WIDTH, 40);
  context.fillStyle = PAPER;
  context.fillRect(0, top, CARD_WIDTH, caption.height);
  context.textBaseline = 'alphabetic';
  let line = top + 40 + 52;
  context.font = `600 64px ${PROSE}`;
  context.fillStyle = INK;
  for (const text of caption.title) {
    context.fillText(text, EDGE, line);
    line += 70;
  }
  context.font = `500 30px ${LABEL}`;
  context.fillStyle = MARK;
  line += 10 - 22;
  for (const text of caption.places) {
    context.fillText(text, EDGE, line);
    line += 40;
  }
  context.font = `400 15px ${LABEL}`;
  context.fillStyle = SOFT;
  context.textAlign = 'right';
  context.fillText(ATTRIBUTION, CARD_WIDTH - 16, CARD_HEIGHT - 14);
  return new Promise((made, failed) => picture.toBlob((blob) => (blob ? made(blob) : failed(new Error(t('The share card could not be drawn.')))), 'image/jpeg', 0.86));
}
