import { describe, expect, it } from 'vitest';
import { filesIn, sharesOf, takes, wholeFile, type ClipKind, type Place } from './paste';
import type { StashFile, StashItem } from './stash';

const item = (kind: StashItem['kind'], position = 0) => ({ kind, position, name: '' }) as StashItem;
const file = (id: number, items: StashItem[], waypoints = 0, media = 0) => ({ id, name: `g${id}`, items, waypoints, media: Array.from({ length: media }, (_, n) => ({ id: n })) }) as StashFile;

const KINDS: ClipKind[] = ['days', 'categories', 'routes', 'stops', 'recordings', 'media', 'files', 'folders', 'parts'];

/** The matrix, a row for each place: what it takes, in the order of KINDS. */
const MATRIX: Record<Place, string> = {
  //            days cat  rout stop rec  med  file fold part
  tripsFolder: 'x    .    .    .    .    .    x    x    .',
  placesFolder: '.   .    .    .    .    .    x    .    .',
  trip: '       x    .    x    .    .    .    x    x    x',
  list: '       .    x    .    x    .    .    x    .    x',
  day: '        x    x    x    x    x    x    x    .    x',
  bareDay: '    x    .    x    .    x    x    x    .    x',
  category: '   .    x    .    x    .    .    x    .    x',
  route: '      .    .    .    x    .    .    .    .    .',
  stashFile: '  .    .    .    .    .    .    .    .    x',
  recordings: ' .    .    .    .    .    .    x    .    x',
};

describe('takes', () => {
  for (const [place, row] of Object.entries(MATRIX) as [Place, string][]) {
    const cells = row.trim().split(/\s+/);
    for (const [n, kind] of KINDS.entries()) {
      it(`${place} ${cells[n] === 'x' ? 'takes' : 'does not take'} ${kind}`, () => {
        expect(takes(place, kind)).toBe(cells[n] === 'x');
      });
    }
  }

  it('takes files and parts only where they hold something the place has a use for', () => {
    const route = [wholeFile(file(1, [item('route')]))];
    const waypoints = [wholeFile(file(2, [], 3))];
    expect(takes('trip', 'files', route)).toBe(true);
    expect(takes('trip', 'files', waypoints)).toBe(false);
    expect(takes('list', 'files', waypoints)).toBe(true);
    expect(takes('list', 'files', route)).toBe(false);
    expect(takes('category', 'parts', route)).toBe(false);
    expect(takes('recordings', 'parts', route)).toBe(false);
    expect(takes('recordings', 'parts', [wholeFile(file(3, [item('track')]))])).toBe(true);
  });
});

describe('sharesOf', () => {
  const whole = wholeFile(file(1, [item('route'), item('track')], 2, 1));

  it('gives a day and a file of the Stash all of a part', () => {
    expect(sharesOf('day', [whole])).toEqual([whole]);
    expect(sharesOf('stashFile', [whole])).toEqual([whole]);
  });

  it('gives the row of a trip the routes and tracks, a list and a category the waypoints, the recordings the tracks', () => {
    expect(sharesOf('trip', [whole])).toEqual([{ ...whole, media: false }]);
    expect(sharesOf('list', [whole])).toEqual([{ ...whole, items: [], media: false }]);
    expect(sharesOf('category', [whole])).toEqual([{ ...whole, items: [], media: false }]);
    expect(sharesOf('recordings', [whole])).toEqual([{ ...whole, items: [item('track')], waypoints: false, media: false }]);
  });

  it('gives a day without a route the waypoints only with the routes and tracks they come with', () => {
    expect(sharesOf('bareDay', [wholeFile(file(2, [], 3))])).toEqual([]);
    expect(sharesOf('bareDay', [whole])).toEqual([{ ...whole, media: whole.media }]);
  });

  it('leaves out a part the place has no use for, and waypoints or media a file has none of', () => {
    expect(sharesOf('list', [wholeFile(file(2, [item('route')]))])).toEqual([]);
    expect(sharesOf('route', [whole])).toEqual([]);
    expect(sharesOf('day', [{ file: file(3, [], 0, 0), items: [], waypoints: true, media: true }])).toEqual([]);
  });
});

describe('filesIn', () => {
  it('lists the files of a copied folder at any depth', () => {
    const [a, b] = [file(1, []), file(2, [])];
    expect(filesIn({ name: 'top', files: [a], folders: [{ name: 'in', files: [b], folders: [] }] })).toEqual([a, b]);
  });
});
