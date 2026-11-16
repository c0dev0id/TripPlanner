import { describe, expect, it } from 'vitest';
import { dateIn, mediaBeside, pickedPath, planFolderImport, type ImportMode } from './folderImport';

/** The plan with each day as its date, name and file names, and the names of its media where it has any; trips planned per folder unless the mode says otherwise. */
const plan = (paths: string[], mode: ImportMode = 'trips') => {
  const names = (files: number[]) => files.map((i) => paths[i]!.split('/').at(-1));
  return planFolderImport(paths, mode).map(({ media, ...t }) => ({ ...t, ...(media.length > 0 ? { media: names(media) } : {}), days: t.days.map((d) => [d.date, d.name, names(d.files)]) }));
};

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

  it('takes a folder that also holds folders of GPX files for a folder of trips: a trip of each of its own files', () => {
    expect(plan(['Tours/b.gpx', 'Tours/2024-05-01 a.gpx', 'Tours/Alps/one.gpx', 'Tours/Alps/two.gpx', 'Tours/Alps/photos/x.jpg', 'Tours/Deep/Down/z.gpx'])).toEqual([
      { folders: ['Tours'], name: 'a', days: [['2024-05-01', '', ['2024-05-01 a.gpx']]] },
      { folders: ['Tours'], name: 'b', days: [[null, '', ['b.gpx']]] },
      { folders: ['Tours'], name: 'Alps', days: [[null, 'one', ['one.gpx']], [null, 'two', ['two.gpx']]] },
      { folders: ['Tours', 'Deep'], name: 'Down', days: [[null, 'z', ['z.gpx']]] },
    ]);
    expect(plan(['loose.gpx', 'Alps/one.gpx']).map((t) => [t.folders, t.name])).toEqual([[[], 'loose'], [[], 'Alps']]);
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

  it('fits the names of folders, trips and days to what the library holds', () => {
    const long = 'Ü'.repeat(250);
    const [trip] = plan([`${long}/Rides  of\tsummer/${long}.gpx`]);
    expect([trip!.folders[0]!.length, trip!.name, (trip!.days[0]![1] as string).length]).toEqual([200, 'Rides of summer', 200]);
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

describe('the other files of a folder', () => {
  it('are the media of the trip the folder makes, hidden ones left out', () => {
    const paths = ['Alps/day 1.gpx', 'Alps/ferry.pdf', 'Alps/.DS_Store', 'Alps/Roadbook.docx', 'Alps/day 2.gpx'];
    expect(plan(paths)[0]!.media).toEqual(['ferry.pdf', 'Roadbook.docx']);
  });

  it('stay with the folder they are in', () => {
    const made = plan(['Tours/Alps/a.gpx', 'Tours/Alps/alps.pdf', 'Tours/Vosges/b.gpx', 'Tours/readme.txt']);
    expect(made.map((c) => [c.name, c.media])).toEqual([['Alps', ['alps.pdf']], ['Vosges', undefined]]);
  });

  it('are left out beside trips made a file each', () => {
    expect(plan(['a.gpx', 'ticket.pdf'], 'trip-per-file').map((t) => t.media)).toEqual([undefined]);
    expect(plan(['Tours/a.gpx', 'Tours/ticket.pdf', 'Tours/Alps/b.gpx']).map((t) => t.media)).toEqual([undefined, undefined]);
  });
});

describe('files of routes', () => {
  it('are GPX, KML and KMZ files alike, and none of them is media', () => {
    const paths = ['Alps/day 1.gpx', 'Alps/day 2.KML', 'Alps/day 3.kmz', 'Alps/ferry.pdf', 'Alps/.hidden.kml'];
    const [trip] = plan(paths);
    expect(trip!.days.map((day) => day[1])).toEqual(['day 1', 'day 2', 'day 3']);
    expect(trip!.media).toEqual(['ferry.pdf']);
  });
});

describe('the media that lie beside a file of routes', () => {
  /** Each file of routes with the media that are its own, by name, and the names of every file spoken for. */
  const beside = (paths: string[]) => {
    const { of, taken } = mediaBeside(paths);
    return { of: Object.fromEntries([...of].map(([route, media]) => [paths[route]!, media.map((i) => paths[i]!)])), taken: [...taken].map((i) => paths[i]!) };
  };

  it('are the files of a folder named as the file is, with or without " (media)", but not the list an app wrote there', () => {
    const paths = ['2016/Lake.gpx', '2016/Lake (media)/Photo 1.jpg', '2016/Lake (media)/media.json', '2016/Cave.gpx', '2016/Cave/roadbook.pdf', '2016/Other/x.jpg'];
    expect(beside(paths)).toEqual({
      of: { '2016/Lake.gpx': ['2016/Lake (media)/Photo 1.jpg'], '2016/Cave.gpx': ['2016/Cave/roadbook.pdf'] },
      taken: ['2016/Lake (media)/Photo 1.jpg', '2016/Lake (media)/media.json', '2016/Cave/roadbook.pdf'],
    });
  });

  it('are the files beside it whose names begin with its name, the longer name taking what fits two', () => {
    const paths = ['Harz.gpx', 'Harz round.gpx', 'Harz.png', 'Harz round 1.jpg', 'Harz-2.jpg', 'Harzer.jpg', 'ticket.pdf', 'sub/Harz 3.jpg'];
    expect(beside(paths).of).toEqual({ 'Harz.gpx': ['Harz.png', 'Harz-2.jpg'], 'Harz round.gpx': ['Harz round 1.jpg'] });
  });

  it('are found at the top as in folders, and never among files of routes or hidden files', () => {
    expect(beside(['Lake.gpx', 'Lake (media)/a.jpg', 'Lake (media)/.DS_Store', 'Lake (media)/b.kml']).of).toEqual({ 'Lake.gpx': ['Lake (media)/a.jpg'] });
  });

  it('are kept with the day their file makes, and not with the trip of the folder', () => {
    const paths = ['Alps/1 Arrival.gpx', 'Alps/1 Arrival (media)/hotel.jpg', 'Alps/2 Passes.gpx', 'Alps/ferry.pdf'];
    const [trip] = planFolderImport(paths, 'trips');
    expect(trip!.days.map((day) => day.media.map((i) => paths[i]))).toEqual([['Alps/1 Arrival (media)/hotel.jpg'], []]);
    expect(trip!.media.map((i) => paths[i])).toEqual(['Alps/ferry.pdf']);
    const perFile = planFolderImport(['Lake.gpx', 'Lake (media)/a.jpg'], 'trip-per-file');
    expect(perFile.map((t) => [t.name, t.days[0]!.media])).toEqual([['Lake', [1]]]);
  });
});
