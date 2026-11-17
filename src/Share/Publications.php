<?php

declare(strict_types=1);

namespace Planner\Share;

use PDO;

/**
 * What the public page of a trip shows besides the plan: whether the journal is on it,
 * whether it offers the GPX file, and the entry whose photo stands at its top. As the
 * owner sets it, and as a visitor's token finds it.
 */
final class Publications
{
    public function __construct(private readonly PDO $db)
    {
    }

    /** @return ?array{token: ?string, journal: bool, gpx: bool, coverEntryId: ?int} the user's trip's, with the token its page is public under; null when the user has no such trip */
    public function of(int $userId, int $tripId): ?array
    {
        $trip = $this->trip('id = ? AND user_id = ?', [$tripId, $userId]);
        return $trip === null ? null : ['token' => $trip['share_token']] + self::shown($trip);
    }

    /** @return ?array{name: string, description: string, journal: bool, gpx: bool, coverEntryId: ?int} those of the trip shared under the token, with what its page is headed with; null when none is */
    public function shared(string $token): ?array
    {
        $trip = $this->trip('share_token = ?', [$token]);
        return $trip === null ? null : ['name' => $trip['name'], 'description' => $trip['description']] + self::shown($trip);
    }

    /** False when the user has no such trip. The cover is an entry of the trip's journal, which the caller has checked. */
    public function set(int $userId, int $tripId, bool $journal, bool $gpx, ?int $coverEntryId): bool
    {
        $statement = $this->db->prepare('UPDATE trips SET journal_published = ?, gpx_public = ?, cover_entry_id = ? WHERE id = ? AND user_id = ?');
        $statement->execute([(int) $journal, (int) $gpx, $coverEntryId, $tripId, $userId]);
        return $statement->rowCount() === 1;
    }

    private function trip(string $where, array $params): ?array
    {
        $statement = $this->db->prepare("SELECT name, description, share_token, journal_published, gpx_public, cover_entry_id FROM trips WHERE $where");
        $statement->execute($params);
        $trip = $statement->fetch();
        return $trip === false ? null : $trip;
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
