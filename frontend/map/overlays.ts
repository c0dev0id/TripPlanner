import type { LayerSpecification, SourceSpecification } from 'maplibre-gl';
import { createSignal } from 'solid-js';
import { readPreference, writePreference } from '../ui/preferences';
import { CLOSURES } from './closuresOverlay';
import type { MapImage } from './mapImages';
import { ROADWORKS } from './roadworksOverlay';

/**
 * What the map draws between the base map and the trip while switched on: the roadworks
 * two German states' services list, and the roads closed to motorcycles.
 */

/** What a feature tapped on the map says about itself. */
export interface TapInfo {
  title: string;
  lines: string[];
  /** Said last and quietly, such as who reports it. */
  note?: string | undefined;
}

export interface Overlay {
  id: string;
  label: string;
  /**
   * Its sources and layers over a base map that is drawn sharp up to the zoom `sharpUntil`
   * and blown up beyond it, as raster tiles are; Infinity for a base map sharp at every zoom.
   */
  parts: (sharpUntil: number) => { sources: Record<string, SourceSpecification>; layers: LayerSpecification[] };
  /** The picture on its button. */
  sign: MapImage;
  /** The pictures its layers draw, by the id they ask for them. */
  images: ReadonlyMap<string, MapImage>;
  /** The layers whose features say what they are on a tap, and what each says. */
  taps: { layers: string[]; info: (properties: Record<string, unknown>) => TapInfo }[];
}

export const OVERLAYS: readonly Overlay[] = [ROADWORKS, CLOSURES];

/** The ids of the overlays this browser switched on. */
const [shownIds, setShownIds] = createSignal<readonly string[]>((readPreference('overlays') ?? '').split(',').filter((id) => OVERLAYS.some((o) => o.id === id)));

export const isShown = (overlay: Overlay): boolean => shownIds().includes(overlay.id);

export const shownOverlays = (): Overlay[] => OVERLAYS.filter(isShown);

/** Switches the overlay on or off and keeps that for this browser. */
export function toggleOverlay(overlay: Overlay): void {
  const ids = isShown(overlay) ? shownIds().filter((id) => id !== overlay.id) : [...shownIds(), overlay.id];
  setShownIds(ids);
  writePreference('overlays', ids.length > 0 ? ids.join(',') : undefined);
}
