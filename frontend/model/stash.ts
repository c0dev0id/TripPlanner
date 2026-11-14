/** A route or a track of a file of the Stash, as it was read from the file: its place among the file's routes or tracks, its line thinned, as polyline6, its length, its points and, of a track with times, when it began. */
export interface StashItem {
  kind: 'route' | 'track';
  position: number;
  name: string;
  line: string;
  distanceM: number;
  points: number;
  startedAt: string | null;
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
