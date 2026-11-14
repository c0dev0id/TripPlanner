import { describe, expect, it } from 'vitest';
import { BW, RLP, ROADWORKS, siteInfo } from './roadworksOverlay';

describe('the roadworks', () => {
  it('ask each service for its features, and leave Baden-Württemberg to its own', () => {
    const requests = Object.values(ROADWORKS.parts(Infinity, { ridesOpacity: 0.4 }).sources).map((source) => new URL((source as { data: string }).data).searchParams);
    expect(requests.map((request) => request.get('TYPENAMES'))).toEqual(['mwvlw:umleitung', 'mwvlw:verlauf', 'mwvlw:baustelle', 'MobiData-BW:roadworks']);
    expect(requests.map((request) => request.get('CQL_FILTER'))).toEqual([null, "quelle<>'Verkehrsministerium Baden-Württemberg'", "quelle<>'Verkehrsministerium Baden-Württemberg'", null]);
  });
});

describe('siteInfo', () => {
  it("says what a site of Rhineland-Palatinate's service is", () => {
    const site = { strasse: 'K1067', art_der_arbeiten: 'Vollsperrung', beschreibung: 'Bauphase', von: '2026-05-19T08:00:00Z', bis: '2026-11-30T17:00:00Z', speedlimit: 50, quelle: 'Autobahn GmbH', frc: null };
    const info = siteInfo(RLP, site);
    expect(info.title).toBe('K1067');
    expect(info.lines).toHaveLength(4);
    expect(info.lines.slice(0, 2)).toEqual(['Vollsperrung', 'Bauphase']);
    expect(info.lines[2]).toMatch(/2026.*–.*2026/);
    expect(info.lines[3]).toContain('50');
    expect(info.note).toBe('Autobahn GmbH');
  });

  it("says a closed road of Baden-Württemberg's service is one, and leaves out what a site does not say", () => {
    expect(siteInfo(BW, { street: 'L521', type: 'ROAD_CLOSED', description: '', reference: 'MobiData BW' })).toEqual({ title: 'L521', lines: ['Road closed'], note: 'MobiData BW' });
    expect(siteInfo(BW, { type: 'CONSTRUCTION' })).toEqual({ title: 'Roadworks', lines: [], note: undefined });
  });
});
