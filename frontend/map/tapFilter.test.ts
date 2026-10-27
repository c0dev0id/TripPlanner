import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOUNCE_MS, TapFilter } from './tapFilter';

const mouse = (x: number, y: number, t: number) => ({ x, y, t, touch: false });
const finger = (x: number, y: number, t: number) => ({ x, y, t, touch: true });

describe('TapFilter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** A filter and the taps it let through, by name. */
  function setup() {
    const taps: string[] = [];
    const filter = new TapFilter();
    const tap = (name: string) => () => taps.push(name);
    return { filter, taps, tap };
  }

  /** A press that ends where it began, followed by its click. */
  function click(f: TapFilter, at: ReturnType<typeof mouse>, run: () => void) {
    f.down(at);
    f.up(at);
    f.click(at, run);
  }

  it('lets a tap through once BOUNCE_MS have passed', () => {
    const { filter, taps, tap } = setup();
    click(filter, mouse(100, 100, 0), tap('a'));
    vi.advanceTimersByTime(BOUNCE_MS - 1);
    expect(taps).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(taps).toEqual(['a']);
  });

  it('drops a tap when a drag starts at it within BOUNCE_MS, as a bouncing button does', () => {
    const { filter, taps, tap } = setup();
    click(filter, mouse(100, 100, 0), tap('a'));
    filter.down(mouse(101, 100, 40));
    filter.move(mouse(140, 120, 60));
    vi.advanceTimersByTime(1000);
    filter.up(mouse(300, 200, 900));
    expect(taps).toEqual([]);
  });

  it('lets the tap through when a press at it ends without a drag', () => {
    const { filter, taps, tap } = setup();
    click(filter, mouse(100, 100, 0), tap('a'));
    filter.down(mouse(100, 100, 120));
    vi.advanceTimersByTime(400);
    expect(taps).toEqual([]);
    filter.up(mouse(102, 101, 520));
    expect(taps).toEqual(['a']);
  });

  it('drops a click where a drag ended within BOUNCE_MS', () => {
    const { filter, taps, tap } = setup();
    filter.down(mouse(100, 100, 0));
    filter.move(mouse(200, 150, 50));
    filter.up(mouse(300, 200, 100));
    filter.click(mouse(300, 200, 101), tap('drag end'));
    vi.advanceTimersByTime(1000);
    expect(taps).toEqual([]);
  });

  it('ignores the click a browser sends at the end of a touch pan', () => {
    const { filter, taps, tap } = setup();
    filter.down(finger(100, 100, 0));
    filter.move(finger(220, 170, 200));
    filter.up(finger(220, 170, 250));
    filter.click(finger(220, 170, 260), tap('pan'));
    vi.advanceTimersByTime(1000);
    expect(taps).toEqual([]);
  });

  it('lets a waiting tap through at once when a press starts elsewhere or on flush', () => {
    const { filter, taps, tap } = setup();
    click(filter, mouse(100, 100, 0), tap('a'));
    filter.down(mouse(300, 300, 50));
    expect(taps).toEqual(['a']);
    filter.up(mouse(300, 300, 60));
    click(filter, mouse(100, 100, 1000), tap('b'));
    filter.flush();
    expect(taps).toEqual(['a', 'b']);
    vi.advanceTimersByTime(1000);
    expect(taps).toEqual(['a', 'b']);
  });
});
