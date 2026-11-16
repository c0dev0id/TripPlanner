import { describe, expect, it } from 'vitest';
import type { CopiedFolder, StashFile } from '../model/stash';
import type { LngLat } from '../model/trip';
import { encodePolyline } from '../routing/polyline';
import { daysOf, planStashDays, planStashTrips } from './stashTrips';

const HOME: LngLat = [8.5, 49.5];
const LAKE: LngLat = [9.5, 48.5];
const CAVE: LngLat = [10.5, 48.5];
const PASS: LngLat = [11.5, 47.5];

let ids = 0;
/** A file of one route from a place to another, so many kilometres long, planned to leave at the time given where one is. */
function file(name: string, from: LngLat, to: LngLat, km: number, leaves: string | null = null): StashFile {
  const item = { kind: 'route' as const, position: 0, name, line: encodePolyline([from, to]), distanceM: km * 1000, points: 2, startedAt: leaves, features: [] };
  return { id: ++ids, folderId: 1, name, createdAt: '', waypoints: 0, creator: null, exportedAt: null, items: [item], media: [] };
}

/** Where the rides of this Stash usually leave from. */
const FROM_HOME: LngLat[] = [HOME, HOME, HOME];

/** The days as their dates and the names of their files. */
const days = (files: StashFile[]) => daysOf(files, FROM_HOME).map((day) => [day.date, day.files.map((f) => f.name)]);

describe('the days the files of a folder make', () => {
  it('are one day for the legs of a ride, along the line they form from home and not by name', () => {
    const legs = [file('Lakeside ride', CAVE, HOME, 90), file('Lakeside ride (362)', HOME, LAKE, 60), file('Lakeside ride (363)', LAKE, CAVE, 45)];
    expect(days(legs)).toEqual([[null, ['Lakeside ride (362)', 'Lakeside ride (363)', 'Lakeside ride']]]);
  });

  it('are another day once a day would go beyond a day’s ride, or the next file starts elsewhere', () => {
    expect(days([file('Opening - there', HOME, LAKE, 310), file('Opening - back', LAKE, HOME, 320)])).toEqual([[null, ['Opening - there']], [null, ['Opening - back']]]);
    expect(days([file('Round 1', PASS, PASS, 120), file('Round 2', PASS, PASS, 130)])).toEqual([[null, ['Round 1']], [null, ['Round 2']]]);
  });

  it('are a day per date the files are planned for, by date and by the time they leave, the undated after them', () => {
    const planned = [
      file('Citadel', CAVE, HOME, 89, '2024-09-08T12:30:00Z'),
      file('Citadel (591)', HOME, LAKE, 129, '2024-09-08T06:00:00Z'),
      file('Citadel (592)', LAKE, CAVE, 16, '2024-09-08T09:00:00Z'),
    ];
    expect(days(planned)).toEqual([['2024-09-08', ['Citadel (591)', 'Citadel (592)', 'Citadel']]]);
    const mixed = [file('Variant', LAKE, CAVE, 91), file('Back', CAVE, HOME, 387, '2022-07-03T07:00:00Z'), file('2022-07-01 There', HOME, LAKE, 99)];
    expect(days(mixed)).toEqual([['2022-07-01', ['2022-07-01 There']], ['2022-07-03', ['Back']], [null, ['Variant']]]);
  });

  it('keep the days a name numbers apart, however short, and the parts of one numbered day together', () => {
    const tour = [file('Coast (Tag 2)', LAKE, CAVE, 235), file('Coast (Tag 1)', HOME, LAKE, 120), file('Coast (Tag 3)', CAVE, PASS, 139)];
    expect(days(tour).map(([, names]) => names)).toEqual([['Coast (Tag 1)'], ['Coast (Tag 2)'], ['Coast (Tag 3)']]);
    const parts = [file('Tag 1_ Home to the lake', HOME, LAKE, 380), file('Tag 2 - Part 1', LAKE, CAVE, 300), file('Tag 2 - Part 2', CAVE, PASS, 225)];
    expect(days(parts).map(([, names]) => names)).toEqual([['Tag 1_ Home to the lake'], ['Tag 2 - Part 1', 'Tag 2 - Part 2']]);
  });

  it('take a round ridden from where the line stands before the file that leads on', () => {
    const tour = [file('Hills', LAKE, CAVE, 168), file('Hills (389)', HOME, LAKE, 161), file('Hills (391)', LAKE, LAKE, 203)];
    expect(daysOf(tour).flatMap((day) => day.files.map((f) => f.name))).toEqual(['Hills (389)', 'Hills (391)', 'Hills']);
  });

  it('go by name where the lines do not say: with several days leaving from one hotel', () => {
    const tour = [file('Alps 01 Arrival', HOME, PASS, 410), file('Alps 03 West', PASS, PASS, 280), file('Alps 02 East', PASS, PASS, 300), file('Alps 04 Home', PASS, HOME, 400)];
    expect(daysOf(tour).flatMap((day) => day.files.map((f) => f.name))).toEqual(['Alps 01 Arrival', 'Alps 02 East', 'Alps 03 West', 'Alps 04 Home']);
  });
});

describe('the trips copied folders and files of the Stash make', () => {
  const folder = (name: string, files: StashFile[], folders: CopiedFolder[] = []): CopiedFolder => ({ name, files, folders });
  /** The plan as its trips: the folders each goes into, its name, and its days as their date, name and files' names. */
  const planned = (folders: CopiedFolder[], loose: StashFile[] = []) => {
    const { files, plan } = planStashTrips(folders, loose, FROM_HOME);
    return plan.map((trip) => [trip.folders, trip.name, trip.days.map((day) => [day.date, day.name, day.files.map((i) => files[i]!.name)])]);
  };

  it('are a trip of a folder of files, its legs on one day and a single file naming its day', () => {
    const ride = folder('Lakeside ride', [file('Lakeside ride (362)', HOME, LAKE, 60), file('Lakeside ride', LAKE, HOME, 90)]);
    const tour = folder('2024-06-29 Harz', [file('There', HOME, PASS, 410), file('Back', PASS, HOME, 400)]);
    expect(planned([ride, tour])).toEqual([
      [[], 'Lakeside ride', [[null, '', ['Lakeside ride (362)', 'Lakeside ride']]]],
      [[], 'Harz', [[null, 'There', ['There']], [null, 'Back', ['Back']]]],
    ]);
  });

  it('are a folder of trips of a folder that holds folders, each of its own files a trip of one day', () => {
    const year = folder('2022', [file('2022-05-01 May ride', HOME, HOME, 200)], [folder('Coast', [file('Coast (Tag 1)', HOME, LAKE, 120)]), folder('Empty', [])]);
    expect(planned([year])).toEqual([
      [['2022'], 'May ride', [['2022-05-01', '', ['2022-05-01 May ride']]]],
      [['2022'], 'Coast', [[null, 'Coast (Tag 1)', ['Coast (Tag 1)']]]],
    ]);
  });

  it('are a trip of one day of each copied file, dated by its name or by when it is planned to leave', () => {
    expect(planned([], [file('Evening lap', HOME, HOME, 80, '2024-07-14T16:00:00Z')])).toEqual([[[], 'Evening lap', [['2024-07-14', '', ['Evening lap']]]]]);
  });
});

describe('planStashDays', () => {
  it('plans the days of a trip that is there already, each naming its files by their place among those given', () => {
    const out = file('Out', HOME, LAKE, 120, '2026-07-02T07:00:00Z');
    const back = file('Back', LAKE, HOME, 120, '2026-07-03T07:00:00Z');
    const loose = file('Loose', CAVE, PASS, 90);
    expect(planStashDays([loose, back, out], FROM_HOME)).toEqual([
      { date: '2026-07-02', name: 'Out', files: [2], media: [] },
      { date: '2026-07-03', name: 'Back', files: [1], media: [] },
      { date: null, name: 'Loose', files: [0], media: [] },
    ]);
  });
});
