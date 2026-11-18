/** A tag the user made to tell trips apart: a name in a colour, as `#rrggbb`. */
export interface Tag {
  id: number;
  name: string;
  color: string;
}

/** The colour a new tag starts with. */
export const NEW_TAG_COLOR = '#1565c0';

/** The colour text is read in on a chip of the given colour: black on a light one, white on a dark one. */
export function inkOn(color: string): '#000000' | '#ffffff' {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16));
  return (r! * 299 + g! * 587 + b! * 114) / 1000 > 150 ? '#000000' : '#ffffff';
}

/** Of the tags, those on something that names them by id, in the tags' own order. */
export const tagsOn = (tags: readonly Tag[], ids: readonly number[]): Tag[] => tags.filter((tag) => ids.includes(tag.id));
