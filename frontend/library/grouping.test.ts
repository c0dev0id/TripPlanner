import { describe, expect, it } from 'vitest';
import type { StashFile } from '../model/stash';
import type { LngLat } from '../model/trip';
import { encodePolyline } from '../routing/polyline';
import { commonName, groupFiles, tourWords } from './grouping';

const HOME: LngLat = [8.5, 49.5];
const LAKE: LngLat = [9.5, 48.5];
const CAVE: LngLat = [10.5, 48.5];
const PASS: LngLat = [11.5, 47.5];

let ids = 0;
/** A file of one route from a place to another, written by BaseCamp at the minute given of one evening, or of another day. */
function file(name: string, from: LngLat, to: LngLat, minute = 0, day = '2024-06-18'): StashFile {
  const item = { kind: 'route' as const, position: 0, name, line: encodePolyline([from, to]), distanceM: 100_000, points: 2, startedAt: null, features: [] };
  return { id: ++ids, folderId: 1, name, createdAt: '', waypoints: 0, creator: 'Garmin Desktop App', exportedAt: `${day}T18:${String(minute).padStart(2, '0')}:00Z`, items: [item] };
}

/** The groups as their names and the names of their files. */
const named = (files: StashFile[], elsewhere: StashFile[] = []) => groupFiles(files, elsewhere).map((group) => [group.name, group.files.map((f) => f.name)]);

describe('the words of a name that say which tour it is of', () => {
  it('leave out brackets, numbers, short and generic words, and read umlauts as written out', () => {
    expect(tourWords('Rückfahrt Bergstraße (Teil 2) 165km am 17.Juli')).toEqual(['bergstrasse']);
    expect(tourWords('2014 - Dolos und Gardasee_Tour-03_Sella Ronda')).toEqual(['dolos', 'gardasee', 'sella', 'ronda']);
    expect(tourWords('Tag 01_ III')).toEqual([]);
  });
});

describe('a folder name from what names have in common', () => {
  it('is their common text, cut to whole words, without the counter of their legs', () => {
    expect(commonName(['Summer_Opening-Tour (Teil 1)', 'Summer_Opening-Tour (Teil 2)'])).toBe('Summer_Opening-Tour');
    expect(commonName(['Highlands 2014 Tag 1', 'Highlands 2014 Tag 2'])).toBe('Highlands 2014');
    expect(commonName(['Harz Hinfahrt Etappe 1', 'Harz Rundtour 2. Teil', 'Harztour Rückfahrt Etappe 4'])).toBe('Harz');
    expect(commonName(['Anfahrt Saisonstart 2016', 'Rückfahrt Saisonstart 2016'])).toBe('Saisonstart 2016');
    expect(commonName(['Kleine Pfalzfahrt (220 km) (Teil 1)', 'Kleine Pfalzfahrt (220 km) (Teil 2)'])).toBe('Kleine Pfalzfahrt (220 km)');
    expect(commonName(['Lakeside ride', 'Lakeside ride (362)'])).toBe('Lakeside ride');
  });

  it('is the first name where they share nothing that says which tour', () => {
    expect(commonName(['Tag 01_ Altdorf bis Brig', 'Tag 02_ Brig bis Aosta'])).toBe('Tag 01_ Altdorf bis Brig');
  });
});

describe('the files of a folder that belong together', () => {
  it('are the legs of a ride named alike, each going on where the last ended', () => {
    const legs = [file('Lakeside ride (362)', HOME, LAKE, 0, '2021-01-01'), file('Lakeside ride (363)', LAKE, CAVE, 0, '2021-02-01'), file('Lakeside ride', CAVE, HOME, 0, '2021-03-01')];
    const groups = groupFiles([...legs, file('Somewhere else', PASS, PASS, 0, '2021-04-01')], []);
    expect(groups.map((group) => [group.name, group.files.length, group.clues])).toEqual([['Lakeside ride', 3, ['name', 'onward']]]);
  });

  it('are not rounds from home that share a word and nothing else', () => {
    const rounds = [file('Evening lap', HOME, HOME, 0, '2021-01-01'), file('Evening lap to the mill', HOME, HOME, 0, '2021-02-01'), file('Evening lap, short', HOME, HOME, 0, '2021-03-01')];
    expect(named(rounds)).toEqual([]);
  });

  it('are not rides that only end where others of other folders set out too', () => {
    const rides = [file('Forest inn outbound', LAKE, HOME, 0, '2021-01-01'), file('Forest loop', HOME, CAVE, 0, '2021-02-01')];
    expect(named(rides)).toEqual([['Forest', ['Forest inn outbound', 'Forest loop']]]);
    const fromHome = [file('A', HOME, PASS), file('B', HOME, PASS), file('C', HOME, PASS)].map((f) => ({ ...f, folderId: 2 }));
    expect(named(rides, fromHome)).toEqual([]);
  });

  it('are a way there and a way back, also where the place between is a common one', () => {
    const pair = [file('Anfahrt Saisonstart 2016', HOME, LAKE, 0, '2016-04-01'), file('Rückfahrt Saisonstart 2016', LAKE, [8.6, 49.4], 0, '2016-04-20')];
    const fromLake = [file('A', LAKE, PASS), file('B', LAKE, PASS), file('C', LAKE, PASS)].map((f) => ({ ...f, folderId: 2 }));
    expect(groupFiles(pair, fromLake).map((group) => [group.name, group.clues])).toEqual([['Saisonstart 2016', ['name', 'thereAndBack']]]);
  });

  it('are files written together that go on from each other, whatever they are called', () => {
    const first = [file('Tag 01_ Altdorf bis Brig', HOME, LAKE, 1), file('Tag 02_ Brig bis Aosta', LAKE, CAVE, 2), file('Tag 03_ Rund um Aosta', CAVE, CAVE, 3), file('Tag 04_ Heim', CAVE, HOME, 4)];
    const second = [file('Tag 1_ von Wörth nach Voiron', HOME, PASS, 1, '2024-03-26'), file('Tag 2_ von Voiron nach Sisteron', PASS, [12.5, 46.5], 2, '2024-03-26')];
    expect(named([...first, ...second]).map(([, files]) => files)).toEqual([first.map((f) => f.name), second.map((f) => f.name)]);
  });

  it('are files whose names begin with the same two words, whenever they were written', () => {
    const days = [file('Alpine Passes Tour-01 Arrival', HOME, PASS, 0, '2014-07-06'), file('Alpine Passes Tour-04 The classic', [12, 47], [12, 47], 0, '2014-08-07')];
    expect(named(days)).toEqual([['Alpine Passes Tour', days.map((f) => f.name)]]);
  });

  it('keep a tour whole whose days all leave from its base', () => {
    const tour = [
      file('Northlands - From home to the lake', HOME, LAKE, 0, '2022-06-21'),
      file('Northlands - Lake round', LAKE, LAKE, 0, '2022-06-22'),
      file('Northlands - From the lake to the cave', LAKE, CAVE, 0, '2022-06-23'),
      file('Northlands - From the cave to the lake', CAVE, LAKE, 0, '2022-06-24'),
      file('Northlands - From the lake home', LAKE, HOME, 0, '2022-06-25'),
    ];
    expect(groupFiles(tour, []).map((group) => [group.name, group.files.length])).toEqual([['Northlands', 5]]);
  });
});
