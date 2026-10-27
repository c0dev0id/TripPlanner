/** A distance in metres as text: metres below a kilometre, a decimal below 100 km, whole kilometres above. */
export function distanceText(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  const km = metres / 1000;
  return km < 100 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

const LONG_DATE = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const SHORT_DATE = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/** A date as YYYY-MM-DD, read as the browser's local midnight; the text itself where it is no date. */
function formatDate(iso: string, format: Intl.DateTimeFormat): string {
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? iso : format.format(date);
}

/** A date in the browser's language with its year: "Sat, 13 Jun 2027". */
export const dateText = (iso: string): string => formatDate(iso, LONG_DATE);

/** A date in the browser's language as weekday, day and month: "Sat, 13 Jun". */
export const shortDateText = (iso: string): string => formatDate(iso, SHORT_DATE);

const TAKEN_AT = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** When a photo was taken, as the camera wrote it (YYYY-MM-DDTHH:MM:SS, no zone): "Sat, 13 Jun, 14:30". */
export function takenAtText(local: string): string {
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? local : TAKEN_AT.format(date);
}

/** Minutes since midnight as HH:MM; past midnight with the days after it, as "+1". */
export function timeText(minutes: number): string {
  const whole = Math.round(minutes);
  const days = Math.floor(whole / 1440);
  const inDay = whole - days * 1440;
  const text = `${String(Math.floor(inDay / 60)).padStart(2, '0')}:${String(inDay % 60).padStart(2, '0')}`;
  return days > 0 ? `${text} +${days}` : text;
}

/** A duration in seconds as hours and minutes: "3 h 40 min", "45 min". */
export function durationText(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours === 0) return `${minutes} min`;
  return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`;
}
