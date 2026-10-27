<?php

declare(strict_types=1);

namespace Planner\Tests\Export;

use DateTimeImmutable;
use PHPUnit\Framework\TestCase;
use Planner\Export\TripGpx;
use Planner\Tests\Trip\TripFixture;
use SimpleXMLElement;

final class TripGpxTest extends TestCase
{
    private const GPX = 'http://www.topografix.com/GPX/1/1';

    private function document(): array
    {
        $document = TripFixture::document();
        $document['places'][] = TripFixture::place('cafe', 'Café & Bar', [11.45, 47.8]);
        $document['days'][0]['stops'] = [TripFixture::stop('s1', 'home'), TripFixture::stop('s3', 'cafe'), TripFixture::stop('s2', 'hotel')];
        $document['days'][0]['routes'] = [TripFixture::route('r1', [11.5, 48.1], [11.45, 47.8]), TripFixture::route('r2', [11.45, 47.8], [11.4, 47.3])];
        $document['days'][] = [
            'id' => 'day2',
            'name' => '',
            'date' => null,
            'notes' => '',
            'stops' => [TripFixture::stop('s4', 'hotel'), TripFixture::stop('s5', 'home')],
            'routes' => [TripFixture::route('r3', [11.4, 47.3], [11.5, 48.1])],
        ];
        return $document;
    }

    public function testWritesTheTripAsWaypointsAndOneTrackPerRoute(): void
    {
        $xml = new SimpleXMLElement(TripGpx::trip($this->document(), new DateTimeImmutable('2026-10-27T10:00:00+02:00')));
        $xml->registerXPathNamespace('g', self::GPX);
        self::assertSame('Alps', (string) $xml->xpath('/g:gpx/g:metadata/g:name')[0]);
        self::assertSame('2026-10-27T08:00:00Z', (string) $xml->xpath('/g:gpx/g:metadata/g:time')[0]);
        $waypoints = $xml->xpath('/g:gpx/g:wpt');
        self::assertSame(['Home', 'Café & Bar', 'Hotel Post'], array_map(fn ($w) => (string) $w->name, $waypoints));
        self::assertSame('hotel', (string) $waypoints[2]->type);
        self::assertSame('47.300000', (string) $waypoints[2]['lat']);
        self::assertSame('11.400000', (string) $waypoints[2]['lon']);
        $tracks = $xml->xpath('/g:gpx/g:trk');
        self::assertSame(['Day 1 South: Home – Café & Bar', 'Day 1 South: Café & Bar – Hotel Post', 'Day 2: Hotel Post – Home'], array_map(fn ($t) => (string) $t->name, $tracks));
        self::assertCount(2, $tracks[0]->trkseg->trkpt);
    }

    public function testWritesOneDayAlone(): void
    {
        $xml = new SimpleXMLElement(TripGpx::day($this->document(), 1, new DateTimeImmutable()));
        $xml->registerXPathNamespace('g', self::GPX);
        self::assertSame('Alps – Day 2', (string) $xml->xpath('/g:gpx/g:metadata/g:name')[0]);
        self::assertSame(['Hotel Post', 'Home'], array_map(fn ($w) => (string) $w->name, $xml->xpath('/g:gpx/g:wpt')));
        self::assertCount(1, $xml->xpath('/g:gpx/g:trk'));
    }

    public function testNamesFilesFromTheTripAndDay(): void
    {
        self::assertSame('Alps-Day-1-South', TripGpx::dayFileName($this->document(), 0));
        self::assertSame('Alps-Day-2', TripGpx::dayFileName($this->document(), 1));
        self::assertSame('Südtirol-2027', TripGpx::fileName('Südtirol / 2027!'));
        self::assertSame('trip', TripGpx::fileName('???'));
    }
}
