import { expect, it } from 'vitest';
import { comparedLayers, dotFeatures, recordingLayers } from './recordingOverlay';
import { lineAt } from './zoomSize';

/** The width a line layer has at a zoom its expression names. */
const widthAt = (layer: { paint?: unknown }, zoom: number): unknown => {
  const stops = ((layer.paint as Record<string, unknown[]>)['line-width'] ?? []).slice(3);
  return stops[stops.indexOf(zoom) + 1];
};

it('draws recordings and compared routes as wide as routes, keeping pace with the roads of a base map blown up', () => {
  for (const layers of [recordingLayers(5, 17), comparedLayers(5, 17)]) {
    const line = layers.find((layer) => layer.id.endsWith('-line'))!;
    expect([12, 18, 21].map((zoom) => widthAt(line, zoom))).toEqual([5, 12, 96]);
    expect(widthAt(line, 21)).toBe(lineAt(21, 5, 17));
    const casing = layers.find((layer) => layer.id.endsWith('-casing'))!;
    expect(widthAt(casing, 12)).toBe(7.5);
  }
  expect(widthAt(recordingLayers(5, Infinity).find((layer) => layer.id.endsWith('-line'))!, 21)).toBe(9);
});

it('draws a ride held against a day narrow and bare, apart from what is compared as wide as routes', () => {
  const layers = comparedLayers(5, 17);
  expect(layers.map((layer) => layer.id)).toEqual(['compared-casing', 'compared-line', 'compared-held', 'compared-dots']);
  expect(widthAt(layers[2]!, 12)).toBe(2);
  expect((layers[2] as { filter?: unknown }).filter).toEqual(['==', ['get', 'held'], true]);
  expect((layers[1] as { filter?: unknown }).filter).toEqual(['!', ['==', ['get', 'held'], true]]);
});

it('draws single positions as dots, the lines left to the line layers', () => {
  expect(comparedLayers(5, 17)[3]).toMatchObject({ type: 'circle', filter: ['==', ['geometry-type'], 'Point'] });
  expect(dotFeatures([[8.7, 49.4]])).toEqual([{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [8.7, 49.4] } }]);
});
