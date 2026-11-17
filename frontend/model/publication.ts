import type { Trip } from './trip';

/** What a trip's page shows besides the plan, as the page is told. */
export interface Shown {
  /** Whether the journal is on it. */
  journal: boolean;
  /** Whether it offers its routes and tracks as GPX files. */
  gpx: boolean;
  /** The journal entry whose photo stands at its top. */
  coverEntryId: number | null;
}

/** What the owner sets of a trip's public page. */
export interface Publication extends Shown {
  /** The routes and tracks the page leaves out: neither on its map nor among its GPX files. */
  hiddenRouteIds: string[];
}

/** A trip as its read-only page reads it: with what the page shows where it is the shared one, or the owner's look at it. */
export type ViewedTrip = Trip & { public?: Shown };
