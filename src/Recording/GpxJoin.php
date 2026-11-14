<?php

declare(strict_types=1);

namespace Planner\Recording;

/**
 * GPX files of one ride joined into one: the first file with the track segments of the
 * others after its own, every point as it was recorded. The files are joined as text,
 * since a recording is megabytes and is not to be read into a tree.
 */
final class GpxJoin
{
    /**
     * @param non-empty-list<string> $files in the order they were recorded
     * @throws Unmergeable
     */
    public static function of(array $files): string
    {
        $joined = array_shift($files);
        $segments = '';
        foreach ($files as $file) {
            $joined = self::withPrefixesOf($joined, $file);
            $segments .= self::segments($file);
        }
        $end = strrpos($joined, '</trk>');
        if ($end === false) {
            throw new Unmergeable('A recording without a track cannot be merged.');
        }
        return substr($joined, 0, $end) . $segments . substr($joined, $end);
    }

    /** The track segments of a file, as they stand in it. */
    private static function segments(string $gpx): string
    {
        $segments = '';
        for ($at = 0; ($from = strpos($gpx, '<trkseg', $at)) !== false; $at = $from + 7) {
            $to = strpos($gpx, '</trkseg>', $from);
            // An empty segment closes itself and has nothing to give.
            if ($to === false || !in_array($gpx[$from + 7], ['>', ' ', "\t", "\r", "\n"], true)) {
                continue;
            }
            $segments .= substr($gpx, $from, $to + 9 - $from) . "\n";
            $from = $to;
        }
        return $segments;
    }

    /**
     * The first file with the namespace prefixes the other declares on its root as well,
     * so that the other's points keep what their extensions mean.
     *
     * @throws Unmergeable for a prefix the two declare differently
     */
    private static function withPrefixesOf(string $gpx, string $other): string
    {
        $has = self::prefixes($gpx);
        $missing = '';
        foreach (self::prefixes($other) as $prefix => $namespace) {
            if (($has[$prefix] ?? $namespace) !== $namespace) {
                throw new Unmergeable('Recordings of apps that write their values differently under one name cannot be merged.');
            }
            if (!isset($has[$prefix])) {
                $missing .= " xmlns:$prefix=\"$namespace\"";
            }
        }
        $root = strpos($gpx, '<gpx');
        return $missing === '' || $root === false ? $gpx : substr_replace($gpx, $missing, strpos($gpx, '>', $root), 0);
    }

    /** @return array<string, string> the namespaces a file declares on its root, by prefix */
    private static function prefixes(string $gpx): array
    {
        $root = strpos($gpx, '<gpx');
        if ($root === false) {
            return [];
        }
        preg_match_all('/\sxmlns:([\w.-]+)\s*=\s*(["\'])(.*?)\2/', substr($gpx, $root, strpos($gpx, '>', $root) - $root), $found);
        return array_combine($found[1], $found[3]);
    }
}
