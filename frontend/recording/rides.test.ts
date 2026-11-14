import { describe, expect, it } from 'vitest';
import { ridingYears, type Ride } from './rides';

const ride = (id: number, startedAt: string | null, km: number): Ride => ({ id, tripId: 1, dayId: 'd', name: `Ride ${id}`, startedAt, distanceM: km * 1000, line: '' });
/** The date a moment falls on in UTC, so that the test holds wherever it runs. */
const utc = (iso: string) => iso.slice(0, 10);

describe('the rides by when they were ridden', () => {
  const rides = [ride(1, '2025-07-08T08:00:00Z', 20), ride(2, '2026-11-14T13:00:00Z', 40), ride(3, '2026-11-14T08:00:00Z', 42), ride(4, '2026-11-01T09:00:00Z', 80), ride(5, '2026-10-23T09:00:00Z', 41), ride(6, null, 10)];

  it('are grouped into days of riding, the latest day first and a day\'s rides in the order they began', () => {
    const [year] = ridingYears(rides, utc);
    expect(year!.months[0]!.days.map((day) => [day.date, day.rides.map((r) => r.id), day.distanceM])).toEqual([
      ['2026-11-14', [3, 2], 82_000],
      ['2026-11-01', [4], 80_000],
    ]);
  });

  it('add up by month and by year, with the days ridden on', () => {
    const years = ridingYears(rides, utc);
    expect(years.map((year) => [year.year, year.days, year.distanceM, year.months.map((month) => [month.month, month.distanceM])])).toEqual([
      ['2026', 3, 203_000, [['2026-11', 162_000], ['2026-10', 41_000]]],
      ['2025', 1, 20_000, [['2025-07', 20_000]]],
    ]);
  });

  it('leave out a ride that tells no time', () => {
    expect(ridingYears([ride(6, null, 10)], utc)).toEqual([]);
  });

  it('take the date where the browser is', () => {
    const [year] = ridingYears([ride(1, '2026-06-15T12:00:00Z', 5)]);
    expect(year!.months[0]!.days[0]!.date).toBe('2026-06-15');
  });
});
