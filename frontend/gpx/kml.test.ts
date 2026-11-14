import { describe, expect, it } from 'vitest';
import { parseKml } from './kml';

const kml = (inner: string) => `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">${inner}</kml>`;

describe('parseKml', () => {
  it('reads points as waypoints under their folder, and lines as tracks', () => {
    const read = parseKml(
      kml(`<Document><name>Vogesen</name>
        <Folder><name>Unterkünfte</name>
          <Placemark><name>Hotel Post</name><address>Hauptstr. 1, Munster</address><phoneNumber>+33 1 23</phoneNumber><Point><coordinates>7.1,48.05,410</coordinates></Point></Placemark>
        </Folder>
        <Folder><name>Routen</name>
          <Placemark><name>Nord</name><LineString><coordinates>
            7.1,48.5,0 7.2,48.6,0
            7.15,48.7,0
          </coordinates></LineString></Placemark>
        </Folder>
        <Placemark><name>Loose</name><Point><coordinates>7.3,48.1</coordinates></Point></Placemark>
      </Document>`),
    );
    expect(read.name).toBe('Vogesen');
    expect(read.waypoints).toEqual([
      { lngLat: [7.1, 48.05], name: 'Hotel Post', type: 'Unterkünfte', links: [], address: 'Hauptstr. 1, Munster', phone: '+33 1 23' },
      { lngLat: [7.3, 48.1], name: 'Loose', type: undefined, links: [], address: undefined, phone: undefined },
    ]);
    expect(read.tracks).toEqual([{ name: 'Nord', segments: [[[7.1, 48.5], [7.2, 48.6], [7.15, 48.7]]], time: undefined }]);
    expect(read.routes).toEqual([]);
  });

  it('reads a recorded track with when it began, and several of a placemark as its segments', () => {
    const read = parseKml(
      kml(`<Placemark><name>Ride</name><gx:MultiTrack>
        <gx:Track><when>2024-06-01T07:00:00Z</when><when>2024-06-01T07:00:05Z</when><gx:coord>8.1 47.2 500</gx:coord><gx:coord>8.2 47.3 510</gx:coord></gx:Track>
        <gx:Track><when>2024-06-01T09:00:00Z</when><gx:coord>8.3 47.4 520</gx:coord></gx:Track>
      </gx:MultiTrack></Placemark>`),
    );
    expect(read.tracks).toEqual([{ name: 'Ride', segments: [[[8.1, 47.2], [8.2, 47.3]], [[8.3, 47.4]]], time: '2024-06-01T07:00:00Z' }]);
  });

  it('takes a placemark of several geometries apart, and leaves areas out', () => {
    const read = parseKml(
      kml(`<Placemark><name>Pass</name><MultiGeometry>
        <Point><coordinates>9,46</coordinates></Point>
        <LineString><coordinates>9,46 9.1,46.1</coordinates></LineString>
        <LineString><coordinates>9.2,46.2 9.3,46.3</coordinates></LineString>
        <Polygon><outerBoundaryIs><LinearRing><coordinates>9,46 9.1,46 9.1,46.1 9,46</coordinates></LinearRing></outerBoundaryIs></Polygon>
      </MultiGeometry></Placemark>`),
    );
    expect(read.waypoints.map((w) => [w.name, w.lngLat])).toEqual([['Pass', [9, 46]]]);
    expect(read.tracks).toEqual([{ name: 'Pass', segments: [[[9, 46], [9.1, 46.1]], [[9.2, 46.2], [9.3, 46.3]]], time: undefined }]);
  });

  it('reads a description written as HTML as text, with the pages it links to', () => {
    const [place] = parseKml(kml(`<Placemark><name>Café</name><description><![CDATA[Best cake<br>in town.<p>Open daily</p><a href="https://example.org/cafe">Website</a> <a href="mailto:a@b.c">Mail</a><img src="x.jpg"/>]]></description><Point><coordinates>8,47</coordinates></Point></Placemark>`)).waypoints;
    expect(place!.description).toBe('Best cake\nin town.Open daily\nWebsite Mail');
    expect(place!.links).toEqual(['https://example.org/cafe']);
    expect(parseKml(kml('<Placemark><description>Plain &amp; simple</description><Point><coordinates>8,47</coordinates></Point></Placemark>')).waypoints[0]!.description).toBe('Plain & simple');
  });

  it('leaves out what has no position on the world, and refuses what is no KML', () => {
    const read = parseKml(kml('<Placemark><Point><coordinates>8,95</coordinates></Point></Placemark><Placemark><LineString><coordinates>nonsense</coordinates></LineString></Placemark>'));
    expect([read.waypoints, read.tracks]).toEqual([[], []]);
    expect(() => parseKml('<gpx></gpx>')).toThrow('not a KML file');
    expect(() => parseKml('not xml')).toThrow('not a KML file');
  });
});
