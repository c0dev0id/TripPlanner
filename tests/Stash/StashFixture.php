<?php

declare(strict_types=1);

namespace Planner\Tests\Stash;

final class StashFixture
{
    /** A file with two waypoints, a route of two points with Garmin's way between them, a track of two segments with times and a track without. */
    public static function gpx(string $routeName = 'Over the pass'): string
    {
        return <<<XML
            <?xml version="1.0" encoding="UTF-8"?>
            <gpx version="1.1" creator="Test" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxx="http://www.garmin.com/xmlschemas/GpxExtensions/v3">
              <metadata><name>A day out</name></metadata>
              <wpt lat="49.4" lon="8.7"><name>Start</name></wpt>
              <wpt lat="49.5" lon="8.8"><name>End</name><sym>Flag, Blue</sym></wpt>
              <rte>
                <name>$routeName</name>
                <rtept lat="49.4" lon="8.7"><name>Start</name><extensions><gpxx:RoutePointExtension><gpxx:rpt lat="49.45" lon="8.75"/></gpxx:RoutePointExtension></extensions></rtept>
                <rtept lat="49.4" lon="8.8"><name>Turn</name></rtept>
              </rte>
              <trk>
                <name>Morning</name>
                <trkseg>
                  <trkpt lat="49.4" lon="8.7"><ele>120</ele><time>2025-07-08T15:24:36Z</time></trkpt>
                  <trkpt lat="49.4" lon="8.8"><ele>130</ele><time>2025-07-08T15:34:36Z</time></trkpt>
                </trkseg>
                <trkseg>
                  <trkpt lat="49.5" lon="8.8"><ele>140</ele><time>2025-07-08T15:54:36Z</time></trkpt>
                </trkseg>
              </trk>
              <trk>
                <trkseg><trkpt lat="49.0" lon="8.0"/><trkpt lat="49.1" lon="8.1"/></trkseg>
              </trk>
            </gpx>
            XML;
    }
}
