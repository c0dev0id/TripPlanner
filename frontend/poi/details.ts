/** What a place's OpenStreetMap tags say about it, for its details on the map. */

export interface PoiDetails {
  /** The place's name, or its brand or operator where it has none. */
  name?: string;
  /** Address, cuisine, opening hours and phone number, a line each, as far as tagged. */
  lines: string[];
  /** The place's homepage as a web address. */
  homepage?: string;
}

/** A tagged address as one a link can take: many are written without "https://"; anything of another scheme is none. */
function webAddress(tagged: string): string | undefined {
  const address = tagged.split(';')[0]!.trim();
  if (/^https?:\/\//i.test(address)) return address;
  return /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(address) ? `https://${address}` : undefined;
}

/** The tags the details are made of: what is worth keeping of a place. */
const DETAIL_TAGS = ['name', 'brand', 'operator', 'addr:street', 'addr:housenumber', 'addr:postcode', 'addr:city', 'cuisine', 'opening_hours', 'phone', 'contact:phone', 'website', 'contact:website', 'url'];

export const detailTags = (tags: Readonly<Record<string, string>>): Record<string, string> => Object.fromEntries(DETAIL_TAGS.flatMap((key) => (tags[key] ? [[key, tags[key]]] : [])));

export function poiDetails(tags: Readonly<Record<string, string>>): PoiDetails {
  const joined = (...keys: string[]) => keys.flatMap((key) => (tags[key] ? [tags[key]] : [])).join(' ');
  const homepage = webAddress(tags['website'] ?? tags['contact:website'] ?? tags['url'] ?? '');
  const lines = [
    joined('addr:street', 'addr:housenumber'),
    joined('addr:postcode', 'addr:city'),
    (tags['cuisine'] ?? '').replaceAll(';', ', ').replaceAll('_', ' '),
    tags['opening_hours'] ?? '',
    tags['phone'] ?? tags['contact:phone'] ?? '',
  ];
  const name = tags['name'] || tags['brand'] || tags['operator'];
  return { ...(name && { name }), lines: lines.filter((line) => line !== ''), ...(homepage && { homepage }) };
}
