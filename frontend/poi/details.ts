/** What a place's OpenStreetMap tags say about it, for its details on the map. */

export interface PoiDetails {
  /** The place's name, or its brand or operator where it has none. */
  name?: string;
  /** Address, cuisine, opening hours and phone number, a line each, as far as tagged. */
  lines: string[];
  website?: string;
}

export function poiDetails(tags: Readonly<Record<string, string>>): PoiDetails {
  const joined = (...keys: string[]) => keys.flatMap((key) => (tags[key] ? [tags[key]] : [])).join(' ');
  const website = tags['website'] ?? tags['contact:website'];
  const lines = [
    joined('addr:street', 'addr:housenumber'),
    joined('addr:postcode', 'addr:city'),
    (tags['cuisine'] ?? '').replaceAll(';', ', ').replaceAll('_', ' '),
    tags['opening_hours'] ?? '',
    tags['phone'] ?? tags['contact:phone'] ?? '',
  ];
  const name = tags['name'] ?? tags['brand'] ?? tags['operator'];
  return { ...(name && { name }), lines: lines.filter((line) => line !== ''), ...(website && /^https?:\/\//i.test(website) && { website }) };
}
