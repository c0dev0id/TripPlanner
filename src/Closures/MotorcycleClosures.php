<?php

declare(strict_types=1);

namespace Planner\Closures;

use Planner\Download;
use RuntimeException;
use ZipArchive;

/**
 * The roads closed to motorcycles that mintelonline.de collects as a KMZ file, fetched on
 * the server and kept as GeoJSON for the map: the file's server does not let a web page
 * read it.
 */
final class MotorcycleClosures
{
    private const SOURCE = 'https://www.mintelonline.de/streckensperrungen/Streckensperrungen_Motorrad.kmz';

    /**
     * Fetches the KMZ file and writes its placemarks to `file` as GeoJSON, replacing what
     * was there only once the new file is read.
     *
     * @return int the number of features written
     */
    public static function fetch(string $file, string $source = self::SOURCE): int
    {
        $geoJson = Kml::geoJson(self::kmzDocument(Download::get($source, 'make closures')));
        if ($geoJson['features'] === []) {
            throw new RuntimeException("$source holds no placemarks.");
        }
        file_put_contents("$file.new", json_encode($geoJson, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        rename("$file.new", $file);
        return count($geoJson['features']);
    }

    /** The main KML document of a KMZ archive: doc.kml, or else the first KML file in it. */
    private static function kmzDocument(string $kmz): string
    {
        $archiveFile = tempnam(sys_get_temp_dir(), 'kmz');
        file_put_contents($archiveFile, $kmz);
        $zip = new ZipArchive();
        try {
            if ($zip->open($archiveFile, ZipArchive::RDONLY) !== true) {
                throw new RuntimeException('This is not a KMZ archive.');
            }
            $names = [];
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $names[] = $zip->getNameIndex($i);
            }
            $names = preg_grep('/\.kml$/i', $names);
            sort($names);
            $name = in_array('doc.kml', $names, true) ? 'doc.kml' : ($names[0] ?? null);
            if ($name === null) {
                throw new RuntimeException('The KMZ archive holds no KML document.');
            }
            return $zip->getFromName($name);
        } finally {
            unlink($archiveFile);
        }
    }
}
