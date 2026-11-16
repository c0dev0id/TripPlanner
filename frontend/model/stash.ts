/**
 * What a route or a track of the Stash carries that its row would not show otherwise:
 * times, elevation, lean angles or accelerations on its points, however its file writes
 * them, Garmin's extension of a route and of its points, and what DMD or Rumo wrote into it.
 */
export type StashFeature = 'time' | 'elevation' | 'lean' | 'acceleration' | 'routeExtension' | 'routePointExtension' | 'dmd' | 'rumo';

/** A route or a track of a file of the Stash, as it was read from the file: its place among the file's routes or tracks, its line thinned, as polyline6, its length, its points, of a track with times, when it began, and what it carries besides. */
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

/** A file of the Stash: a GPX file kept whole in a folder there, with how many waypoints it holds and its routes and tracks in the file's order. */
export interface StashFile {
  id: number;
  folderId: number;
  name: string;
  createdAt: string;
  waypoints: number;
  items: StashItem[];
}

/** What is taken of a file of the Stash: routes and tracks of it, and whether its waypoints, which go all together. */
export interface StashPart {
  file: StashFile;
  items: StashItem[];
  waypoints: boolean;
}
