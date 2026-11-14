/** The rides: every recording the user keeps, looked at by when it was ridden instead of by the plans it followed. */

/** A ride: a recording with its line as polyline6 and the days it is on, each with the trip or collection it is in. */
export interface Ride {
  id: number;
  name: string;
  /** When its first point was recorded, as ISO 8601 with its zone; null for a file without times. */
  startedAt: string | null;
  distanceM: number;
  line: string;
  days: { tripId: number; dayId: string; trip: string }[];
}

/** A day of riding: the rides that began on one date, the earliest first. A tracker starts a new file after a break, so a day is often several. */
export interface RidingDay {
  /** As YYYY-MM-DD. */
  date: string;
  rides: Ride[];
  distanceM: number;
}

export interface RidingMonth {
  /** As YYYY-MM. */
  month: string;
  days: RidingDay[];
  distanceM: number;
}

export interface RidingYear {
  year: string;
  months: RidingMonth[];
  /** How many days were ridden on. */
  days: number;
  distanceM: number;
}

/** The date a moment falls on where the browser is, as YYYY-MM-DD. */
export function localDate(iso: string): string {
  const at = new Date(iso);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`;
}

const length = (of: readonly { distanceM: number }[]): number => of.reduce((sum, part) => sum + part.distanceM, 0);

/** The days, which are in order, in runs that share the first `chars` of their date: a month's, or a year's. */
function runs(days: readonly RidingDay[], chars: number): RidingDay[][] {
  const groups: RidingDay[][] = [];
  for (const day of days) {
    const last = groups.at(-1);
    if (last && last[0]!.date.slice(0, chars) === day.date.slice(0, chars)) last.push(day);
    else groups.push([day]);
  }
  return groups;
}

/** The rides that tell when they began, by year, month and day of riding, the latest first; `dateOf` says which date a moment falls on. */
export function ridingYears(rides: readonly Ride[], dateOf: (iso: string) => string = localDate): RidingYear[] {
  const byDate = new Map<string, Ride[]>();
  for (const ride of rides) {
    if (ride.startedAt === null) continue;
    const date = dateOf(ride.startedAt);
    if (byDate.has(date)) byDate.get(date)!.push(ride);
    else byDate.set(date, [ride]);
  }
  const days = [...byDate]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, of]): RidingDay => ({ date, rides: of.sort((a, b) => a.startedAt!.localeCompare(b.startedAt!)), distanceM: length(of) }));
  const months = runs(days, 7).map((of): RidingMonth => ({ month: of[0]!.date.slice(0, 7), days: of, distanceM: length(of) }));
  return runs(days, 4).map((of): RidingYear => {
    const year = of[0]!.date.slice(0, 4);
    return { year, months: months.filter((month) => month.month.startsWith(year)), days: of.length, distanceM: length(of) };
  });
}
