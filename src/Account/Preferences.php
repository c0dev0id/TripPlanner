<?php

declare(strict_types=1);

namespace Planner\Account;

use PDO;
use Planner\Http\Json;

/** What each user set for the planner as a whole: an object the planner itself reads and writes. */
final class Preferences
{
    public function __construct(private readonly PDO $db)
    {
    }

    /** The user's preferences; an empty object where none were set. */
    public function of(int $userId): object
    {
        $statement = $this->db->prepare('SELECT preferences FROM user_preferences WHERE user_id = ?');
        $statement->execute([$userId]);
        $json = $statement->fetchColumn();
        return $json === false ? (object) [] : json_decode($json, false, 512, JSON_THROW_ON_ERROR);
    }

    public function set(int $userId, object $preferences): void
    {
        $this->db->prepare('INSERT INTO user_preferences (user_id, preferences) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET preferences = excluded.preferences')
            ->execute([$userId, Json::encode($preferences)]);
    }
}
