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
     * Puts the places of the answer in place of those kept for the area of the kinds given,
     * and notes the fetch for each of them. Nothing changes where the answer proves
     * incomplete or the area would be left without any place.
     *
     * @param list<string> $kinds
     * @return ?int the number of places kept; null where nothing was changed
     */
    public function replaceKinds(string $area, array $kinds, OverpassAnswer $answer, DateTimeImmutable $now): ?int
    {
        $marks = implode(',', array_fill(0, count($kinds), '?'));
        $this->db->beginTransaction();
        $this->db->prepare("DELETE FROM places WHERE area = ? AND kind IN ($marks)")->execute([$area, ...$kinds]);
        // A place on a border is in the answers of both sides; the area fetched last has it.
        $insert = $this->db->prepare('INSERT OR REPLACE INTO places (id, kind, lng, lat, tile_x, tile_y, tags, area) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $counts = array_fill_keys($kinds, 0);
        foreach ($answer->places() as $place) {
            [$x, $y] = Tile::of($place['lng'], $place['lat']);
            $insert->execute([$place['id'], $place['kind'], $place['lng'], $place['lat'], $x, $y, Json::encode((object) $place['tags']), $area]);
            $counts[$place['kind']]++;
        }
        $any = $this->db->prepare('SELECT 1 FROM places WHERE area = ? LIMIT 1');
        $any->execute([$area]);
        if (!$answer->isComplete() || $any->fetchColumn() === false) {
            $this->db->rollBack();
            return null;
        }
        $note = $this->db->prepare('INSERT OR REPLACE INTO place_fetches (area, kind, places, fetched_at) VALUES (?, ?, ?, ?)');
        $at = Timestamp::of($now);
        foreach ($counts as $kind => $count) {
            $note->execute([$area, $kind, $count, $at]);
        }
        $this->db->commit();
        return array_sum($counts);
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

    /** @return list<array{area: string, kind: string, places: int, fetchedAt: string}> the last fetch of each kind in each area, by area and kind */
    public function fetches(): array
    {
        return array_map(
            fn (array $row) => ['area' => $row['area'], 'kind' => $row['kind'], 'places' => (int) $row['places'], 'fetchedAt' => $row['fetched_at']],
            $this->db->query('SELECT area, kind, places, fetched_at FROM place_fetches ORDER BY area, kind')->fetchAll(),
        );
    }
}
