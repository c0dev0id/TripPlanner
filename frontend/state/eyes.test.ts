import { beforeEach, describe, expect, it } from 'vitest';
import type { Trip } from '../model/trip';
import { groupEye, recordingEye, recordingOnMap, routeEye, routeOnMap, setGroupEye, setRecordingEyes, setRouteEyes } from './eyes';
import { closeTrip, loadTrip } from './trip';

const empty = (id: number): Trip => ({ id, kind: 'trip', name: 'T', description: '', state: 'planned', version: 1, days: [] });

describe('the eyes', () => {
  beforeEach(() => {
    closeTrip();
    loadTrip(empty(1));
  });

  it('are open on routes and closed on recordings until set otherwise', () => {
    expect([routeEye('a'), recordingEye(7), groupEye('routes'), groupEye('recordings')]).toEqual([true, false, true, true]);
    setRouteEyes(['a', 'b'], false);
    setRouteEyes(['b'], true);
    setRecordingEyes([7, 8], true);
    setRecordingEyes([8], false);
    expect([routeOnMap('a'), routeOnMap('b'), recordingOnMap(7), recordingOnMap(8)]).toEqual([false, true, true, false]);
  });

  it('of a group take all of it off the map and leave its eyes as they are', () => {
    setRouteEyes(['a'], false);
    setRecordingEyes([7], true);
    setGroupEye('routes', false);
    setGroupEye('recordings', false);
    expect([routeOnMap('b'), recordingOnMap(7), routeEye('b'), recordingEye(7)]).toEqual([false, false, true, true]);
    setGroupEye('routes', true);
    setGroupEye('recordings', true);
    expect([routeOnMap('a'), routeOnMap('b'), recordingOnMap(7)]).toEqual([false, true, true]);
  });

  it('go with the trip', () => {
    setRouteEyes(['a'], false);
    setRecordingEyes([7], true);
    setGroupEye('recordings', false);
    loadTrip(empty(2));
    expect([routeEye('a'), recordingEye(7), groupEye('recordings')]).toEqual([true, false, true]);
  });
});
