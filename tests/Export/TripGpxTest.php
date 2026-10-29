<?php

declare(strict_types=1);

namespace Planner\Tests\Export;

use DateTimeImmutable;
use PHPUnit\Framework\TestCase;
use Planner\Export\ExportOptions;
use Planner\Export\Proximity;
use Planner\Export\TripGpx;
use Planner\Tests\Trip\TripFixture;
use SimpleXMLElement;

final class TripGpxTest extends TestCase
{
    private const GPX = 'http://www.topografix.com/GPX/1/1';

    /** The fixture with a second day of two routes and a free stop far from both. */
    private function document(): array
    {
        $document = TripFixture::document();
        $document['days'][] = TripFixture::day(
            'day2',
            [TripFixture::route('r2', [[11.4, 47.3], [11.5, 48.1]]), ['name' => 'Hike'] + TripFixture::route('r3', [[11.4, 47.3], [11.41, 47.31]])],
            [TripFixture::stop('s4', 'Hotel Post', [11.4, 47.3], 'r2-0', 'hotel'), TripFixture::stop('s5', 'Far away', [12.5, 47.3], null)],
        );
        return $document;
    }

    private function parse(string $gpx): SimpleXMLElement
    {
        $xml = new SimpleXMLElement($gpx);
        $xml->registerXPathNamespace('g', self::GPX);
        return $xml;
    }

    public function testWritesStopsAsWaypointsAndRoutesAsTracks(): void
    {
        $xml = $this->parse(TripGpx::trip($this->document(), new DateTimeImmutable('2026-10-27T10:00:00+02:00')));
        self::assertSame('Alps', (string) $xml->xpath('/g:gpx/g:metadata/g:name')[0]);
        self::assertSame('2026-10-27T08:00:00Z', (string) $xml->xpath('/g:gpx/g:metadata/g:time')[0]);
        $waypoints = $xml->xpath('/g:gpx/g:wpt');
        self::assertSame(['Home', 'Hotel Post', 'Café & Bar', 'Hotel Post'], array_map(fn ($w) => (string) $w->name, $waypoints));
        self::assertSame('cafe', (string) $waypoints[2]->type);
        self::assertSame('47.810000', (string) $waypoints[2]['lat']);
        $tracks = $xml->xpath('/g:gpx/g:trk');
        self::assertSame(['Day 1 South', 'Day 2 – Route 1', 'Day 2 – Hike'], array_map(fn ($t) => (string) $t->name, $tracks));
        self::assertCount(3, $tracks[0]->trkseg->trkpt);
    }

    public function testWritesATrackWithEveryPointOfItsLineInEitherForm(): void
    {
        $document = TripFixture::document();
        $document['days'][0]['routes'] = [TripFixture::track('t1')];
        $tracks = $this->parse(TripGpx::trip($document, new DateTimeImmutable()))->xpath('/g:gpx/g:trk/g:trkseg/g:trkpt');
        self::assertSame(['47.300000', '47.200000', '47.100000'], array_map(fn ($p) => (string) $p['lat'], $tracks));
        $routes = $this->parse(TripGpx::trip($document, new DateTimeImmutable(), new ExportOptions(form: 'routes')))->xpath('/g:gpx/g:rte/g:rtept');
        self::assertCount(3, $routes);
    }

    public function testLeavesOutAFreeStopFarFromEveryRoute(): void
    {
        $xml = $this->parse(TripGpx::day($this->document(), 1, new DateTimeImmutable()));
        self::assertSame('Alps – Day 2', (string) $xml->xpath('/g:gpx/g:metadata/g:name')[0]);
        self::assertSame(['Hotel Post'], array_map(fn ($w) => (string) $w->name, $xml->xpath('/g:gpx/g:wpt')));
        self::assertCount(2, $xml->xpath('/g:gpx/g:trk'));
        // With a wider reach the far stop is in.
        $wide = $this->parse(TripGpx::day($this->document(), 1, new DateTimeImmutable(), new ExportOptions(reachM: 100_000)));
        self::assertSame(['Hotel Post', 'Far away'], array_map(fn ($w) => (string) $w->name, $wide->xpath('/g:gpx/g:wpt')));
    }

    public function testWritesRoutesAsRoutePointsOnRequest(): void
    {
        $xml = $this->parse(TripGpx::trip($this->document(), new DateTimeImmutable(), new ExportOptions(form: 'routes')));
        self::assertCount(0, $xml->xpath('/g:gpx/g:trk'));
        $routes = $xml->xpath('/g:gpx/g:rte');
        self::assertSame(['Day 1 South', 'Day 2 – Route 1', 'Day 2 – Hike'], array_map(fn ($r) => (string) $r->name, $routes));
        self::assertCount(3, $routes[0]->rtept);
        self::assertSame('48.100000', (string) $routes[0]->rtept[0]['lat']);
        self::assertCount(4, $xml->xpath('/g:gpx/g:wpt'));
    }

    public function testLeavesOutOptionalPartsOnRequest(): void
    {
        $document = $this->document();
        $document['days'][1]['routes'][0]['optional'] = true;
        $document['days'][0]['stops'][2]['optional'] = true;
        $xml = $this->parse(TripGpx::trip($document, new DateTimeImmutable(), new ExportOptions(optional: false)));
        self::assertSame(['Day 1 South', 'Day 2'], array_map(fn ($t) => (string) $t->name, $xml->xpath('/g:gpx/g:trk')));
        // The café is optional; day 2's hotel stood on the optional route's point and is now a free stop beside the hike.
        self::assertSame(['Home', 'Hotel Post', 'Hotel Post'], array_map(fn ($w) => (string) $w->name, $xml->xpath('/g:gpx/g:wpt')));
        $all = $this->parse(TripGpx::trip($document, new DateTimeImmutable()));
        self::assertCount(3, $all->xpath('/g:gpx/g:trk'));
        self::assertCount(4, $all->xpath('/g:gpx/g:wpt'));
    }

    public function testReadsOptionsFromAQueryOrJson(): void
    {
        self::assertEquals(new ExportOptions(), ExportOptions::from([]));
        self::assertEquals(new ExportOptions('day', 'routes', false, 500), ExportOptions::from(['per' => 'day', 'form' => 'routes', 'optional' => '0', 'reachM' => '500']));
        self::assertEquals(new ExportOptions('day', 'routes', false, 500), ExportOptions::from(['per' => 'day', 'form' => 'routes', 'optional' => false, 'reachM' => 500]));
        self::assertNull(ExportOptions::from(['per' => 'week']));
        self::assertNull(ExportOptions::from(['form' => 'lines']));
        self::assertNull(ExportOptions::from(['optional' => 'yes']));
        self::assertNull(ExportOptions::from(['reachM' => '-1']));
        self::assertNull(ExportOptions::from(['reachM' => 1_000_000]));
        self::assertNull(ExportOptions::from('tracks'));
        self::assertSame('{"per":"trip","form":"tracks","optional":true,"reachM":2000}', json_encode(new ExportOptions()));
    }

    public function testMeasuresTheDistanceToALine(): void
    {
        // A kilometre east of a north-south line, measured at the point's own latitude.
        $offset = 1000 / (111_195 * cos(deg2rad(47.5)));
        self::assertEqualsWithDelta(1000, Proximity::toLine([11.4 + $offset, 47.5], [[11.4, 47.3], [11.4, 48.1]]), 1);
        self::assertEqualsWithDelta(0, Proximity::toLine([11.4, 47.7], [[11.4, 47.3], [11.4, 48.1]]), 0.001);
        // Beyond the line's end the distance is to that end.
        self::assertEqualsWithDelta(111_195 * 0.1, Proximity::toLine([11.4, 48.2], [[11.4, 47.3], [11.4, 48.1]]), 1);
        self::assertSame(INF, Proximity::toLine([11.4, 48.2], []));
    }

    public function testNamesFilesFromTheTripAndDay(): void
    {
        self::assertSame('Alps-Day-1-South', TripGpx::dayFileName($this->document(), 0));
        self::assertSame('Alps-Day-2', TripGpx::dayFileName($this->document(), 1));
        self::assertSame('Südtirol-2027', TripGpx::fileName('Südtirol / 2027!'));
        self::assertSame('trip', TripGpx::fileName('???'));
    }
}
