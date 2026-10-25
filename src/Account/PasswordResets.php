<?php

declare(strict_types=1);

namespace Planner\Account;

use DateTimeImmutable;
use PDO;
use Planner\Timestamp;
use Planner\Token;

final class PasswordResets
{
    public function __construct(private readonly PDO $db, private readonly int $ttlSeconds)
    {
    }

    /** Stores a reset for the user and returns the token to mail. */
    public function issue(int $userId, DateTimeImmutable $now): string
    {
        $token = Token::generate();
        $statement = $this->db->prepare(
            'INSERT INTO password_resets (user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)',
        );
        $statement->execute([
            $userId,
            Token::hash($token),
            Timestamp::of($now),
            Timestamp::of($now->modify("+{$this->ttlSeconds} seconds")),
        ]);
        return $token;
    }

    /** The unused, unexpired reset the token names, or null. */
    public function findValid(string $token, DateTimeImmutable $now): ?PasswordReset
    {
        $statement = $this->db->prepare(
            'SELECT id, user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?',
        );
        $statement->execute([Token::hash($token), Timestamp::of($now)]);
        $row = $statement->fetch();
        return $row === false ? null : new PasswordReset((int) $row['id'], (int) $row['user_id']);
    }

    public function markUsed(int $id, DateTimeImmutable $now): void
    {
        $statement = $this->db->prepare('UPDATE password_resets SET used_at = ? WHERE id = ?');
        $statement->execute([Timestamp::of($now), $id]);
    }
}
