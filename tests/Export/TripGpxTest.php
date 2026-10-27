<?php

declare(strict_types=1);

namespace Planner\Tests\Export;

use DateTimeImmutable;
use PHPUnit\Framework\TestCase;
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

    public function testLeavesOutAFreeStopFarFromEveryRoute(): void
    {
        $xml = $this->parse(TripGpx::day($this->document(), 1, new DateTimeImmutable()));
        self::assertSame('Alps – Day 2', (string) $xml->xpath('/g:gpx/g:metadata/g:name')[0]);
        self::assertSame(['Hotel Post'], array_map(fn ($w) => (string) $w->name, $xml->xpath('/g:gpx/g:wpt')));
        self::assertCount(2, $xml->xpath('/g:gpx/g:trk'));
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
