<?php

declare(strict_types=1);

namespace Planner\Poi;

use DateTimeImmutable;
use PDO;
use Planner\Http\Json;
use Planner\Timestamp;

/** The places kept for the map, fetched area by area and asked for tile by tile. */
final class Places
{
    public function __construct(private readonly PDO $db)
    {
    }

    /**
     * Puts the places of the answers in place of those kept for the area. Nothing changes
     * where an answer proves incomplete or the answers hold no place at all.
     *
     * @param list<OverpassAnswer> $answers
     * @return ?int the number of places kept; null where nothing was changed
     */
    public function replaceArea(string $area, array $answers, DateTimeImmutable $now): ?int
    {
        $this->db->beginTransaction();
        $this->db->prepare('DELETE FROM places WHERE area = ?')->execute([$area]);
        // A place on a border is in the answers of both sides; the area fetched last has it.
        $insert = $this->db->prepare('INSERT OR REPLACE INTO places (id, kind, lng, lat, tile_x, tile_y, tags, area) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $count = 0;
        foreach ($answers as $answer) {
            foreach ($answer->places() as $place) {
                [$x, $y] = Tile::of($place['lng'], $place['lat']);
                $insert->execute([$place['id'], $place['kind'], $place['lng'], $place['lat'], $x, $y, Json::encode((object) $place['tags']), $area]);
                $count++;
            }
            if (!$answer->isComplete()) {
                $this->db->rollBack();
                return null;
            }
        }
        if ($count === 0) {
            $this->db->rollBack();
            return null;
        }
        $this->db->prepare('INSERT OR REPLACE INTO place_areas (area, places, fetched_at) VALUES (?, ?, ?)')->execute([$area, $count, Timestamp::of($now)]);
        $this->db->commit();
        return $count;
    }

    /**
     * The places of the kinds in a tile, as the planner holds them.
     *
     * @param list<string> $kinds
     * @return list<array{id: string, kind: string, lngLat: array{float, float}, tags: object}>
     */
    public function inTile(int $x, int $y, array $kinds): array
    {
        if ($kinds === []) {
            return [];
        }
        $statement = $this->db->prepare('SELECT id, kind, lng, lat, tags FROM places WHERE tile_x = ? AND tile_y = ? AND kind IN (' . implode(',', array_fill(0, count($kinds), '?')) . ') ORDER BY id');
        $statement->execute([$x, $y, ...$kinds]);
        return array_map(
            fn (array $row) => ['id' => $row['id'], 'kind' => $row['kind'], 'lngLat' => [(float) $row['lng'], (float) $row['lat']], 'tags' => json_decode($row['tags'], false, 512, JSON_THROW_ON_ERROR)],
            $statement->fetchAll(),
        );
    }

    /** @return list<array{area: string, places: int, fetchedAt: string}> the areas places are kept of, by their code */
    public function areas(): array
    {
        return array_map(
            fn (array $row) => ['area' => $row['area'], 'places' => (int) $row['places'], 'fetchedAt' => $row['fetched_at']],
            $this->db->query('SELECT area, places, fetched_at FROM place_areas ORDER BY area')->fetchAll(),
        );
    }
}
