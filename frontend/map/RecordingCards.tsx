import { createEffect, createMemo, createSignal, For, Match, onCleanup, onMount, Show, Switch } from 'solid-js';
import uPlot from 'uplot';
import { FIGURES } from '../recording/figures';
import { kmBySurface, scaleOf, SURFACES, NO_VALUE, type Coloring } from '../recording/lineColors';
import { histogram, summaryOf, type Metric } from '../recording/measures';
import { hoverIndex, opened, openedSurfaces, openRecording, pickedIndex, setColoring, setHoverIndex, setPickedIndex, shownColoring, type Opened } from '../state/recordingView';
import { mapCover, setMapCover } from '../state/drawing';
import { recordingColor } from '../state/recordings';
import { Chart, type ChartInk } from '../ui/Chart';
import { distanceText, durationText } from '../ui/format';
import { CloseIcon } from '../ui/icons';

/** Keeps fitted views clear of a card while it is shown: its width from the left edge, or its height from the bottom. */
function coverWith(card: HTMLElement, edge: 'left' | 'bottom') {
  onMount(() => {
    const map = card.parentElement!;
    setMapCover({ ...mapCover(), [edge]: edge === 'left' ? card.offsetLeft + card.offsetWidth : map.clientHeight - card.offsetTop });
  });
  onCleanup(() => setMapCover({ ...mapCover(), [edge]: 0 }));
}

/** The opened recording's figures over the map: its summary with the colouring of its line, and its charts. */
export function RecordingCards() {
  return (
    <Show when={opened()}>
      {(o) => (
        <>
          <SummaryCard opened={o()} />
          <ChartCard opened={o()} />
        </>
      )}
    </Show>
  );
}

const coloringLabel = (c: Coloring): string => (c === 'surface' ? 'Surface' : FIGURES[c].label);

const textOf = <T,>(value: T | undefined, text: (value: T) => string): string | undefined => (value === undefined ? undefined : text(value));

/** The recording in figures, the colouring of its line with its legend; folded at first on a narrow screen. */
function SummaryCard(props: { opened: Opened }) {
  const rows = createMemo((): [string, string][] => {
    const s = summaryOf(props.opened.measures);
    const { speed, altitude, lean } = FIGURES;
    const rows: [string, string | undefined][] = [
      ['Distance', distanceText(s.distanceM)],
      ['Time', textOf(s.durationS, durationText)],
      ['Moving', textOf(s.movingS, durationText)],
      ['Average speed', textOf(s.averageSpeed, speed.text)],
      ['Top speed', textOf(s.maxSpeed, speed.text)],
      ['Climb', textOf(s.ascentM, altitude.text)],
      ['Descent', textOf(s.descentM, altitude.text)],
      ['Altitude', s.minAltitude === undefined ? undefined : `${altitude.text(s.minAltitude)} – ${altitude.text(s.maxAltitude!)}`],
      ['Lean', textOf(s.leanRange, ([left, right]) => `${lean.text(left)} to ${lean.text(right)}`)],
    ];
    return rows.filter((row): row is [string, string] => row[1] !== undefined);
  });
  // Beside the map's middle on a wide screen; on a narrow one it would cover half the map, and starts folded.
  const beside = matchMedia('(min-width: 721px)').matches;
  return (
    <details class="map-card summary-card" open={beside} ref={(card) => beside && coverWith(card, 'left')}>
      <summary class="row">
        <span class="swatch" style={{ background: recordingColor(props.opened.recording) }} />
        <h3 class="grow">{props.opened.recording.name}</h3>
        <button class="icon" title="Close the figures" aria-label="Close the figures" onClick={() => openRecording(undefined)}>
          <CloseIcon />
        </button>
      </summary>
      <dl class="figures">
        <For each={rows()}>
          {([label, value]) => (
            <>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </>
          )}
        </For>
      </dl>
      <label class="row coloring">
        <span>Colour</span>
        <select class="grow" value={shownColoring() ?? ''} onChange={(e) => setColoring((e.currentTarget.value || undefined) as Coloring | undefined)}>
          <option value="">The recording's own</option>
          <For each={props.opened.colorings}>{(c) => <option value={c}>{coloringLabel(c)}</option>}</For>
        </select>
      </label>
      <Switch>
        <Match when={shownColoring() === 'surface'}>
          <SurfaceLegend opened={props.opened} />
        </Match>
        <Match when={shownColoring()}>{(c) => <ScaleLegend opened={props.opened} metric={c() as Metric} />}</Match>
      </Switch>
    </details>
  );
}

/** The colours of a measure's scale from its low end to its high end. */
function ScaleLegend(props: { opened: Opened; metric: Metric }) {
  const scale = createMemo(() => scaleOf(props.metric, props.opened.measures[props.metric]!)!);
  const text = (value: number) => FIGURES[props.metric].text(value);
  return (
    <div class="legend">
      <div class="legend-bar">
        <For each={scale().colors}>{(color) => <span style={{ background: color }} />}</For>
      </div>
      <div class="row legend-ends muted">
        <span class="grow">{text(scale().from)}</span>
        <span>{text(scale().to)}</span>
      </div>
    </div>
  );
}

/** The surfaces under the track with the distance on each, once they are matched. */
function SurfaceLegend(props: { opened: Opened }) {
  const rows = createMemo(() => {
    const surfaces = openedSurfaces();
    if (!Array.isArray(surfaces)) return [];
    const km = kmBySurface(props.opened.measures.distance, surfaces);
    const known = SURFACES.filter((s) => km.has(s.key)).map((s) => ({ ...s, km: km.get(s.key)! }));
    return km.has(null) ? [...known, { key: 'none', label: 'No road matched', color: NO_VALUE, km: km.get(null)! }] : known;
  });
  return (
    <Switch>
      <Match when={openedSurfaces() === 'matching'}>
        <p class="muted hint">Matching the track to the roads…</p>
      </Match>
      <Match when={openedSurfaces() instanceof Error}>
        <p class="error hint">The roads could not be matched: {(openedSurfaces() as Error).message}</p>
      </Match>
      <Match when={rows().length > 0}>
        <ul class="legend surfaces">
          <For each={rows()}>
            {(row) => (
              <li class="row">
                <span class="swatch" style={{ background: row.color }} />
                <span class="grow">{row.label}</span>
                <span class="muted">{distanceText(row.km * 1000)}</span>
              </li>
            )}
          </For>
        </ul>
      </Match>
    </Switch>
  );
}

type ChartKind = 'profile' | Metric;

/** The measures charted as a spread of the distance over their values, in bins of this width. */
const BIN_WIDTH: Partial<Record<Metric, number>> = { speed: 10, slope: 2, lean: 5 };

/** The profile of altitude and speed along the track, and the spread of each measure over the distance; with the values under the pointer. */
function ChartCard(props: { opened: Opened }) {
  const kinds = createMemo((): ChartKind[] => {
    const m = props.opened.measures;
    const spreads = (Object.keys(BIN_WIDTH) as Metric[]).filter((metric) => m[metric] !== undefined);
    return m.altitude || m.speed ? ['profile', ...spreads] : spreads;
  });
  const [chosen, setChosen] = createSignal<ChartKind>('profile');
  const kind = () => (kinds().includes(chosen()) ? chosen() : kinds()[0]);
  const [spreadReadout, setSpreadReadout] = createSignal<string>();
  const profileReadout = () => {
    const i = hoverIndex();
    if (i === undefined) return undefined;
    const m = props.opened.measures;
    const parts = [distanceText(m.distance[i]!), textOf(m.altitude?.[i] ?? undefined, FIGURES.altitude.text), textOf(m.speed?.[i] ?? undefined, FIGURES.speed.text)];
    return parts.filter((p) => p !== undefined).join(' · ');
  };
  return (
    <Show when={kind()}>
      {(k) => (
        <section class="map-card chart-card" aria-label="Charts of the recording" ref={(card) => coverWith(card, 'bottom')}>
          <div class="row">
            <div class="row tabs" role="tablist">
              <For each={kinds()}>
                {(each) => (
                  <button role="tab" aria-selected={each === k()} onClick={() => setChosen(each)}>
                    {each === 'profile' ? 'Profile' : `${FIGURES[each].label}s`}
                  </button>
                )}
              </For>
            </div>
            <span class="grow muted readout">{k() === 'profile' ? profileReadout() : spreadReadout()}</span>
          </div>
          <Show when={k() === 'profile'} fallback={<SpreadChart opened={props.opened} metric={k() as Metric} onHover={setSpreadReadout} />}>
            <ProfileChart opened={props.opened} />
          </Show>
        </section>
      )}
    </Show>
  );
}

const PROFILE_COLORS = { altitude: '#868e96', altitudeFill: 'rgba(134, 142, 150, 0.25)', speed: '#1971c2' };

/** Axes in the chart's ink, labelled with their unit; an upright one as wide as its longest label. */
const axis = (ink: ChartInk, unit: string, more: uPlot.Axis = {}): uPlot.Axis => ({
  stroke: ink.text,
  size: (u, values, i) => (u.axes[i]!.side! % 2 === 0 ? 40 : 18 + 7 * Math.max(0, ...(values ?? []).map((v) => v.length))),
  grid: { stroke: ink.grid, width: 1 },
  ticks: { stroke: ink.grid, width: 1 },
  values: (_, splits) => splits.map((v) => (unit === '°' ? `${v}°` : `${v} ${unit}`)),
  ...more,
});

/** Where the pointer is in a chart, as the index of the value under it; undefined once it has left. */
const cursorIndex = (u: uPlot): number | undefined => ((u.cursor.left ?? -1) < 0 ? undefined : (u.cursor.idx ?? undefined));

/** Altitude and speed along the track: the pointer marks its point on the map, a click picks it, and the point picked is marked here. */
function ProfileChart(props: { opened: Opened }) {
  let chart: uPlot | undefined;
  createEffect(() => {
    pickedIndex();
    chart?.redraw(false, false);
  });
  const make = (ink: ChartInk) => {
    const m = props.opened.measures;
    const series: uPlot.Series[] = [{}];
    const axes: uPlot.Axis[] = [axis(ink, 'km', { space: 60 })];
    const data: (number | null)[][] = [];
    if (m.altitude) {
      series.push({ label: 'Altitude', scale: 'm', stroke: PROFILE_COLORS.altitude, fill: PROFILE_COLORS.altitudeFill, width: 1, points: { show: false } });
      axes.push(axis(ink, 'm', { scale: 'm' }));
      data.push(m.altitude);
    }
    if (m.speed) {
      series.push({ label: 'Speed', scale: 'km/h', stroke: PROFILE_COLORS.speed, width: 1, points: { show: false } });
      axes.push(axis(ink, 'km/h', m.altitude ? { scale: 'km/h', side: 1, grid: { show: false } } : { scale: 'km/h' }));
      data.push(m.speed);
    }
    const markPicked = (u: uPlot) => {
      const i = pickedIndex();
      if (i === undefined) return;
      const x = Math.round(u.valToPos(u.data[0][i]!, 'x', true));
      const ctx = u.ctx;
      ctx.save();
      ctx.strokeStyle = ink.text;
      ctx.lineWidth = devicePixelRatio;
      ctx.setLineDash([4 * devicePixelRatio, 3 * devicePixelRatio]);
      ctx.beginPath();
      ctx.moveTo(x, u.bbox.top);
      ctx.lineTo(x, u.bbox.top + u.bbox.height);
      ctx.stroke();
      ctx.restore();
    };
    const options: Omit<uPlot.Options, 'width' | 'height'> = {
      series,
      axes,
      scales: { x: { time: false } },
      legend: { show: false },
      cursor: { y: false, drag: { x: false, y: false }, points: { show: false } },
      hooks: {
        setCursor: [(u) => setHoverIndex(cursorIndex(u))],
        draw: [markPicked],
        ready: [
          (u) =>
            u.over.addEventListener('click', () => {
              const i = cursorIndex(u);
              if (i !== undefined) setPickedIndex(i);
            }),
        ],
      },
    };
    return { options, data: [Array.from(m.distance, (d) => d / 1000), ...data] as uPlot.AlignedData };
  };
  return <Chart make={make} ready={(c) => (chart = c)} />;
}

/** How far the track went at each value of a measure, in bins; the bin under the pointer is said by `onHover`. */
function SpreadChart(props: { opened: Opened; metric: Metric; onHover: (text: string | undefined) => void }) {
  const make = (ink: ChartInk) => {
    const width = BIN_WIDTH[props.metric]!;
    const { text, unit } = FIGURES[props.metric];
    const bins = histogram(props.opened.measures, props.opened.measures[props.metric]!, width);
    const say = (i: number | undefined) =>
      i === undefined ? undefined : `${text(bins.from[i]!)} to ${text(bins.from[i]! + width)}: ${distanceText(bins.km[i]! * 1000)}`;
    const options: Omit<uPlot.Options, 'width' | 'height'> = {
      series: [{}, { label: 'km', stroke: PROFILE_COLORS.speed, fill: 'rgba(25, 113, 194, 0.5)', width: 1, paths: uPlot.paths.bars!({ size: [0.9, Infinity] }), points: { show: false } }],
      axes: [axis(ink, unit, { space: 60 }), axis(ink, 'km')],
      scales: { x: { time: false, range: [bins.from[0]!, bins.from.at(-1)! + width] } },
      legend: { show: false },
      cursor: { y: false, drag: { x: false, y: false }, points: { show: false } },
      hooks: { setCursor: [(u) => props.onHover(say(cursorIndex(u)))] },
    };
    return { options, data: [bins.from.map((from) => from + width / 2), bins.km] as uPlot.AlignedData };
  };
  return <Chart make={make} />;
}
