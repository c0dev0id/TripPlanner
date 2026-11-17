<?php

declare(strict_types=1);

namespace Planner\Share;

use PDO;
use Planner\Database;

/**
 * What the public page of a trip shows besides the plan: whether the journal is on it,
 * whether it offers GPX files, the entry whose photo stands at its top, and the routes
 * and tracks it leaves out. As the owner sets it, and as a visitor's token finds it.
 */
final class Publications
{
    public function __construct(private readonly PDO $db)
    {
    }

    /** @return ?array{token: ?string, journal: bool, gpx: bool, coverEntryId: ?int, hiddenRouteIds: list<string>} the user's trip's, with the token its page is public under; null when the user has no such trip */
    public function of(int $userId, int $tripId): ?array
    {
        $trip = $this->trip('id = ? AND user_id = ?', [$tripId, $userId]);
        return $trip === null ? null : ['token' => $trip['share_token']] + self::shown($trip) + ['hiddenRouteIds' => $this->hiddenRouteIds((int) $trip['id'])];
    }

    /** @return ?array{name: string, description: string, journal: bool, gpx: bool, coverEntryId: ?int} what the page of the trip shared under the token shows, with what it is headed with; null when none is */
    public function shared(string $token): ?array
    {
        $trip = $this->trip('share_token = ?', [$token]);
        return $trip === null ? null : ['name' => $trip['name'], 'description' => $trip['description']] + self::shown($trip);
    }

    /**
     * False when the user has no such trip. The cover is an entry of the trip's journal,
     * which the caller has checked; of the routes to leave out, those of the trip count.
     *
     * @param list<string> $hiddenRouteIds
     */
    public function set(int $userId, int $tripId, bool $journal, bool $gpx, ?int $coverEntryId, array $hiddenRouteIds): bool
    {
        $this->db->beginTransaction();
        $statement = $this->db->prepare('UPDATE trips SET journal_published = ?, gpx_public = ?, cover_entry_id = ? WHERE id = ? AND user_id = ?');
        $statement->execute([(int) $journal, (int) $gpx, $coverEntryId, $tripId, $userId]);
        $found = $statement->rowCount() === 1;
        if ($found) {
            $ofTrip = 'day_id IN (SELECT id FROM days WHERE trip_id = ?)';
            $hidden = $hiddenRouteIds === [] ? '0' : 'id IN (' . Database::placeholders($hiddenRouteIds) . ')';
            $this->db->prepare("UPDATE routes SET public = NOT ($hidden) WHERE $ofTrip")->execute([...$hiddenRouteIds, $tripId]);
        }
        $this->db->commit();
        return $found;
    }

    private function trip(string $where, array $params): ?array
    {
        $statement = $this->db->prepare("SELECT id, name, description, share_token, journal_published, gpx_public, cover_entry_id FROM trips WHERE $where");
        $statement->execute($params);
        $trip = $statement->fetch();
        return $trip === false ? null : $trip;
    }

    /** @return list<string> the routes and tracks the trip's page leaves out */
    public function hiddenRouteIds(int $tripId): array
    {
        $hidden = $this->db->prepare('SELECT r.id FROM routes r JOIN days d ON d.id = r.day_id WHERE d.trip_id = ? AND r.public = 0 ORDER BY d.position, r.position');
        $hidden->execute([$tripId]);
        return $hidden->fetchAll(PDO::FETCH_COLUMN);
    }

    /** @return array{journal: bool, gpx: bool, coverEntryId: ?int} */
    private static function shown(array $trip): array
    {
        return [
            'journal' => (bool) $trip['journal_published'],
            'gpx' => (bool) $trip['gpx_public'],
            'coverEntryId' => $trip['cover_entry_id'] === null ? null : (int) $trip['cover_entry_id'],
        ];
    }
}
