<?php

declare(strict_types=1);

namespace Planner\Tests\Closures;

use PHPUnit\Framework\TestCase;
use Planner\Closures\MotorcycleClosures;
use RuntimeException;
use ZipArchive;

final class MotorcycleClosuresTest extends TestCase
{
    private const PLACEMARK = '<kml xmlns="http://www.opengis.net/kml/2.2"><Placemark><name>%s</name><Point><coordinates>8.5,49.25,0</coordinates></Point></Placemark></kml>';

    private string $dir;

    protected function setUp(): void
    {
        $this->dir = sys_get_temp_dir() . '/planner-closures-' . bin2hex(random_bytes(4));
        mkdir($this->dir);
    }

    protected function tearDown(): void
    {
        array_map('unlink', glob("$this->dir/*") ?: []);
        rmdir($this->dir);
    }

    /** @param array<string, string> $files */
    private function kmz(array $files): string
    {
        $zip = new ZipArchive();
        $zip->open("$this->dir/source.kmz", ZipArchive::CREATE | ZipArchive::OVERWRITE);
        foreach ($files as $name => $content) {
            $zip->addFromString($name, $content);
        }
        $zip->close();
        return "$this->dir/source.kmz";
    }

    public function testWritesThePlacemarksOfDocKmlAsGeoJson(): void
    {
        $source = $this->kmz(['a.kml' => sprintf(self::PLACEMARK, 'other'), 'doc.kml' => sprintf(self::PLACEMARK, 'Präg'), 'files/sign.png' => 'png']);
        self::assertSame(1, MotorcycleClosures::fetch("$this->dir/closures.geojson", $source));
        $geoJson = json_decode(file_get_contents("$this->dir/closures.geojson"), true);
        self::assertSame('Präg', $geoJson['features'][0]['properties']['name']);
        self::assertSame([8.5, 49.25], $geoJson['features'][0]['geometry']['coordinates']);
    }

    public function testTakesTheFirstKmlFileWhereThereIsNoDocKml(): void
    {
        $source = $this->kmz(['b.kml' => sprintf(self::PLACEMARK, 'b'), 'a.KML' => sprintf(self::PLACEMARK, 'a')]);
        MotorcycleClosures::fetch("$this->dir/closures.geojson", $source);
        self::assertStringContainsString('"name":"a"', file_get_contents("$this->dir/closures.geojson"));
    }

    public function testKeepsTheFileThereWhenTheSourceIsNoArchive(): void
    {
        file_put_contents("$this->dir/closures.geojson", 'kept');
        file_put_contents("$this->dir/source.kmz", '<html>gone</html>');
        try {
            MotorcycleClosures::fetch("$this->dir/closures.geojson", "$this->dir/source.kmz");
            self::fail('No exception.');
        } catch (RuntimeException) {
            self::assertSame('kept', file_get_contents("$this->dir/closures.geojson"));
        }
    }
}
