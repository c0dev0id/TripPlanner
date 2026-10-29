import { describe, expect, it } from 'vitest';
import { counted, folderPath } from './folders';

describe('folderPath', () => {
  const folders = [
    { id: 1, name: 'Rides', parentId: null },
    { id: 2, name: '2023', parentId: 1 },
    { id: 3, name: 'Alps', parentId: 2 },
  ];

  it('names the folders from the top down to the folder', () => {
    expect(folderPath(folders, 3)).toBe('Rides / 2023 / Alps');
    expect(folderPath(folders, 1)).toBe('Rides');
    expect(folderPath(folders, null)).toBe('');
  });
});

describe('counted', () => {
  it('says one thing and several things', () => {
    expect([counted(1, 'trip'), counted(0, 'trip'), counted(2, 'folder')]).toEqual(['1 trip', '0 trips', '2 folders']);
  });
});
