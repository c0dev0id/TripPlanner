import { describe, expect, it } from 'vitest';
import { distanceText, durationText, timeText } from './format';

describe('distanceText', () => {
  it('scales the unit and precision with the distance', () => {
    expect(distanceText(0)).toBe('0 m');
    expect(distanceText(849.6)).toBe('850 m');
    expect(distanceText(1234)).toBe('1.2 km');
    expect(distanceText(99_950)).toBe('100.0 km');
    expect(distanceText(312_400)).toBe('312 km');
  });
});

describe('timeText', () => {
  it('writes minutes since midnight as a time of day', () => {
    expect(timeText(0)).toBe('00:00');
    expect(timeText(9 * 60 + 5)).toBe('09:05');
    expect(timeText(17.6 * 60)).toBe('17:36');
    expect(timeText(25 * 60)).toBe('01:00 +1');
  });
});

describe('durationText', () => {
  it('writes seconds as hours and minutes', () => {
    expect(durationText(0)).toBe('0 min');
    expect(durationText(45 * 60 + 20)).toBe('45 min');
    expect(durationText(3600)).toBe('1 h');
    expect(durationText(3 * 3600 + 40 * 60)).toBe('3 h 40 min');
  });
});
