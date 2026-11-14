<?php

declare(strict_types=1);

namespace Planner\Tests\Recording;

use PHPUnit\Framework\TestCase;
use Planner\Recording\GpxJoin;
use Planner\Recording\TrackSummary;
use Planner\Recording\Unmergeable;

final class GpxJoinTest extends TestCase
{
    public function testPutsTheSegmentsOfTheOthersAfterThoseOfTheFirst(): void
    {
        $first = self::gpx('xmlns:rl="https://ridelink.example/v1"', '<trkseg><trkpt lat="48.1" lon="11.5"><time>2027-06-12T08:00:00Z</time><extensions><rl:speed>7</rl:speed></extensions></trkpt></trkseg>');
        $second = self::gpx('xmlns:rl="https://ridelink.example/v1"', "<trkseg/><trkseg>\n<trkpt lat=\"48.2\" lon=\"11.5\"><extensions><rl:speed>9</rl:speed></extensions></trkpt></trkseg><trkseg><trkpt lat=\"48.3\" lon=\"11.5\"/></trkseg>");
        $joined = GpxJoin::of([$first, $second]);

        $xml = simplexml_load_string($joined);
        self::assertNotFalse($xml);
        self::assertCount(1, $xml->trk);
        self::assertSame(['48.1', '48.2', '48.3'], array_map(fn ($point) => (string) $point['lat'], $xml->xpath('//*[local-name()="trkpt"]')));
        self::assertSame(1, substr_count($joined, 'xmlns:rl='));
        self::assertSame('2027-06-12T08:00:00Z', TrackSummary::of($joined)->startedAt);
        self::assertSame($first, GpxJoin::of([$first]));
    }

    public function testCarriesOverThePrefixesTheOthersPointsNeed(): void
    {
        $first = self::gpx('xmlns:rl="https://ridelink.example/v1"', '<trkseg><trkpt lat="48.1" lon="11.5"/></trkseg>');
        $other = self::gpx("xmlns:sc='https://scenic.example/1'", '<trkseg><trkpt lat="48.2" lon="11.5"><extensions><sc:lean>3</sc:lean></extensions></trkpt></trkseg>');
        $joined = GpxJoin::of([$first, $other]);
        self::assertStringContainsString('xmlns:rl="https://ridelink.example/v1" xmlns:sc="https://scenic.example/1">', $joined);
        self::assertNotFalse(simplexml_load_string($joined));
    }

    public function testRefusesAPrefixDeclaredDifferentlyAndAFileWithoutATrack(): void
    {
        $first = self::gpx('xmlns:x="https://one.example"', '<trkseg><trkpt lat="48.1" lon="11.5"/></trkseg>');
        foreach ([[$first, self::gpx('xmlns:x="https://other.example"', '<trkseg><trkpt lat="48.2" lon="11.5"/></trkseg>')], ['<gpx><wpt lat="1" lon="1"/></gpx>', $first]] as $files) {
            try {
                GpxJoin::of($files);
                self::fail('Joined what cannot be joined.');
            } catch (Unmergeable) {
            }
        }
        $this->addToAssertionCount(2);
    }

    private static function gpx(string $prefixes, string $segments): string
    {
        return "<?xml version=\"1.0\"?>\n<gpx version=\"1.1\" xmlns=\"http://www.topografix.com/GPX/1/1\"\n  $prefixes>\n<trk><name>Ride</name>$segments</trk>\n</gpx>";
    }
}
