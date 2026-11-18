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

/** How a line of the caption is set: its font and colour, how high the line is and how far under its top its letters stand. */
interface Setting {
  font: string;
  color: string;
  height: number;
  baseline: number;
}
const TITLE: Setting = { font: `600 64px ${PROSE}`, color: INK, height: 70, baseline: 52 };
const PLACES: Setting = { font: `500 30px ${LABEL}`, color: MARK, height: 40, baseline: 30 };
/** How many lines the name has at most, and the places. */
const LINES = 2;
/** The room over the caption's first line, between the name and the places, and under its last line. */
const [ABOVE, BETWEEN, BELOW] = [40, 10, 44];

/** Names as the words of a line, a dash after each but the last. */
const dashed = (names: readonly string[]): string[] => names.map((name, n) => (n < names.length - 1 ? `${name} –` : name));

/** The places that fit the caption's lines: all of them, or with those in the middle left out for a mark, so that where the trip begins and where it ends are always named. */
function placesThatFit(context: CanvasRenderingContext2D, places: readonly string[]): string[] {
  let [first, last] = [places.slice(0, Math.ceil(places.length / 2)), places.slice(Math.ceil(places.length / 2))];
  let shown = [...places];
  while (first.length + last.length > 2 && linesOf(context, dashed(shown), CARD_WIDTH - 2 * EDGE, Infinity).length > LINES) {
    if (first.length > last.length) first = first.slice(0, -1);
    else last = last.slice(1);
    shown = [...first, '…', ...last];
  }
  return shown;
}

/** What stands under the map: the trip's name and the places it goes to, each line with how it is set and how far under the caption's top it stands, and how high the caption is. */
function captionOf(context: CanvasRenderingContext2D, name: string, destinations: readonly string[]) {
  const set = (setting: Setting, words: readonly string[], top: number) => {
    context.font = setting.font;
    return linesOf(context, words, CARD_WIDTH - 2 * EDGE, LINES).map((text, i) => ({ text, setting, y: top + i * setting.height + setting.baseline }));
  };
  const title = set(TITLE, name.split(/\s+/), ABOVE);
  const under = ABOVE + title.length * TITLE.height + BETWEEN;
  context.font = PLACES.font;
  const places = destinations.length > 1 ? set(PLACES, dashed(placesThatFit(context, destinations)), under) : [];
  return { lines: [...title, ...places], height: (places.length > 0 ? under + places.length * PLACES.height : under - BETWEEN) + BELOW };
}

/** The base map's style as it was read, kept for the cards made after the first. */
let baseStyle: StyleSpecification | undefined;

/** The map's style without its names and signs, and with the routes and the ends of the days on it. */
async function styleOf(days: readonly LngLat[][][]): Promise<StyleSpecification> {
  const base = (baseStyle ??= (await (await fetch(STYLE_URL)).json()) as StyleSpecification);
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
  await Promise.all([TITLE, PLACES].map((setting) => document.fonts.load(setting.font)));
  const picture = Object.assign(document.createElement('canvas'), { width: CARD_WIDTH, height: CARD_HEIGHT });
  const context = picture.getContext('2d')!;
  const caption = captionOf(context, name, destinations);
  const lines = days.flat();
  const points = lines.flat();
  const container = document.createElement('div');
  container.style.cssText = `position: fixed; left: -${2 * CARD_WIDTH}px; top: 0; width: ${CARD_WIDTH}px; height: ${CARD_HEIGHT}px;`;
  document.body.append(container);
  const map = new MapLibreMap({ container, style: await styleOf(days), interactive: false, attributionControl: false, pixelRatio: 1, fadeDuration: 0, canvasContextAttributes: { preserveDrawingBuffer: true } });
  try {
    await new Promise<void>((drawn, failed) => {
      const late = setTimeout(() => failed(new Error(t('Drawing the share card map timed out.'))), DRAWN_WITHIN_MS);
      map.once('load', () => {
        const area = points.reduce((all, point) => all.extend(point), new LngLatBounds());
        map.fitBounds(area, { bearing: bestBearing(lines, CARD_WIDTH / (CARD_HEIGHT - caption.height), CARD_PITCH), pitch: CARD_PITCH, padding: EDGE, animate: false });
        fill(map, points, { left: EDGE, top: EDGE, right: CARD_WIDTH - EDGE, bottom: CARD_HEIGHT - caption.height - EDGE / 2 });
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
  for (const { text, setting, y } of caption.lines) {
    context.font = setting.font;
    context.fillStyle = setting.color;
    context.fillText(text, EDGE, top + y);
  }
  context.font = `400 15px ${LABEL}`;
  context.fillStyle = SOFT;
  context.textAlign = 'right';
  context.fillText(ATTRIBUTION, CARD_WIDTH - 16, CARD_HEIGHT - 14);
  return new Promise((made, failed) => picture.toBlob((blob) => (blob ? made(blob) : failed(new Error(t('The share card could not be drawn.')))), 'image/jpeg', 0.86));
}
