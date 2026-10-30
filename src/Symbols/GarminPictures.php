<?php

declare(strict_types=1);

namespace Planner\Symbols;

/**
 * Garmin's pictures of its waypoint symbols, fetched from GPS Visualizer's copies for the
 * app to show. They are Garmin's artwork, so they are fetched on the server rather than
 * kept in the repository.
 */
final class GarminPictures
{
    public const SOURCE = 'https://www.gpsvisualizer.com/google_maps/icons/garmin/24x24/';

    /**
     * Fetches the picture of every symbol the list names into `dir`, as the symbol's name with
     * a slash made a dash and ".png"; pictures already there are kept.
     *
     * @return array{fetched: int, kept: int, missing: list<string>} the symbols without a picture at the source
     */
    public static function fetch(string $listFile, string $dir, string $source = self::SOURCE): array
    {
        $groups = json_decode((string) file_get_contents($listFile), true, flags: JSON_THROW_ON_ERROR);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        $context = stream_context_create(['http' => ['timeout' => 20, 'user_agent' => 'Trip Planner (make garmin-icons)']]);
        $result = ['fetched' => 0, 'kept' => 0, 'missing' => []];
        foreach (array_merge(...array_column($groups, 'names')) as $name) {
            $file = str_replace('/', '-', $name) . '.png';
            if (is_file("$dir/$file")) {
                $result['kept']++;
                continue;
            }
            $png = @file_get_contents($source . rawurlencode($file), context: $context);
            if ($png === false || !str_starts_with($png, "\x89PNG")) {
                $result['missing'][] = $name;
                continue;
            }
            file_put_contents("$dir/$file", $png);
            $result['fetched']++;
        }
        return $result;
    }
}
