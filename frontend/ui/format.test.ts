import { describe, expect, it } from 'vitest';
import { distanceText } from './format';

describe('distanceText', () => {
  it('scales the unit and precision with the distance', () => {
    expect(distanceText(0)).toBe('0 m');
    expect(distanceText(849.6)).toBe('850 m');
    expect(distanceText(1234)).toBe('1.2 km');
    expect(distanceText(99_950)).toBe('100.0 km');
    expect(distanceText(312_400)).toBe('312 km');
  });
});
