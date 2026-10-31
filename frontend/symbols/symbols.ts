import garmin from './garmin-symbols.json';

/** The drawings of our own stop icons (see StopShape). */
export type StopIcon = 'other' | 'start' | 'end' | 'meeting' | 'hotel' | 'restaurant' | 'cafe' | 'fuel' | 'sight' | 'info' | 'photo' | 'break';

/**
 * Our icons, each standing for one Garmin symbol: a stop with that symbol shows the icon,
 * and choosing the icon gives a stop that symbol, which is what a GPX file carries.
 */
export const OUR_ICONS: readonly { icon: StopIcon; label: string; symbol: string }[] = [
  { icon: 'other', label: 'Stop', symbol: 'Pin, Blue' },
  { icon: 'start', label: 'Start', symbol: 'Flag, Green' },
  { icon: 'end', label: 'End', symbol: 'Flag, Blue' },
  { icon: 'meeting', label: 'Meeting point', symbol: 'Navaid, Violet' },
  { icon: 'hotel', label: 'Hotel', symbol: 'Hotel' },
  { icon: 'restaurant', label: 'Restaurant', symbol: 'Restaurant' },
  { icon: 'cafe', label: 'Café', symbol: 'Navaid, Black' },
  { icon: 'fuel', label: 'Fuel', symbol: 'Gas Station' },
  { icon: 'sight', label: 'Sight', symbol: 'Navaid, White' },
  { icon: 'info', label: 'Info', symbol: 'Information' },
  { icon: 'photo', label: 'Photo spot', symbol: 'Scenic Area' },
  { icon: 'break', label: 'Break', symbol: 'Navaid, Blue' },
];

/** The symbol a new stop gets: our plain Stop's. */
export const PLAIN_SYMBOL = OUR_ICONS[0]!.symbol;

/** Garmin's waypoint symbols by theme, as the stop dialog offers them. */
export const GARMIN_GROUPS: readonly { title: string; names: readonly string[] }[] = garmin.groups;

const WITH_PICTURE = new Set(garmin.groups.flatMap((g) => g.names).filter((n) => !garmin.withoutPicture.includes(n)));

/** Whether `make garmin-icons` fetches a picture of the symbol: one of Garmin's listed symbols that has one. */
export const hasPicture = (symbol: string): boolean => WITH_PICTURE.has(symbol);

/** Our icon for a symbol; a stop without a symbol is a plain stop. Undefined where Garmin's own picture stands for the symbol. */
export const ourIcon = (symbol: string | null): StopIcon | undefined => (symbol === null ? 'other' : OUR_ICONS.find((o) => o.symbol === symbol)?.icon);

/** What a stop's symbol is called: our icon's label or Garmin's name; nothing for a plain stop. */
export function symbolLabel(symbol: string | null): string | undefined {
  if (symbol === null || symbol === PLAIN_SYMBOL) return undefined;
  return OUR_ICONS.find((o) => o.symbol === symbol)?.label ?? symbol;
}

/** Where Garmin's picture of a symbol is served once `make garmin-icons` has fetched it: the name, a slash made a dash, as a PNG file. */
export const garminPictureUrl = (symbol: string): string => `/garmin-symbols/${encodeURIComponent(symbol.replaceAll('/', '-'))}.png`;
