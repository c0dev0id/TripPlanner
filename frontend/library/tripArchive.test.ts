import { describe, expect, it } from 'vitest';
import { archiveFolders, inFolders } from './tripArchive';

describe('archiveFolders', () => {
  it('finds the folders that hold an exported trip', () => {
    const folders = archiveFolders(['export/Alps/trip.json', 'export/Alps/Day-1.gpx', 'export/Alps/journal/3-a.jpg', 'export/loose.gpx', 'export/trip.json.txt']);
    expect(folders).toEqual(['export/Alps']);
    expect(inFolders('export/Alps/recordings/1-ride.gpx', folders)).toBe(true);
    expect(inFolders('export/Alps 2/ride.gpx', folders)).toBe(false);
    expect(inFolders('export/loose.gpx', folders)).toBe(false);
  });

  it('takes the folder picked itself for one', () => {
    expect(archiveFolders(['trip.json', 'Day-1.gpx'])).toEqual(['']);
    expect(inFolders('Day-1.gpx', [''])).toBe(true);
  });
});
