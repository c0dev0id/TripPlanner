<?php

declare(strict_types=1);

namespace Planner\Poi;

use PDO;

/**
 * The places a user keeps: the stops of the lists in the folder for places and the folders
 * in it, each with its list and, as its kind, the section of the list it is in.
 */
final class OwnPlaces
{
    public function __construct(private readonly PDO $db)
    {
    }

    /** @return list<array<string, mixed>> the user's places by list, kind and name */
    public function of(int $userId): array
    {
        $statement = $this->db->prepare(
            "WITH RECURSIVE inside(id) AS (SELECT id FROM folders WHERE user_id = ? AND kind = 'places' UNION ALL SELECT f.id FROM folders f JOIN inside ON f.parent_id = inside.id)
             SELECT s.id, s.name, s.symbol, s.lng, s.lat, s.address, s.contact, s.website, s.notes, d.id AS day_id, d.name AS kind, t.id AS trip_id, t.name AS list
             FROM stops s JOIN days d ON d.id = s.day_id JOIN trips t ON t.id = d.trip_id
             WHERE t.folder_id IN (SELECT id FROM inside) ORDER BY t.name COLLATE NOCASE, t.id, d.position, s.name COLLATE NOCASE, s.id",
        );
        $statement->execute([$userId]);
        return array_map(fn (array $row) => [
            'id' => $row['id'],
            'name' => $row['name'],
            'symbol' => $row['symbol'],
            'lngLat' => [(float) $row['lng'], (float) $row['lat']],
            'address' => $row['address'],
            'contact' => $row['contact'],
            'website' => $row['website'],
            'notes' => $row['notes'],
            'tripId' => (int) $row['trip_id'],
            'list' => $row['list'],
            'dayId' => $row['day_id'],
            'kind' => $row['kind'],
        ], $statement->fetchAll());
    }
}
