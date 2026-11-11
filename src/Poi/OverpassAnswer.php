<?php

declare(strict_types=1);

namespace Planner\Poi;

use Generator;

/**
 * An answer of the Overpass API to `OverpassQuery`, as the file it was saved to: a row of
 * tab-separated values per place. A query that runs out of time answers with what it had
 * and no word of it, so the query ends with a mark of its own, and an answer is complete
 * only where that mark is its last row.
 */
final class OverpassAnswer
{
    public const END_MARK = 'complete';

    private bool $complete = false;

    public function __construct(private readonly string $file, private readonly Kinds $kinds)
    {
    }

    /**
     * The places of the answer, of the kinds the planner knows and open to the public, each
     * with the tags its details are made of.
     *
     * @return Generator<array{id: string, kind: string, lng: float, lat: float, tags: array<string, string>}>
     */
    public function places(): Generator
    {
        $columns = OverpassQuery::columns($this->kinds);
        $this->complete = false;
        $rows = fopen($this->file, 'r');
        while (($row = fgets($rows)) !== false) {
            $values = explode("\t", rtrim($row, "\r\n"));
            if ($values[0] === self::END_MARK) {
                $this->complete = true;
                continue;
            }
            // A row of another shape is a value with a tab or a line break in it.
            if (count($values) !== count($columns) || !is_numeric($values[2]) || !is_numeric($values[3])) {
                continue;
            }
            $tags = array_filter(array_combine($columns, $values), fn (string $value) => $value !== '');
            $kind = $this->kinds->of($tags);
            if ($kind !== null) {
                yield ['id' => "$values[0]/$values[1]", 'kind' => $kind, 'lng' => (float) $values[3], 'lat' => (float) $values[2], 'tags' => array_intersect_key($tags, array_flip($this->kinds->detailTags))];
            }
        }
        fclose($rows);
    }

    /** Whether the answer ended with the query's mark, once its places have been read. */
    public function isComplete(): bool
    {
        return $this->complete;
    }
}
