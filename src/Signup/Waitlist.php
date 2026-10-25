<?php

declare(strict_types=1);

namespace Planner\Signup;

use DateTimeImmutable;
use PDO;
use Planner\Account\Users;
use Planner\Timestamp;

final class Waitlist
{
    public function __construct(private readonly PDO $db)
    {
    }

    /** Adds the address; an address already on the list stays as it is. */
    public function join(string $email, DateTimeImmutable $now): void
    {
        $statement = $this->db->prepare('INSERT OR IGNORE INTO waitlist (email, created_at) VALUES (?, ?)');
        $statement->execute([Users::normalize($email), Timestamp::of($now)]);
    }

    /** Addresses not yet invited, oldest first, each as ['email' => ..., 'created_at' => ...]. */
    public function pending(): array
    {
        return $this->db
            ->query('SELECT email, created_at FROM waitlist WHERE invited_at IS NULL ORDER BY created_at, id')
            ->fetchAll();
    }

    public function markInvited(string $email, DateTimeImmutable $now): void
    {
        $statement = $this->db->prepare('UPDATE waitlist SET invited_at = ? WHERE email = ?');
        $statement->execute([Timestamp::of($now), Users::normalize($email)]);
    }
}
