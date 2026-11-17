import type { EntryFile } from './journal';
/**
 * What a route or a track of the Stash carries that its row would not show otherwise:
 * times, elevation, lean angles or accelerations on its points, however its file writes
 * them, Garmin's extension of a route and of its points, its trip planning, and what DMD or Rumo wrote into it.
 */
export type StashFeature = 'time' | 'elevation' | 'lean' | 'acceleration' | 'routeExtension' | 'routePointExtension' | 'tripExtension' | 'dmd' | 'rumo';

/** A route or a track of a file of the Stash, as it was read from the file: its place among the file's routes or tracks, its line thinned, as polyline6, its length, its points, when it starts where the file says (a track's first point, a route's planned departure), and what it carries besides. */
export interface StashItem {
  kind: 'route' | 'track';
  position: number;
  name: string;
  line: string;
  distanceM: number;
  points: number;
  startedAt: string | null;
  features: StashFeature[];
}

/** A media file kept with a file of the Stash, as a kept file is described: its name, its type, its size, and whether it is an image that has a preview. */
export interface StashMedia extends EntryFile {
  id: number;
}

/** A file of the Stash: a GPX file kept whole in a folder there, with how many waypoints it holds, what wrote it and when, as its head says, its routes and tracks in the file's order, and the media kept with it, by name. */
export interface StashFile {
  id: number;
  folderId: number;
  name: string;
  createdAt: string;
  waypoints: number;
  creator: string | null;
  exportedAt: string | null;
  items: StashItem[];
  media: StashMedia[];
}

/** What is taken of a file of the Stash: routes and tracks of it, whether its waypoints, which go all together, and whether its media, which do too. */
export interface StashPart {
  file: StashFile;
  items: StashItem[];
  waypoints: boolean;
  media: boolean;
}

/** A folder of the Stash as it was copied: its name, the files it holds itself and the folders in it. */
export interface CopiedFolder {
  name: string;
  files: StashFile[];
  folders: CopiedFolder[];
}
