<?php

declare(strict_types=1);

namespace Planner\Recording;

use XMLReader;

/**
 * GPX files of one ride joined into one: the first file with the track segments of the
 * others after its own, every point as it was recorded. The files are read as a stream
 * and joined as text, since a recording is megabytes and is not to be read into a tree;
 * a segment is copied with the namespaces it uses declared on it.
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
        if (preg_match_all('~</(?:[\w.-]+:)?trk\s*>~', $joined, $ends, PREG_OFFSET_CAPTURE) === 0) {
            throw new Unmergeable('A recording without a track cannot be merged.');
        }
        $end = $ends[0][array_key_last($ends[0])][1];
        return substr($joined, 0, $end) . $segments . substr($joined, $end);
    }

    /** The track segments of a file that hold anything, each with the namespaces it uses. */
    private static function segments(string $gpx): string
    {
        $reader = XMLReader::fromString($gpx, null, LIBXML_NONET);
        $segments = '';
        $more = $reader->read();
        while ($more) {
            if ($reader->nodeType === XMLReader::ELEMENT && $reader->localName === 'trkseg') {
                $segments .= $reader->isEmptyElement ? '' : $reader->readOuterXml() . "\n";
                $more = $reader->next();
            } else {
                $more = $reader->read();
            }
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
                throw new Unmergeable('Recordings from apps that store the same value in different ways cannot be merged.');
            }
            if (!isset($has[$prefix])) {
                $missing .= " xmlns:$prefix=\"$namespace\"";
            }
        }
        if ($missing === '') {
            return $gpx;
        }
        preg_match('~<(?:[\w.-]+:)?gpx[\s>]~', $gpx, $root, PREG_OFFSET_CAPTURE);
        return substr_replace($gpx, $missing, strpos($gpx, '>', $root[0][1]), 0);
    }

    /** @return array<string, string> the namespaces a file declares on its root, which a recording kept has, by prefix */
    private static function prefixes(string $gpx): array
    {
        $reader = XMLReader::fromString($gpx, null, LIBXML_NONET);
        while ($reader->read() && $reader->nodeType !== XMLReader::ELEMENT) {
        }
        $found = [];
        while ($reader->moveToNextAttribute()) {
            if ($reader->prefix === 'xmlns') {
                $found[$reader->localName] = $reader->value;
            }
        }
        return $found;
    }
}
