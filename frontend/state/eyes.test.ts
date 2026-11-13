import { beforeEach, describe, expect, it } from 'vitest';
import type { Trip } from '../model/trip';
import { groupEye, recordingEye, recordingOnMap, routeEye, routesOnMap, setGroupEye, setRecordingEyes, setRouteEyes } from './eyes';
import { addDay, addRoute, closeTrip, editRoute, loadTrip, selectedDay } from './trip';

const empty = (id: number): Trip => ({ id, kind: 'trip', name: 'T', description: '', state: 'planned', version: 1, days: [] });

/** The ids of the routes of the selected day that are on the map. */
const onMap = (): string[] => routesOnMap(selectedDay()!.routes).map((route) => route.id);

describe('the eyes', () => {
  let first: string;
  let second: string;

  beforeEach(() => {
    closeTrip();
    loadTrip(empty(1));
    addDay();
    addRoute();
    addRoute();
    [first, second] = selectedDay()!.routes.map((route) => route.id) as [string, string];
    editRoute(undefined);
  });

  it('are open on routes and closed on recordings until set otherwise', () => {
    expect([routeEye(first), recordingEye(7), groupEye('routes'), groupEye('recordings')]).toEqual([true, false, true, true]);
    expect(routesOnMap(selectedDay()!.routes)).toBe(selectedDay()!.routes);
    setRecordingEyes([7, 8], true);
    setRecordingEyes([8], false);
    expect([recordingOnMap(7), recordingOnMap(8)]).toEqual([true, false]);
  });

  it('take a route off the map, but not the one taken up', () => {
    setRouteEyes([first], false);
    expect(onMap()).toEqual([second]);
    editRoute(first);
    expect(onMap()).toEqual([first, second]);
    expect(routeEye(first)).toBe(false);
  });

  it('of a group take all of it off the map and leave its eyes as they are', () => {
    setRouteEyes([first], false);
    setRecordingEyes([7], true);
    setGroupEye('routes', false);
    setGroupEye('recordings', false);
    expect([onMap(), recordingOnMap(7), routeEye(second), recordingEye(7)]).toEqual([[], false, true, true]);
    editRoute(second);
    expect(onMap()).toEqual([second]);
    setGroupEye('routes', true);
    setGroupEye('recordings', true);
    editRoute(undefined);
    expect([onMap(), recordingOnMap(7)]).toEqual([[second], true]);
  });

  it('go with the trip', () => {
    setRouteEyes([first], false);
    setRecordingEyes([7], true);
    setGroupEye('recordings', false);
    loadTrip(empty(2));
    expect([routeEye(first), recordingEye(7), groupEye('recordings')]).toEqual([true, false, true]);
  });
});
