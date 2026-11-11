<?php

declare(strict_types=1);

namespace Planner\Poi;

use InvalidArgumentException;

/** The question put to the Overpass API for the places of an area. */
final class OverpassQuery
{
    /** Seconds the server may take: a large region with every kind takes minutes. */
    public const TIMEOUT_S = 900;

    /**
     * The columns of an answer: the element's type, id and position, the tags that say its
     * kind and whether it is open to the public, and the tags its details are made of.
     *
     * @return list<string>
     */
    public static function columns(Kinds $kinds): array
    {
        return array_values(array_unique(['::type', '::id', '::lat', '::lon', ...array_column($kinds->kinds, 'key'), 'access', ...$kinds->detailTags]));
    }

    /**
     * The query for the places of the kinds in an area, answered as tab-separated values
     * with a position for each and `OverpassAnswer::END_MARK` as the last row.
     *
     * @param string $area an ISO 3166-2 code such as "DE-RP", or an ISO 3166-1 code such as "CH" for a whole country
     * @param list<array{key: string, values: list<string>}> $kinds
     */
    public static function of(string $area, array $kinds, Kinds $all): string
    {
        if (preg_match('/^[A-Z]{2}(-[A-Z0-9]{1,3})?$/', $area) !== 1) {
            throw new InvalidArgumentException("$area is no ISO 3166 code of a country or of a region, such as CH or DE-RP.");
        }
        $columns = implode(',', array_map(fn (string $column) => str_starts_with($column, '::') ? $column : "\"$column\"", self::columns($all)));
        $areaFilter = str_contains($area, '-') ? "[\"ISO3166-2\"=\"$area\"]" : "[\"ISO3166-1\"=\"$area\"][admin_level=2]";
        $valuesByKey = [];
        foreach ($kinds as $kind) {
            $valuesByKey[$kind['key']] = [...$valuesByKey[$kind['key']] ?? [], ...$kind['values']];
        }
        $statements = '';
        foreach ($valuesByKey as $key => $values) {
            $statements .= sprintf('nwr["%s"~"^(%s)$"](area.a);', $key, implode('|', $values));
        }
        return sprintf('[out:csv(%s;false;"\t")][timeout:%d];area%s->.a;(%s);out center;make %s;out;', $columns, self::TIMEOUT_S, $areaFilter, $statements, OverpassAnswer::END_MARK);
    }
}
