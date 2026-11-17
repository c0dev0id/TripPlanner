import type { Trip } from './trip';

/** What a trip's public page shows besides the plan. */
export interface Publication {
  /** Whether the journal is on it. */
  journal: boolean;
  /** Whether it offers the trip as a GPX file. */
  gpx: boolean;
  /** The journal entry whose photo stands at its top. */
  coverEntryId: number | null;
}

/** A trip as its read-only page reads it: with its publication where the page is the shared one. */
export type ViewedTrip = Trip & { public?: Publication };
