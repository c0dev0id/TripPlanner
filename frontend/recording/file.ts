import type { RecordedTrack } from './track';

/** What a recording's file is like, apart from the ride: enough to tell which of two recordings of one ride is the better one. */
export interface FileFacts {
  /** What wrote the file, as the file says. */
  creator?: string;
  points: number;
  segments: number;
  /** The usual time between two points, in seconds: the median, where the points have times. */
  intervalS?: number;
  /** The metres from one point to the next on average. */
  spacingM?: number;
  /** What the file tells of a point beside its position, by the names it has there, each with the share of the points that have it. */
  values: { name: string; share: number }[];
}

/** The facts of a recording's file; `distanceM` is how far the track went. */
export function fileFacts(track: RecordedTrack, distanceM: number): FileFacts {
  const points = track.points.length;
  const times = (track.series.time ?? []).filter((time) => time !== null);
  const steps = times.slice(1).map((time, i) => (time - times[i]!) / 1000).sort((a, b) => a - b);
  return {
    creator: track.creator,
    points,
    segments: track.segments,
    intervalS: steps.length > 0 ? steps[Math.floor(steps.length / 2)] : undefined,
    spacingM: points > 1 ? distanceM / (points - 1) : undefined,
    values: Object.entries(track.series).map(([name, values]) => ({ name, share: values.filter((value) => value !== null).length / points })),
  };
}
