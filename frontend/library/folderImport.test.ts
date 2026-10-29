import { describe, expect, it } from 'vitest';
import { dateIn, pickedPath, planFolderImport, type ImportMode } from './folderImport';

/** The plan with each day as its date, name and file names; trips planned per folder unless the mode says otherwise. */
const plan = (paths: string[], mode: ImportMode = 'trip-per-folder') =>
  planFolderImport(paths, mode).map(({ kind, ...t }) => ({ ...(kind === 'trip' ? {} : { kind }), ...t, days: t.days.map((d) => [d.date, d.name, d.files.map((i) => paths[i]!.split('/').at(-1))]) }));

describe('pickedPath', () => {
  it('composes a name macOS wrote decomposed', () => {
    expect(pickedPath(new File([''], 'MFRN Rho\u0308ntour.gpx'))).toBe('MFRN Rh\u00f6ntour.gpx');
  });
});

describe('dateIn', () => {
  it('finds the first real date written as YYYY-MM-DD', () => {
    expect(dateIn('Alps 2024-06-12 to 2024-06-20')).toBe('2024-06-12');
    expect(dateIn('2024-02-30 nope, 2024-02-29 yes')).toBe('2024-02-29');
    expect(dateIn('Alps')).toBeUndefined();
  });

  it('reads YYYYMMDD at the start of a name and YYYY_MM_DD anywhere, as YYYY-MM-DD', () => {
    expect(dateIn('20240612 Alps')).toBe('2024-06-12');
    expect(dateIn('20240612')).toBe('2024-06-12');
    expect(dateIn('Pass 2024_06_13')).toBe('2024-06-13');
    expect(dateIn('Alps 20240612')).toBeUndefined();
    expect(dateIn('202406123 Alps')).toBeUndefined();
    expect(dateIn('2024-06_12')).toBeUndefined();
    expect(dateIn('20241399 then 2024_06_14')).toBe('2024-06-14');
  });
});

describe('planFolderImport', () => {
  it('makes a trip of each folder that holds GPX files, inside the folders above it', () => {
    expect(plan(['Rides/2023/Alps/one.gpx', 'Rides/2023/Alps/two.GPX', 'Rides/2023/notes.txt', 'Rides/Lonely/.hidden.gpx', 'Rides/Scotland/a.gpx'])).toEqual([
      { folders: ['Rides', '2023'], name: 'Alps', days: [[null, 'one', ['one.gpx']], [null, 'two', ['two.GPX']]] },
      { folders: ['Rides'], name: 'Scotland', days: [[null, 'a', ['a.gpx']]] },
    ]);
  });

  it('groups dated files into a day per date, in date order', () => {
    expect(plan(['Alps/2024-06-13 pass.gpx', 'Alps/2024-06-12 b.gpx', 'Alps/2024-06-12 a.gpx'])[0]!.days).toEqual([
      ['2024-06-12', '', ['2024-06-12 a.gpx', '2024-06-12 b.gpx']],
      ['2024-06-13', 'pass', ['2024-06-13 pass.gpx']],
    ]);
  });

  it("dates undated files on from the folder's date, after the dated days, a day each", () => {
    expect(plan(['2024-06-12 Alps/day 2.gpx', '2024-06-12 Alps/day 10.gpx', '2024-06-12 Alps/day 1.gpx'])[0]).toEqual({
      folders: [],
      name: 'Alps',
      days: [
        ['2024-06-12', 'day 1', ['day 1.gpx']],
        ['2024-06-13', 'day 2', ['day 2.gpx']],
        ['2024-06-14', 'day 10', ['day 10.gpx']],
      ],
    });
    expect(plan(['Alps_2024-06-12/2024-06-14.gpx', 'Alps_2024-06-12/extra.gpx'])[0]!.days).toEqual([
      ['2024-06-14', '', ['2024-06-14.gpx']],
      ['2024-06-15', 'extra', ['extra.gpx']],
    ]);
  });

  it('takes the dates of names written YYYYMMDD or YYYY_MM_DD, and leaves them out of the names', () => {
    expect(plan(['20240612_Alps/2024_06_13_pass.gpx', '20240612_Alps/day.gpx'])[0]).toEqual({
      folders: [],
      name: 'Alps',
      days: [
        ['2024-06-13', 'pass', ['2024_06_13_pass.gpx']],
        ['2024-06-14', 'day', ['day.gpx']],
      ],
    });
  });

  it('keeps undated files of an undated folder undated, after the dated days', () => {
    expect(plan(['Alps/b.gpx', 'Alps/2024-06-12.gpx'])[0]!.days).toEqual([
      ['2024-06-12', '', ['2024-06-12.gpx']],
      [null, 'b', ['b.gpx']],
    ]);
  });

  it('names a trip after its whole folder where the date is all there is, and finds none without GPX files', () => {
    expect(plan(['2024-06-12/a.gpx'])[0]!.name).toBe('2024-06-12');
    expect(plan(['Alps/readme.md'])).toEqual([]);
  });
});

describe('planFolderImport, a trip per file', () => {
  it('makes a trip of one day of each file, named and dated by it, in the folders it is in', () => {
    expect(plan(['Rides/2023/2023-06-12 Pass.gpx', 'Rides/2023/Loop.gpx', 'Rides/Odenwald.gpx'], 'trip-per-file')).toEqual([
      { folders: ['Rides'], name: 'Odenwald', days: [[null, '', ['Odenwald.gpx']]] },
      { folders: ['Rides', '2023'], name: 'Pass', days: [['2023-06-12', '', ['2023-06-12 Pass.gpx']]] },
      { folders: ['Rides', '2023'], name: 'Loop', days: [[null, '', ['Loop.gpx']]] },
    ]);
  });
});

describe('planFolderImport, planning material', () => {
  it('makes a collection of each folder of GPX files, a section of each file, none of them dated', () => {
    expect(plan(['Planning/TET/F.gpx', 'Planning/TET/E.gpx', 'Planning/ACT 2024-06-12/ACT_PT.gpx', 'Planning/ACT 2024-06-12/ACT_IT.gpx'], 'planning-material')).toEqual([
      { kind: 'collection', folders: ['Planning'], name: 'ACT 2024-06-12', days: [[null, 'ACT_IT', ['ACT_IT.gpx']], [null, 'ACT_PT', ['ACT_PT.gpx']]] },
      { kind: 'collection', folders: ['Planning'], name: 'TET', days: [[null, 'E', ['E.gpx']], [null, 'F', ['F.gpx']]] },
    ]);
  });
});
