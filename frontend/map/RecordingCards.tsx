import { locale } from '../i18n/language';
import { t } from '../i18n/t';
import { createEffect, createMemo, createSignal, For, Match, Show, Switch } from 'solid-js';
import uPlot from 'uplot';
import { deltaSummaryOf, type Delta } from '../recording/delta';
import { fileFacts, type FileFacts } from '../recording/file';
import { DIFFERENCE_FIGURES, FIGURES, type Figure } from '../recording/figures';
import { isDifference, kmBySurface, NO_VALUE, SURFACES, surfaceLabel, type Coloring, type Difference } from '../recording/lineColors';
import { histogram, summaryOf, type Metric } from '../recording/measures';
import { onPhone } from '../state/panel';
import {
  colorings,
  comparison,
  hoverIndex,
  opened,
  openedSurfaces,
  openRecording,
  pickedIndex,
  setColoring,
  setHoverIndex,
  setPickedIndex,
  shownColoring,
  shownScale,
  type Comparison,
  type Opened,
} from '../state/recordingView';
import { recordingColor } from '../state/recordings';
import { Chart, type ChartInk } from '../ui/Chart';
import { distanceText, durationText } from '../ui/format';
import { Figures } from '../ui/Figures';
import { CloseIcon } from '../ui/icons';

/** The opened recording's figures over the map: its summary with what it is focused on, and the chart of the focus. */
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

/** What a focus is called in its list: a difference with what it is against. */
function coloringLabel(c: Coloring): string {
  const against = comparison()?.name ?? '';
  switch (c) {
    case 'surface':
      return t('Surface');
    case 'offset':
      return t('Distance from {against}', { against });
    case 'speedDifference':
      return t('Speed against {against}', { against });
    case 'leanDifference':
      return t('Lean against {against}', { against });
    default:
      return FIGURES[c].label;
  }
}

const textOf = <T,>(value: T | undefined, text: (value: T) => string): string | undefined => (value === undefined ? undefined : text(value));

/** The rows that say what the recording's file is like: what wrote it, how densely, in how many pieces, and what it tells of each point. */
function fileRows(file: FileFacts): [string, string | undefined][] {
  const density = [
    file.points.toLocaleString(locale),
    file.intervalS !== undefined && t('every {n} s', { n: (Math.round(file.intervalS * 10) / 10).toLocaleString(locale) }),
    file.spacingM !== undefined && t('{distance} apart', { distance: distanceText(file.spacingM) }),
  ];
  const values = file.values.map(({ name, share }) => (share < 0.995 ? t('{name} ({share} %)', { name, share: Math.round(share * 100) }) : name));
  return [
    [t('Recorded by'), file.creator],
    [t('Points'), density.filter(Boolean).join(' · ')],
    [t('Segments'), file.segments > 1 ? String(file.segments) : undefined],
    [t('Values'), values.length > 0 ? values.join(', ') : undefined],
  ];
}

/** The recording in figures, how it differs from what it is compared with, and what it is focused on with its legend; folded at first on a narrow screen. */
function SummaryCard(props: { opened: Opened }) {
  const rows = createMemo((): [string, string | undefined][] => {
    const s = summaryOf(props.opened.measures);
    const { speed, altitude, lean } = FIGURES;
    return [
      [t('Distance'), distanceText(s.distanceM)],
      [t('Time'), textOf(s.durationS, durationText)],
      [t('Moving'), textOf(s.movingS, durationText)],
      [t('Average speed'), textOf(s.averageSpeed, speed.text)],
      [t('Top speed'), textOf(s.maxSpeed, speed.text)],
      [t('Climb'), textOf(s.ascentM, altitude.text)],
      [t('Descent'), textOf(s.descentM, altitude.text)],
      [t('Altitude'), textOf(s.altitudeRange, ([low, high]) => `${altitude.text(low)} – ${altitude.text(high)}`)],
      [t('Lean'), textOf(s.leanRange, ([left, right]) => t('{left} to {right}', { left: lean.text(left), right: lean.text(right) }))],
      ...fileRows(fileFacts(props.opened.track, s.distanceM)),
    ];
  });
  return (
    // On a narrow screen the card would cover half the map: it starts folded there.
    <details class="map-card summary-card" open={!onPhone()}>
      <summary class="row">
        <span class="swatch" style={{ background: recordingColor(props.opened.recording) }} />
        <h3 class="grow name">{props.opened.recording.name}</h3>
        <button class="icon" title={t('Close the figures')} aria-label={t('Close the figures')} onClick={() => openRecording(undefined)}>
          <CloseIcon />
        </button>
      </summary>
      <Figures rows={rows()} />
      <Show when={comparison()}>{(c) => <ComparisonFigures opened={props.opened} comparison={c()} />}</Show>
      <label class="row">
        <span>{t('Focus')}</span>
        {/* Each option says whether it is chosen: the focus can change with the options, which a select's value does not follow. */}
        <select class="grow" onChange={(e) => setColoring((e.currentTarget.value || undefined) as Coloring | undefined)}>
          <option value="" selected={shownColoring() === undefined}>
            {t('None')}
          </option>
          <For each={colorings()}>
            {(c) => (
              <option value={c} selected={c === shownColoring()}>
                {coloringLabel(c)}
              </option>
            )}
          </For>
        </select>
      </label>
      <Switch>
        <Match when={shownColoring() === 'surface'}>
          <SurfaceLegend opened={props.opened} />
        </Match>
        <Match when={shownScale()}>{(shown) => <ScaleLegend shown={shown()} />}</Match>
      </Switch>
    </details>
  );
}

/** How the opened recording differs from what it is compared with, in figures. */
function ComparisonFigures(props: { opened: Opened; comparison: Comparison }) {
  const rows = createMemo((): [string, string | undefined][] => {
    const s = deltaSummaryOf(props.opened.measures, props.comparison.delta);
    const { time, speed } = DIFFERENCE_FIGURES;
    return [
      [t('Against'), props.comparison.name],
      [t('Off it'), distanceText(s.offM)],
      [t('Farthest off'), distanceText(s.furthestM)],
      [t('At the end'), textOf(s.timeS, time.text)],
      [t('On average'), textOf(s.speed, speed.text)],
    ];
  });
  return <Figures rows={rows()} />;
}

/** The colours of the line's scale from its low end to its high end. */
function ScaleLegend(props: { shown: NonNullable<ReturnType<typeof shownScale>> }) {
  return (
    <div class="legend">
      <div class="legend-bar">
        <For each={props.shown.scale.colors}>{(color) => <span style={{ background: color }} />}</For>
      </div>
      <div class="row legend-ends muted">
        <span class="grow">{props.shown.figure.text(props.shown.scale.from)}</span>
        <span>{props.shown.figure.text(props.shown.scale.to)}</span>
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
    return km.has(null) ? [...known, { key: 'none', label: surfaceLabel(null), color: NO_VALUE, km: km.get(null)! }] : known;
  });
  return (
    <Switch>
      <Match when={openedSurfaces() === 'matching'}>
        <p class="muted hint">{t('Matching the track to the roads…')}</p>
      </Match>
      <Match when={openedSurfaces() instanceof Error}>
        <p class="error hint">{t('The roads could not be matched: {error}', { error: (openedSurfaces() as Error).message })}</p>
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

/** The measures charted also as a spread of the distance over their values, in bins of this width. */
const BIN_WIDTH: Partial<Record<Metric, number>> = { speed: 10, slope: 2, lean: 5 };

/** What the spreads' tabs say. */
const SPREADS: Record<Metric, string> = { speed: 'Speeds', altitude: 'Altitudes', slope: 'Slopes', lean: 'Lean angles' };

/** A series charted along the track. */
interface AlongLine {
  values: readonly (number | null)[];
  figure: Figure;
  color: string;
  fill?: string;
}

/** The colour of each measure's series along the track. */
const METRIC_LINES: Record<Metric, Pick<AlongLine, 'color' | 'fill'>> = {
  altitude: { color: '#868e96', fill: 'rgba(134, 142, 150, 0.25)' },
  speed: { color: '#1971c2' },
  slope: { color: '#2b8a3e' },
  lean: { color: '#ae3ec9' },
};

/** The series along the track of a difference: the distance off, the lean against, or the speed against with the time gained or lost where the other recording has times. */
function differenceLines(d: Delta, focus: Difference): AlongLine[] {
  const offset = { values: d.offset.map((v) => (Number.isFinite(v) ? v : null)), figure: DIFFERENCE_FIGURES.offset, color: '#e8590c' };
  if (focus === 'offset') return [offset];
  if (focus === 'leanDifference') return d.lean ? [{ values: d.lean, figure: DIFFERENCE_FIGURES.lean, color: '#ae3ec9' }] : [];
  return [...(d.time ? [{ values: d.time, figure: DIFFERENCE_FIGURES.time, color: '#c2255c' }] : []), ...(d.speed ? [{ values: d.speed, figure: DIFFERENCE_FIGURES.speed, color: '#1971c2' }] : [])];
}

/** The chart of what the recording is focused on: a measure or a difference along the track, and a measure's spread over the distance; none for no focus and the surface, whose legend says it. */
function ChartCard(props: { opened: Opened }) {
  const focus = () => {
    const c = shownColoring();
    return c === 'surface' ? undefined : c;
  };
  const lines = createMemo((): AlongLine[] => {
    const f = focus();
    if (f === undefined) return [];
    if (isDifference(f)) {
      const c = comparison();
      return c ? differenceLines(c.delta, f) : [];
    }
    const values = props.opened.measures[f];
    return values ? [{ values, figure: FIGURES[f], ...METRIC_LINES[f] }] : [];
  });
  /** The measure focused on where it is also charted as a spread. */
  const spread = () => {
    const f = focus();
    return f !== undefined && !isDifference(f) && BIN_WIDTH[f] !== undefined ? f : undefined;
  };
  const [spreadShown, setSpreadShown] = createSignal(false);
  const [spreadReadout, setSpreadReadout] = createSignal<string>();
  const alongReadout = () => {
    const i = hoverIndex();
    if (i === undefined) return undefined;
    const parts = [distanceText(props.opened.measures.distance[i]!), ...lines().map((line) => textOf(line.values[i] ?? undefined, line.figure.text))];
    return parts.filter((p) => p !== undefined).join(' · ');
  };
  const along = () => !(spreadShown() && spread());
  return (
    <Show when={lines().length > 0}>
      <section class="map-card chart-card" aria-label={t('Charts of the recording')}>
        <div class="row">
          <div class="row tabs" role="tablist">
            <button role="tab" aria-selected={along()} onClick={() => setSpreadShown(false)}>
              {t(isDifference(focus()!) ? 'Difference' : 'Profile')}
            </button>
            <Show when={spread()}>
              {(metric) => (
                <button role="tab" aria-selected={!along()} onClick={() => setSpreadShown(true)}>
                  {t(SPREADS[metric()])}
                </button>
              )}
            </Show>
          </div>
          <span class="grow muted name readout">{along() ? alongReadout() : spreadReadout()}</span>
        </div>
        <Show when={along()} fallback={<SpreadChart opened={props.opened} metric={spread()!} onHover={setSpreadReadout} />}>
          <AlongChart distance={props.opened.measures.distance} lines={lines()} />
        </Show>
      </section>
    </Show>
  );
}

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

/** Up to two series along the track, the second on an axis of its own on the right: the pointer marks its point on the map, a click picks it, and the point picked is marked here. */
function AlongChart(props: { distance: Float64Array; lines: AlongLine[] }) {
  let chart: uPlot | undefined;
  createEffect(() => {
    pickedIndex();
    chart?.redraw(false, false);
  });
  const make = (ink: ChartInk) => {
    const series: uPlot.Series[] = [{}];
    const axes: uPlot.Axis[] = [axis(ink, 'km', { space: 60 })];
    props.lines.forEach((line, i) => {
      const scale = `y${i}`;
      series.push({ label: line.figure.label, scale, stroke: line.color, fill: line.fill, width: 1, points: { show: false } });
      axes.push(axis(ink, line.figure.unit, i === 0 ? { scale } : { scale, side: 1, grid: { show: false } }));
    });
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
    return { options, data: [Array.from(props.distance, (d) => d / 1000), ...props.lines.map((line) => line.values)] as uPlot.AlignedData };
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
      series: [{}, { label: 'km', stroke: '#1971c2', fill: 'rgba(25, 113, 194, 0.5)', width: 1, paths: uPlot.paths.bars!({ size: [0.9, Infinity] }), points: { show: false } }],
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
