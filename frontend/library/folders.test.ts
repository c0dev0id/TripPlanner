import { describe, expect, it } from 'vitest';
import type { TripSummary } from '../model/trip';
import { folderPath, heldCounts, heldInAll } from './folders';

const folders = [
  { id: 1, name: 'Rides', parentId: null },
  { id: 2, name: '2023', parentId: 1 },
  { id: 3, name: 'Alps', parentId: 2 },
];

describe('folderPath', () => {
  it('names the folders from the top down to the folder', () => {
    expect(folderPath(folders, 3)).toBe('Rides / 2023 / Alps');
    expect(folderPath(folders, 1)).toBe('Rides');
    expect(folderPath(folders, null)).toBe('');
  });
});

describe('heldCounts', () => {
  it('counts the folders and trips each folder holds itself, none for an empty one', () => {
    const trip = (folderId: number | null) => ({ folderId }) as TripSummary;
    const held = heldCounts(folders, [trip(1), trip(1), trip(3), trip(null)]);
    expect([held(1), held(2), held(3), held(null)]).toEqual([
      { folders: 1, trips: 2 },
      { folders: 1, trips: 0 },
      { folders: 0, trips: 1 },
      { folders: 1, trips: 1 },
    ]);
  });
});

describe('heldInAll', () => {
  it('counts what a folder holds at any depth', () => {
    const trip = (folderId: number | null) => ({ folderId }) as TripSummary;
    const trips = [trip(1), trip(2), trip(3), trip(3), trip(null)];
    const held = heldCounts(folders, trips);
    expect([heldInAll(folders, held, 1), heldInAll(folders, held, 2), heldInAll(folders, held, 3)]).toEqual([
      { folders: 2, trips: 4 },
      { folders: 1, trips: 3 },
      { folders: 0, trips: 2 },
    ]);
  });
});
