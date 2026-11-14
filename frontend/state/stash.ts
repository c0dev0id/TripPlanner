import { createEffect, createMemo, createResource, createRoot, createSignal } from 'solid-js';
import { fetchStashGpx, listStash } from '../api';
import { parseGpx } from '../gpx/gpx';
import { paletteColor } from '../model/routeLook';
import type { StashFile, StashItem } from '../model/stash';
import type { LngLat } from '../model/trip';
import { showWhole } from './drawing';

/** What of the Stash the map shows: a file whole, or one route or track of it. */
export interface ShownStash {
  fileId: number;
  item?: Pick<StashItem, 'kind' | 'position'>;
}

const [shown, setShown] = createSignal<ShownStash>();

/** What of the Stash the map shows; nothing until a file or one of its routes or tracks is picked. */
export const shownInStash = shown;

/** Shows a file of the Stash on the map, or one route or track of it, or takes off what is shown. */
export const showInStash = (to: ShownStash | undefined): void => void setShown(to);

/** Whether the map shows the file whole. */
export const isShownWhole = (fileId: number): boolean => shown()?.fileId === fileId && !shown()!.item;

/** Whether the item is the one route or track shown alone. */
export const isShownItem = (fileId: number, item: Pick<StashItem, 'kind' | 'position'>): boolean =>
  shown()?.fileId === fileId && shown()!.item?.kind === item.kind && shown()!.item?.position === item.position;

/** The colour a file's route or track is drawn in: the palette's at its place among the file's routes and tracks. */
export const stashColor = (file: StashFile, item: StashItem): string => paletteColor(file.items.indexOf(item));

const stash = createRoot(() => {
  const [files, { refetch, mutate }] = createResource(listStash);
  /**
   * The file shown as it is listed, by what tells its content apart: the same while the
   * list says the same of it, so that the file is read again once it was rewritten and
   * not when it is listed afresh. None once it is no longer listed.
   */
  const listed = createMemo(
    () => {
      const file = (files.error ? undefined : files.latest)?.find((listed) => listed.id === shown()?.fileId);
      return file && { fileId: file.id, holds: file.items.map((item) => `${item.kind} ${item.points} ${item.name}`).join('\n') };
    },
    undefined,
    { equals: (a, b) => a?.fileId === b?.fileId && a?.holds === b?.holds },
  );
  const [read] = createResource(listed, async ({ fileId }) => ({ fileId, content: parseGpx(await fetchStashGpx(fileId)) }));
  /** The routes, by their points and the ways between them, and the tracks of the file shown, in the order the file is listed in; none until it is read. */
  const all = createMemo(() => {
    const file = read.error ? undefined : read.latest;
    if (!file || file.fileId !== listed()?.fileId) return undefined;
    const routes = file.content.routes.map((route, position) => ({ kind: 'route' as const, position, points: route.points.flatMap((point, i) => [point, ...(route.ways[i] ?? [])]) }));
    const tracks = file.content.tracks.map((track, position) => ({ kind: 'track' as const, position, points: track.segments.flat() }));
    return { lines: [...routes, ...tracks], waypoints: file.content.waypoints.map((waypoint) => waypoint.lngLat) };
  });
  /** The lines drawn: every route and track of the file, or the one shown alone, each in the colour its row has. */
  const lines = createMemo(() => {
    const only = shown()?.item;
    return (all()?.lines ?? [])
      .map((line, i) => ({ ...line, id: i, color: paletteColor(i) }))
      .filter((line) => line.points.length > 1 && (!only || (line.kind === only.kind && line.position === only.position)));
  });
  /** The file's waypoints, drawn with the file whole. */
  const waypoints = createMemo((): LngLat[] => (shown()?.item ? [] : (all()?.waypoints ?? [])));
  // What is shown is brought into view.
  createEffect(() => {
    const points = [...lines().flatMap((line) => line.points), ...waypoints()];
    if (points.length > 0) showWhole(points);
  });
  return { files, refetch, mutate, lines, waypoints, failed: () => (listed() ? (read.error as unknown) : undefined) };
});

/** The files of the Stash as the server last listed them. */
export const stashFiles = stash.files;

/** Lists the Stash's files afresh after they changed. */
export const relistStash = (): void => void stash.refetch();

/** Lists files just kept after those listed, as the server answered with them, until the Stash is listed afresh. */
export const listKeptFiles = (kept: readonly StashFile[]): void => void stash.mutate((files) => [...(files ?? []), ...kept]);

/** The lines of the Stash on the map, and the waypoints of a file shown whole. */
export const stashLines = stash.lines;
export const stashWaypoints = stash.waypoints;

/** Why the file shown could not be read; nothing while it can. */
export const stashProblem = stash.failed;
