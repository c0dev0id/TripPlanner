import { describe, expect, it } from 'vitest';
import { offTime } from './labels';

describe('offTime', () => {
  it('says by how much the ride is late or early for a fixed time, and when it gets there', () => {
    expect(offTime({ arrivalMin: 600, departureMin: 660, slackMin: -29 })).toEqual({ late: true, text: '29 min late', rideMin: 629 });
    expect(offTime({ arrivalMin: 600, departureMin: 600, slackMin: 90 })).toEqual({ late: false, text: '1 h 30 min early', rideMin: 510 });
    expect(offTime({ arrivalMin: 600, departureMin: 600, slackMin: 0 })).toBeUndefined();
  });
});
