<?php

declare(strict_types=1);

namespace Planner\Closures;

use RuntimeException;

/** Reads KML, the format of Google Earth's places. */
final class Kml
{
    /**
     * The placemarks of a KML document as a GeoJSON feature collection: a feature for each
     * point and each line, with the placemark's name and description. Styles are not kept.
     */
    public static function geoJson(string $kml): array
    {
        $document = @simplexml_load_string($kml);
        if ($document === false) {
            throw new RuntimeException('This is not a KML document.');
        }
        $features = [];
        foreach ($document->xpath('//*[local-name()="Placemark"]') as $placemark) {
            $properties = ['name' => trim((string) $placemark->name)];
            $description = trim((string) $placemark->description);
            if ($description !== '') {
                $properties['description'] = $description;
            }
            foreach ($placemark->xpath('.//*[local-name()="Point" or local-name()="LineString"]') as $geometry) {
                $positions = self::positions((string) $geometry->coordinates);
                if ($positions === []) {
                    continue;
                }
                $features[] = [
                    'type' => 'Feature',
                    'properties' => $properties,
                    'geometry' => $geometry->getName() === 'Point'
                        ? ['type' => 'Point', 'coordinates' => $positions[0]]
                        : ['type' => 'LineString', 'coordinates' => $positions],
                ];
            }
        }
        return ['type' => 'FeatureCollection', 'features' => $features];
    }

    /**
     * The positions of a KML coordinates text, "lng,lat,altitude" tuples separated by white
     * space, as [lng, lat] rounded to six decimals.
     *
     * @return list<array{float, float}>
     */
    private static function positions(string $coordinates): array
    {
        $positions = [];
        foreach (preg_split('/\s+/', trim($coordinates), flags: PREG_SPLIT_NO_EMPTY) as $tuple) {
            [$lng, $lat] = explode(',', $tuple) + [1 => ''];
            if (is_numeric($lng) && is_numeric($lat)) {
                $positions[] = [round((float) $lng, 6), round((float) $lat, 6)];
            }
        }
        return $positions;
    }
}
