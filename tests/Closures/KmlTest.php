<?php

declare(strict_types=1);

namespace Planner\Tests\Closures;

use PHPUnit\Framework\TestCase;
use Planner\Closures\Kml;
use RuntimeException;

final class KmlTest extends TestCase
{
    private const KML = <<<'XML'
        <?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
          <Style id="red"><LineStyle><color>ff0000ff</color></LineStyle></Style>
          <Folder>
            <name>Strecke</name>
            <Placemark>
              <name>Sa-So -Hohnstein</name>
              <description><![CDATA[Seit 2019<br/>gesperrt]]></description>
              <styleUrl>#red</styleUrl>
              <MultiGeometry>
                <LineString><coordinates>
                  14.0908385441,50.9842730127,0 14.09090995,50.98409414,0
                </coordinates></LineString>
                <LineString><coordinates>14.2,50.9,0 14.3,50.8,0</coordinates></LineString>
              </MultiGeometry>
            </Placemark>
          </Folder>
          <Folder>
            <Placemark><name> -Dorf </name><Point><coordinates>8.5,49.25</coordinates></Point></Placemark>
            <Placemark><name>Nowhere</name></Placemark>
            <Placemark><name>Empty</name><Point><coordinates> </coordinates></Point></Placemark>
          </Folder>
        </Document>
        </kml>
        XML;

    public function testMakesAFeatureOfEachPointAndLineWithThePlacemarksNameAndDescription(): void
    {
        $closure = ['name' => 'Sa-So -Hohnstein', 'description' => 'Seit 2019<br/>gesperrt'];
        self::assertSame([
            'type' => 'FeatureCollection',
            'features' => [
                ['type' => 'Feature', 'properties' => $closure, 'geometry' => ['type' => 'LineString', 'coordinates' => [[14.090839, 50.984273], [14.09091, 50.984094]]]],
                ['type' => 'Feature', 'properties' => $closure, 'geometry' => ['type' => 'LineString', 'coordinates' => [[14.2, 50.9], [14.3, 50.8]]]],
                ['type' => 'Feature', 'properties' => ['name' => '-Dorf'], 'geometry' => ['type' => 'Point', 'coordinates' => [8.5, 49.25]]],
            ],
        ], Kml::geoJson(self::KML));
    }

    public function testRefusesWhatIsNoXml(): void
    {
        $this->expectException(RuntimeException::class);
        Kml::geoJson('PK not xml');
    }
}
