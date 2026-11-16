import { distanceBetween } from '../geo/measure';
import type { StashFile } from '../model/stash';
import type { LngLat } from '../model/trip';
import { decodePolyline } from '../routing/polyline';
import { byName } from './folderImport';

/**
 * Which files of a folder of the Stash belong together, as a proposal: the legs of a
 * ride, the days of a tour, the versions of a route. No single clue says it, so two
 * files are tied only where two clues agree, or where their names begin alike.
 */

/** What tied files of a group: names alike, one going on where another ends, a way there and a way back, or written together. */
export type GroupClue = 'name' | 'onward' | 'thereAndBack' | 'together';

/** Files that belong together, under the name their folder would get, with the clues that tied them. */
export interface FileGroup {
  name: string;
  files: StashFile[];
  clues: GroupClue[];
}

/** How far the start of a file may lie from the end of the one it goes on from: the other side of a town. */
const ONWARD_M = 8000;
/** How near its start a file ends that is a round by itself. */
const LOOP_M = 3000;
/** How far from where the way there began the way back may end: riders go home to different places. */
const BACK_M = 30_000;
/** How long apart files are written that were written together. */
const TOGETHER_MS = 60 * 60 * 1000;
/** How many files with other names may leave from a place before it is a common point of departure. */
const UNRELATED_DEPARTURES = 2;
/** How many files of other folders leave from a common point of departure. */
const DEPARTURES_ELSEWHERE = 3;

/** Words that say what kind of thing a file is, which day or leg of it, or stand between: none says which tour. */
const GENERIC = new Set(
  `tour touren route routen track strecke trip reise fahrt ausfahrt runde rundtour rundfahrt rundkurs loop tagestour ride
  tag day teil part etappe stage teilstrecke leg variante variant version hinfahrt anfahrt anreise outbound rueckfahrt rueckreise heimfahrt heimreise abreise return
  kleine kleiner grosse grosser neue neuer small little
  montag dienstag mittwoch donnerstag freitag samstag sonntag monday tuesday wednesday thursday friday saturday sunday
  januar februar maerz april juni juli august september oktober november dezember january february march june july october december
  nach von vom bis zum zur durch ueber unter ohne with from over through und and oder dem den der die das des ein eine einen the
  garmin tomtom copy kopie`.split(/\s+/),
);

/** The words that count a day or a leg, which a group's name does not end or begin with. */
const COUNTER = /(^|[^\p{L}\p{N}])(tag|day|teil|part|etappe|stage|teilstrecke|leg)$/iu;

/** The words of a name that may say which tour it is of: without accents, what stands in brackets, numbers and generic words. */
export function tourWords(name: string): string[] {
  const plain = name
    .normalize('NFC')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/\([^)]*\)/g, ' ');
  return plain.split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !/\d/.test(word) && !/^[ivx]+$/.test(word) && !GENERIC.has(word));
}

/** Whether two words are one: the same, one the beginning of the other ("harz", "harztour"), or alike for their first six letters. */
function sameWord(a: string, b: string): boolean {
  let alike = 0;
  while (alike < a.length && alike < b.length && a[alike] === b[alike]) alike++;
  return alike === Math.min(a.length, b.length) || alike >= 6;
}

/** A file as the clues read it: its words, where its longest route, or else track, starts and ends, and when it was written. */
interface Candidate {
  file: StashFile;
  words: string[];
  start?: LngLat;
  end?: LngLat;
  loop: boolean;
  written?: number;
  /** Whether it leaves from a common point of departure, where arriving goes on to nothing. */
  common: boolean;
}

/** Where the file's longest route starts, or its longest track where it has no route. */
function ends(file: StashFile): { start?: LngLat; end?: LngLat } {
  const routes = file.items.filter((item) => item.kind === 'route');
  const longest = (routes.length > 0 ? routes : file.items).reduce<StashFile['items'][number] | undefined>((a, b) => (a && a.distanceM >= b.distanceM ? a : b), undefined);
  const line = longest ? decodePolyline(longest.line) : [];
  return { start: line[0], end: line.at(-1) };
}

function candidate(file: StashFile): Candidate {
  const { start, end } = ends(file);
  const written = file.exportedAt === null ? NaN : Date.parse(file.exportedAt);
  return { file, words: tourWords(file.name), start, end, loop: !!start && !!end && distanceBetween(start, end) < LOOP_M, written: Number.isNaN(written) ? undefined : written, common: false };
}

const near = (a: LngLat | undefined, b: LngLat | undefined, metres: number): boolean => !!a && !!b && distanceBetween(a, b) < metres;

/** Whether some word of one name is a word of the other. */
const related = (a: Candidate, b: Candidate): boolean => a.words.some((x) => b.words.some((y) => sameWord(x, y)));

/** Whether the names begin with the same two words. */
const beginAlike = (a: Candidate, b: Candidate): boolean => a.words.length >= 2 && b.words.length >= 2 && sameWord(a.words[0]!, b.words[0]!) && sameWord(a.words[1]!, b.words[1]!);

/** Whether the files were written by the same thing within the hour. */
const together = (a: Candidate, b: Candidate): boolean =>
  a.written !== undefined && b.written !== undefined && a.file.creator === b.file.creator && Math.abs(a.written - b.written) <= TOGETHER_MS;

/** Whether `b` goes on where `a` ends; two rounds do not go on from each other, and `strict` leaves out a `b` that leaves from a common point of departure. */
const goesOn = (a: Candidate, b: Candidate, strict: boolean): boolean => !(a.loop && b.loop) && near(a.end, b.start, ONWARD_M) && !(strict && b.common);

/** Whether one is the way there and the other the way back. */
const thereAndBack = (a: Candidate, b: Candidate): boolean =>
  !a.loop && !b.loop && ((near(a.end, b.start, ONWARD_M) && near(b.end, a.start, BACK_M)) || (near(b.end, a.start, ONWARD_M) && near(a.end, b.start, BACK_M)));

/** The clues that tie two files, none where they do not belong together. */
function tie(a: Candidate, b: Candidate): GroupClue[] {
  if (beginAlike(a, b)) return ['name'];
  const written = together(a, b);
  if (related(a, b)) {
    if (written) return ['name', 'together'];
    if (goesOn(a, b, true) || goesOn(b, a, true)) return ['name', 'onward'];
    if (thereAndBack(a, b)) return ['name', 'thereAndBack'];
  }
  return written && (goesOn(a, b, false) || goesOn(b, a, false)) ? ['together', 'onward'] : [];
}

/** The longest text every name holds, compared without regard to case, as the first name writes it. */
function commonPart(names: readonly string[]): string {
  const lower = names.map((name) => name.toLowerCase());
  const first = lower[0]!;
  for (let length = first.length; length > 0; length--) {
    for (let at = 0; at + length <= first.length; at++) {
      if (lower.every((name) => name.includes(first.slice(at, at + length)))) return names[0]!.slice(at, at + length);
    }
  }
  return '';
}

const LETTER = /[\p{L}\p{N}]/u;

/**
 * What the names have in common, as a folder's name: their longest common text, cut back
 * to whole words, without a bracket left open and without the word that counts their
 * days or legs; the first name where what they share says nothing of the tour.
 */
export function commonName(names: readonly string[]): string {
  let part = commonPart(names);
  const at = names.map((name) => name.toLowerCase().indexOf(part.toLowerCase()));
  // Inside a word in every name, the text's first or last word is none of theirs.
  if (LETTER.test(part[0] ?? '') && names.every((name, i) => LETTER.test(name[at[i]! - 1] ?? ''))) part = part.replace(/^[\p{L}\p{N}]+/u, '');
  if (LETTER.test(part.at(-1) ?? '') && names.every((name, i) => LETTER.test(name[at[i]! + part.length] ?? ''))) part = part.replace(/[\p{L}\p{N}]+$/u, '');
  const bare = (text: string) => text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N})]+$/gu, '');
  const name = bare(bare(part.replace(/\([^)]*$/, '')).replace(COUNTER, '$1'));
  return tourWords(name).length > 0 ? name : names[0]!;
}

/**
 * The groups among the loose files of a folder, each of two files or more, by name; the
 * files left alone belong to none. `elsewhere` are the Stash's other files: where
 * several of them leave from as well is a common point of departure, a home or a
 * meeting point, and one ride ending there does not go on to the next.
 */
export function groupFiles(files: readonly StashFile[], elsewhere: readonly StashFile[]): FileGroup[] {
  const candidates = files.map(candidate);
  const departures = elsewhere.map((file) => ends(file).start);
  for (const b of candidates) {
    b.common =
      departures.filter((start) => near(start, b.start, ONWARD_M)).length >= DEPARTURES_ELSEWHERE ||
      candidates.filter((a) => a !== b && near(a.start, b.start, ONWARD_M) && !related(a, b)).length > UNRELATED_DEPARTURES;
  }
  const group = candidates.map((_, i) => i);
  const top = (i: number): number => (group[i] === i ? i : (group[i] = top(group[i]!)));
  const clues = new Map<number, Set<GroupClue>>();
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const found = tie(candidates[i]!, candidates[j]!);
      if (found.length === 0) continue;
      const [a, b] = [top(i), top(j)];
      group[a] = b;
      clues.set(b, new Set([...(clues.get(a) ?? []), ...(clues.get(b) ?? []), ...found]));
    }
  }
  const members = new Map<number, StashFile[]>();
  candidates.forEach(({ file }, i) => members.set(top(i), [...(members.get(top(i)) ?? []), file]));
  return [...members]
    .filter(([, of]) => of.length > 1)
    .map(([id, of]) => {
      const sorted = [...of].sort((a, b) => byName(a.name, b.name));
      return { name: commonName(sorted.map((file) => file.name)), files: sorted, clues: [...clues.get(id)!] };
    })
    .sort((a, b) => byName(a.name, b.name));
}
