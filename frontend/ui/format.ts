/** A distance in metres as text: metres below a kilometre, a decimal below 100 km, whole kilometres above. */
export function distanceText(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  const km = metres / 1000;
  return km < 100 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/** A date as YYYY-MM-DD in the browser's language, or the text itself where it is no date. */
export function dateText(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
