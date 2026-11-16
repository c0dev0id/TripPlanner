<?php

declare(strict_types=1);

namespace Planner\Stash;

use DOMDocument;
use DOMElement;

/**
 * Changes to a GPX file of the Stash on the level of its routes, tracks and waypoints:
 * whole elements are taken or left as they are, and everything else in the file stays.
 */
final class GpxEdit
{
    /** What the routes, tracks and waypoints of a file are called in it. */
    private const ELEMENTS = ['route' => 'rte', 'track' => 'trk', 'waypoint' => 'wpt'];

    /**
     * The file with one of its tracks alone, for each of the places given among the
     * file's tracks: the other tracks, the routes and the waypoints left out. The file is
     * read once for all of them.
     *
     * @param list<int> $positions
     * @return array<int, string> the files, by the track's place
     */
    public static function tracksAlone(string $gpx, array $positions): array
    {
        $document = self::read($gpx);
        $tracks = self::elements($document, self::ELEMENTS['track']);
        $root = $document->documentElement;
        // A track stands alone where the last of the file's routes, tracks and waypoints stood: before what follows them.
        $after = null;
        foreach (iterator_to_array($root->childNodes) as $node) {
            if ($node instanceof DOMElement && in_array($node->localName, self::ELEMENTS, true)) {
                $after = $node->nextSibling;
                $root->removeChild($node);
            }
        }
        $alone = [];
        foreach ($positions as $position) {
            $root->insertBefore($tracks[$position], $after);
            $alone[$position] = (string) $document->saveXML();
            $root->removeChild($tracks[$position]);
        }
        return $alone;
    }

    /**
     * The file with one of its routes or tracks under a new name, by its kind and its
     * place among the file's elements of the kind; null where the file has none there.
     */
    public static function renamed(string $gpx, string $kind, int $position, string $name): ?string
    {
        $document = self::read($gpx);
        $element = self::elements($document, self::ELEMENTS[$kind])[$position] ?? null;
        if ($element === null) {
            return null;
        }
        $named = null;
        foreach ($element->childNodes as $node) {
            if ($node instanceof DOMElement && $node->localName === 'name') {
                $named = $node;
                break;
            }
        }
        // A route's and a track's name is their first element.
        $named ??= $element->insertBefore($document->createElementNS((string) $element->namespaceURI, 'name'), $element->firstChild);
        while ($named->firstChild !== null) {
            $named->removeChild($named->firstChild);
        }
        $named->appendChild($document->createTextNode($name));
        return (string) $document->saveXML();
    }

    /**
     * The file without the routes and tracks named, each by its kind and its place among
     * the file's elements of the kind; null where the file lacks one of them.
     *
     * @param list<array{kind: string, position: int}> $items
     */
    public static function without(string $gpx, array $items): ?string
    {
        $document = self::read($gpx);
        $doomed = [];
        foreach ($items as $item) {
            $doomed[] = self::elements($document, self::ELEMENTS[$item['kind']])[$item['position']] ?? null;
        }
        if (in_array(null, $doomed, true)) {
            return null;
        }
        foreach ($doomed as $element) {
            $element->parentNode?->removeChild($element);
        }
        return (string) $document->saveXML();
    }

    /**
     * The file with routes, tracks and waypoints of other files added as they stand in
     * those: of each source the routes and tracks named, each by its kind and its place
     * among the source's elements of the kind, and all its waypoints where asked. Each
     * goes after the file's own of its kind, in the order the format has them:
     * waypoints, routes, tracks. Null where a source lacks one of them.
     *
     * @param list<array{gpx: string, items: list<array{kind: string, position: int}>, waypoints: bool}> $sources
     */
    public static function with(string $gpx, array $sources): ?string
    {
        $document = self::read($gpx);
        $root = $document->documentElement;
        foreach ($sources as $source) {
            $from = self::read($source['gpx']);
            $taken = $source['waypoints'] ? self::elements($from, self::ELEMENTS['waypoint']) : [];
            foreach ($source['items'] as $item) {
                $taken[] = self::elements($from, self::ELEMENTS[$item['kind']])[$item['position']] ?? null;
            }
            if (in_array(null, $taken, true)) {
                return null;
            }
            foreach ($taken as $element) {
                $root->insertBefore($document->importNode($element, true), self::firstAfter($root, (string) $element->localName));
            }
        }
        return (string) $document->saveXML();
    }

    /** The first element of the file that the format has after those of the name, before which another of the name goes; null where it goes last. */
    private static function firstAfter(DOMElement $root, string $name): ?DOMElement
    {
        $order = ['wpt', 'rte', 'trk', 'extensions'];
        $later = array_slice($order, array_search($name, $order, true) + 1);
        foreach ($root->childNodes as $node) {
            if ($node instanceof DOMElement && in_array($node->localName, $later, true)) {
                return $node;
            }
        }
        return null;
    }

    private static function read(string $gpx): DOMDocument
    {
        $document = new DOMDocument();
        $document->loadXML($gpx, LIBXML_NONET);
        return $document;
    }

    /** @return list<DOMElement> the elements of the name directly in the file, in its order */
    private static function elements(DOMDocument $document, string $name): array
    {
        $found = [];
        foreach ($document->documentElement->childNodes ?? [] as $node) {
            if ($node instanceof DOMElement && $node->localName === $name) {
                $found[] = $node;
            }
        }
        return $found;
    }
}
