<?php

declare(strict_types=1);

namespace Planner\Export;

use DateTimeImmutable;
use Planner\Timestamp;
use XMLWriter;

/** Writes GPX 1.1: the waypoints first, then one track with one segment per line. */
final class Gpx
{
    /**
     * @param list<array{name: string, lngLat: array{0: float, 1: float}, type?: string}> $waypoints
     * @param list<array{name: string, points: list<array{0: float, 1: float}>}> $tracks
     */
    public static function document(string $name, array $waypoints, array $tracks, DateTimeImmutable $time): string
    {
        $xml = new XMLWriter();
        $xml->openMemory();
        $xml->setIndent(true);
        $xml->setIndentString('  ');
        $xml->startDocument('1.0', 'UTF-8');
        $xml->startElement('gpx');
        $xml->writeAttribute('version', '1.1');
        $xml->writeAttribute('creator', 'Trip Planner');
        $xml->writeAttribute('xmlns', 'http://www.topografix.com/GPX/1/1');
        $xml->writeAttribute('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance');
        $xml->writeAttribute('xsi:schemaLocation', 'http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd');
        $xml->startElement('metadata');
        $xml->writeElement('name', $name);
        $xml->writeElement('time', Timestamp::of($time));
        $xml->endElement();
        foreach ($waypoints as $waypoint) {
            $xml->startElement('wpt');
            self::position($xml, $waypoint['lngLat']);
            $xml->writeElement('name', $waypoint['name']);
            if (isset($waypoint['type'])) {
                $xml->writeElement('type', $waypoint['type']);
            }
            $xml->endElement();
        }
        foreach ($tracks as $track) {
            $xml->startElement('trk');
            $xml->writeElement('name', $track['name']);
            $xml->startElement('trkseg');
            foreach ($track['points'] as $point) {
                $xml->startElement('trkpt');
                self::position($xml, $point);
                $xml->endElement();
            }
            $xml->endElement();
            $xml->endElement();
        }
        $xml->endElement();
        $xml->endDocument();
        return $xml->outputMemory();
    }

    /** GPX wants -180 <= lon < 180. */
    private static function position(XMLWriter $xml, array $lngLat): void
    {
        $lng = fmod(fmod($lngLat[0] + 180, 360) + 360, 360) - 180;
        $xml->writeAttribute('lat', number_format($lngLat[1], 6, '.', ''));
        $xml->writeAttribute('lon', number_format($lng, 6, '.', ''));
    }
}
