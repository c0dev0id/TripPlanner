<?php

declare(strict_types=1);

namespace Planner\Tests\Stash;

use PHPUnit\Framework\TestCase;
use Planner\Export\Polyline;
use Planner\Stash\GpxIndex;

final class GpxIndexTest extends TestCase
{
    public function testListsRoutesAndTracksByTheirPlaceAndCountsTheWaypoints(): void
    {
        $index = GpxIndex::of(StashFixture::gpx());
        self::assertSame(2, $index->waypoints);
        self::assertSame(
            [['route', 0, 'Over the pass', 2], ['track', 0, 'Morning', 3], ['track', 1, '', 2]],
            array_map(fn (array $item) => [$item['kind'], $item['position'], $item['name'], $item['points']], $index->items),
        );
    }

    public function testATracksLineLengthAndStartComeFromItsPoints(): void
    {
        $track = GpxIndex::of(StashFixture::gpx())->items[1];
        self::assertSame([[8.7, 49.4], [8.8, 49.4], [8.8, 49.5]], Polyline::decode($track['line']));
        // 0.1° east at 49.4° north, 7.2 km, then 0.1° north, 11.1 km.
        self::assertEqualsWithDelta(18_360, $track['distanceM'], 60);
        self::assertSame('2025-07-08T15:24:36Z', $track['startedAt']);
        self::assertNull(GpxIndex::of(StashFixture::gpx())->items[2]['startedAt']);
    }

    public function testARoutesLineFollowsTheWayGarminGivesBetweenItsPoints(): void
    {
        $route = GpxIndex::of(StashFixture::gpx())->items[0];
        self::assertSame([[8.7, 49.4], [8.75, 49.45], [8.8, 49.4]], Polyline::decode($route['line']));
        self::assertNull($route['startedAt']);
    }

    public function testReadsEveryPointOfATrackWhateverItsPointsHoldAndWhatFollowsIt(): void
    {
        $point = fn (float $lat, string $time) => "<trkpt lat=\"$lat\" lon=\"8.7\"><ele>1</ele><time>$time</time><extensions><speed>3</speed><x><hr>120</hr></x></extensions></trkpt>";
        $gpx = '<gpx><trk><name>First</name><trkseg>' . $point(49.4, '2025-07-08T15:24:36Z') . $point(49.5, 'x') . '</trkseg><trkseg>' . $point(49.6, 'y') . '</trkseg></trk>'
            . '<trk><name>Second</name><trkseg><trkpt lat="49.0" lon="8.0"/><trkpt lat="49.1" lon="8.0"><time>2025-07-09T08:00:00Z</time></trkpt><trkpt lat="49.2" lon="8.0"/></trkseg></trk><wpt lat="1" lon="1"/></gpx>';
        $index = GpxIndex::of($gpx);
        self::assertSame([['First', 3, '2025-07-08T15:24:36Z'], ['Second', 3, '2025-07-09T08:00:00Z']], array_map(fn (array $item) => [$item['name'], $item['points'], $item['startedAt']], $index->items));
        self::assertSame(1, $index->waypoints);
        self::assertEqualsWithDelta(22_240, $index->items[0]['distanceM'], 60);
    }

    public function testSaysWhatRoutesAndTracksCarryOnTheirPointsAndOfGarminsExtensions(): void
    {
        $features = array_column(GpxIndex::of(StashFixture::gpx())->items, 'features');
        self::assertSame([['routePointExtension'], ['time', 'elevation'], []], $features);
    }

    public function testSaysThatARouteCarriesGarminsTripPlanning(): void
    {
        $trp = 'xmlns:trp="http://www.garmin.com/xmlschemas/TripExtensions/v1"';
        $gpx = "<gpx $trp><rte><rtept lat=\"49.4\" lon=\"8.7\"><extensions><trp:ViaPoint><trp:DepartureTime>2025-07-08T08:00:00Z</trp:DepartureTime></trp:ViaPoint></extensions></rtept>"
            . '<rtept lat="49.5" lon="8.7"><extensions><trp:ShapingPoint/></extensions></rtept></rte><rte><rtept lat="49.4" lon="8.7"/></rte></gpx>';
        $items = GpxIndex::of($gpx)->items;
        self::assertSame([['tripExtension'], []], array_column($items, 'features'));
        self::assertSame('2025-07-08T08:00:00Z', $items[0]['startedAt']);
    }

    public function testValuesCountOnPointsHoweverTheFileWritesThemAndNotBesideThem(): void
    {
        $ridelink = '<gpx xmlns:rl="r"><trk><extensions><rl:summary><rl:lean_angle>3</rl:lean_angle></rl:summary></extensions><trkseg>'
            . '<trkpt lat="49.4" lon="8.7"><extensions><rl:ele>120</rl:ele></extensions></trkpt>'
            . '<trkpt lat="49.5" lon="8.7"><extensions><rl:speed>7</rl:speed><rl:acc_x>0.2</rl:acc_x></extensions></trkpt></trkseg></trk>'
            . '<rte><extensions><gpxx:RouteExtension xmlns:gpxx="http://www.garmin.com/xmlschemas/GpxExtensions/v3"><gpxx:IsAutoNamed>false</gpxx:IsAutoNamed></gpxx:RouteExtension></extensions>'
            . '<rtept lat="49.4" lon="8.7"><ele>100</ele></rtept><rtept lat="49.5" lon="8.7"/></rte></gpx>';
        self::assertSame([['elevation', 'acceleration'], ['elevation', 'routeExtension']], array_column(GpxIndex::of($ridelink)->items, 'features'));
    }

    public function testNamesWhoseExtensionARouteOrTrackCarriesByItsNamespace(): void
    {
        $gpx = '<gpx xmlns:d="https://dmdnavigation.com/ns/gpx/1" xmlns:r="https://www.rumoadventures.com/xmlschemas/GpxExtensions/v1">'
            . '<rte><extensions><d:PreRendered><d:CalculatedRoute>49.4,8.7,97.0</d:CalculatedRoute></d:PreRendered></extensions><rtept lat="49.4" lon="8.7"/></rte>'
            . '<rte><extensions><r:RouteExtension><r:RoutingProfile>fast</r:RoutingProfile></r:RouteExtension></extensions><rtept lat="49.4" lon="8.7"/></rte>'
            . '<trk><extensions><d:Stats/></extensions><trkseg><trkpt lat="49.4" lon="8.7"/></trkseg></trk></gpx>';
        self::assertSame([['dmd'], ['rumo'], ['dmd']], array_column(GpxIndex::of($gpx)->items, 'features'));
    }

    public function testSaysWhatWroteTheFileAndWhenByItsHead(): void
    {
        $garmin = '<gpx creator=" Garmin Desktop App "><metadata><link href="x"><text>t</text><time>2001-01-01T00:00:00Z</time></link><time>2024-07-14T18:08:55Z</time></metadata>'
            . '<rte><rtept lat="49.4" lon="8.7"><time>2024-06-19T20:02:06Z</time></rtept></rte></gpx>';
        $index = GpxIndex::of($garmin);
        self::assertSame(['Garmin Desktop App', '2024-07-14T18:08:55Z'], [$index->creator, $index->exportedAt]);
        $old = GpxIndex::of('<gpx version="1.0" creator="MapSource"><time>2014-06-14T06:18:00Z</time><rte/></gpx>');
        self::assertSame(['MapSource', '2014-06-14T06:18:00Z'], [$old->creator, $old->exportedAt]);
        $bare = GpxIndex::of('<gpx><trk><trkseg><trkpt lat="1" lon="1"><time>2024-07-14T18:08:55Z</time></trkpt></trkseg></trk></gpx>');
        self::assertSame([null, null], [$bare->creator, $bare->exportedAt]);
    }

    public function testARouteStartsWhenItsFirstPointIsPlannedToBeLeft(): void
    {
        $trip = 'xmlns:trp="http://www.garmin.com/xmlschemas/TripExtensions/v1"';
        $point = fn (string $made, string $leaves) => "<rtept lat=\"49.4\" lon=\"8.7\"><time>$made</time><extensions><trp:ViaPoint><trp:DepartureTime>$leaves</trp:DepartureTime></trp:ViaPoint>"
            . '<gpxx:RoutePointExtension xmlns:gpxx="http://www.garmin.com/xmlschemas/GpxExtensions/v3"><gpxx:rpt lat="49.45" lon="8.75"/></gpxx:RoutePointExtension></extensions></rtept>';
        $gpx = "<gpx $trip><rte>" . $point('2024-06-19T20:02:06Z', '2024-07-14T10:00:00Z') . $point('2024-06-19T20:05:00Z', '2024-07-14T12:30:00Z') . '</rte>'
            . '<rte><rtept lat="49.4" lon="8.7"><time>2024-06-19T20:02:06Z</time><extensions><x:DepartureTime xmlns:x="other">2024-07-14T10:00:00Z</x:DepartureTime></extensions></rtept></rte></gpx>';
        self::assertSame(['2024-07-14T10:00:00Z', null], array_column(GpxIndex::of($gpx)->items, 'startedAt'));
    }

    public function testAFileThatIsNoXmlHoldsNothing(): void
    {
        $index = GpxIndex::of('not a file');
        self::assertSame([0, []], [$index->waypoints, $index->items]);
    }
}
