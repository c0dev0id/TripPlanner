import { createEffect, createMemo, createResource, createRoot, createSignal } from 'solid-js';
import { fetchStashGpx } from '../api';
import { parseGpx } from '../gpx/gpx';
import { ROUTE_PALETTE } from '../model/routeLook';
import type { StashFile, StashItem } from '../model/stash';
import type { LngLat } from '../model/trip';
import { showWhole } from './drawing';

/** What of the Stash the map shows: a file whole, or one route or track of it. */
export interface ShownStash {
  fileId: number;
  item?: Pick<StashItem, 'kind' | 'position'>;
}

const [shown, setShown] = createSignal<ShownStash>();

/** How often files of the Stash were rewritten: the file shown is read again after each time. */
const [edits, setEdits] = createSignal(0);

/** Says that a file of the Stash was rewritten. */
export const stashEdited = (): void => void setEdits(edits() + 1);

/** What of the Stash the map shows; nothing until a file or one of its routes or tracks is picked. */
export const shownInStash = shown;

/** Shows a file of the Stash on the map, or one route or track of it, or takes off what is shown. */
export const showInStash = (to: ShownStash | undefined): void => void setShown(to);

/** Whether the item is the one route or track shown alone. */
export const isShownItem = (fileId: number, item: Pick<StashItem, 'kind' | 'position'>): boolean =>
  shown()?.fileId === fileId && shown()!.item?.kind === item.kind && shown()!.item?.position === item.position;

/** The colour a file's route or track is drawn in: the palette's at its place among the file's routes and tracks, which starts over where the palette ends. */
export const stashColor = (file: StashFile, item: StashItem): string => ROUTE_PALETTE[file.items.indexOf(item) % ROUTE_PALETTE.length]!.color;

const stash = createRoot(() => {
  /** The file shown as it is read, with the file it is of: fetched when it is picked and again once it was rewritten, not when another of its lines is. */
  const [read] = createResource(
    () => shown() && `${shown()!.fileId}:${edits()}`,
    async (key) => {
      const fileId = Number(key.split(':')[0]);
      return { fileId, content: parseGpx(await fetchStashGpx(fileId)) };
    },
  );
  /** The routes, by their points and the ways between them, and the tracks of the file shown, in the order the file is listed in; none until it is read. */
  const all = createMemo(() => {
    const file = read.error ? undefined : read.latest;
    if (!file || file.fileId !== shown()?.fileId) return undefined;
    const routes = file.content.routes.map((route, position) => ({ kind: 'route' as const, position, points: route.points.flatMap((point, i) => [point, ...(route.ways[i] ?? [])]) }));
    const tracks = file.content.tracks.map((track, position) => ({ kind: 'track' as const, position, points: track.segments.flat() }));
    return { lines: [...routes, ...tracks], waypoints: file.content.waypoints.map((waypoint) => waypoint.lngLat) };
  });
  /** The lines drawn: every route and track of the file, or the one shown alone, each in the colour its row has. */
  const lines = createMemo(() => {
    const only = shown()?.item;
    return (all()?.lines ?? [])
      .map((line, i) => ({ ...line, id: i, color: ROUTE_PALETTE[i % ROUTE_PALETTE.length]!.color }))
      .filter((line) => line.points.length > 1 && (!only || (line.kind === only.kind && line.position === only.position)));
  });
  /** The file's waypoints, drawn with the file whole. */
  const waypoints = createMemo((): LngLat[] => (shown()?.item ? [] : (all()?.waypoints ?? [])));
  // What is shown is brought into view.
  createEffect(() => {
    const points = [...lines().flatMap((line) => line.points), ...waypoints()];
    if (points.length > 0) showWhole(points);
  });
  return { lines, waypoints, failed: () => (read.error ? (read.error as unknown) : undefined) };
});

/** The lines of the Stash on the map, and the waypoints of a file shown whole. */
export const stashLines = stash.lines;
export const stashWaypoints = stash.waypoints;

/** Why the file shown could not be read; nothing while it can. */
export const stashProblem = stash.failed;
