<?php

declare(strict_types=1);

namespace Planner\Share;

use PDO;

/**
 * The picture a shared trip's link is shown with where it is posted. It is made in the
 * owner's browser and kept with a mark of what it was made of, by which the browser
 * knows whether to make it anew.
 */
final class Cards
{
    public const WIDTH = 1200;
    public const HEIGHT = 630;
    public const MAX_BYTES = 1_000_000;

    public function __construct(private readonly PDO $db)
    {
    }

    /** Whether the bytes are a card: a JPEG of the card's size, no larger than a card may be. */
    public static function isCard(string $image): bool
    {
        $size = strlen($image) <= self::MAX_BYTES ? @getimagesizefromstring($image) : false;
        return $size !== false && [$size[0], $size[1], $size[2]] === [self::WIDTH, self::HEIGHT, IMAGETYPE_JPEG];
    }

    /** Keeps the card of the user's trip in the place of the one it had. False when the user has no such trip. */
    public function put(int $userId, int $tripId, string $madeOf, string $image): bool
    {
        $statement = $this->db->prepare('INSERT OR REPLACE INTO trip_cards (trip_id, made_of, image) SELECT id, ?, ? FROM trips WHERE id = ? AND user_id = ?');
        $statement->bindValue(1, $madeOf);
        $statement->bindValue(2, $image, PDO::PARAM_LOB);
        $statement->bindValue(3, $tripId, PDO::PARAM_INT);
        $statement->bindValue(4, $userId, PDO::PARAM_INT);
        $statement->execute();
        return $statement->rowCount() === 1;
    }

    /** What the user's trip's card was made of; null where it has none. */
    public function madeOf(int $userId, int $tripId): ?string
    {
        return $this->one('c.made_of', 't.id = ? AND t.user_id = ?', [$tripId, $userId]);
    }

    /** The card of the user's trip. */
    public function image(int $userId, int $tripId): ?string
    {
        return $this->one('c.image', 't.id = ? AND t.user_id = ?', [$tripId, $userId]);
    }

    /** What the card of the trip shared under the token was made of; null where there is none. */
    public function sharedMadeOf(string $token): ?string
    {
        return $this->one('c.made_of', 't.share_token = ?', [$token]);
    }

    /** The card of the trip shared under the token. */
    public function sharedImage(string $token): ?string
    {
        return $this->one('c.image', 't.share_token = ?', [$token]);
    }

    private function one(string $column, string $where, array $params): ?string
    {
        $statement = $this->db->prepare("SELECT $column FROM trip_cards c JOIN trips t ON t.id = c.trip_id WHERE $where");
        $statement->execute($params);
        $value = $statement->fetchColumn();
        return $value === false ? null : $value;
    }
}
