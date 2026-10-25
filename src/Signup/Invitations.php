<?php

declare(strict_types=1);

namespace Planner\Signup;

use DateTimeImmutable;
use PDO;
use Planner\Account\Users;
use Planner\Timestamp;
use Planner\Token;

final class Invitations
{
    public function __construct(private readonly PDO $db, private readonly int $ttlSeconds)
    {
    }

    /** Stores an invitation for the address and returns the token to mail. */
    public function issue(string $email, ?int $invitedBy, DateTimeImmutable $now): string
    {
        $token = Token::generate();
        $statement = $this->db->prepare(
            'INSERT INTO invitations (email, token_hash, invited_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
        );
        $statement->execute([
            Users::normalize($email),
            Token::hash($token),
            $invitedBy,
            Timestamp::of($now),
            Timestamp::of($now->modify("+{$this->ttlSeconds} seconds")),
        ]);
        return $token;
    }

    /** The unused, unexpired invitation the token names, or null. */
    public function findValid(string $token, DateTimeImmutable $now): ?Invitation
    {
        $statement = $this->db->prepare(
            'SELECT id, email FROM invitations WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?',
        );
        $statement->execute([Token::hash($token), Timestamp::of($now)]);
        $row = $statement->fetch();
        return $row === false ? null : new Invitation((int) $row['id'], $row['email']);
    }

    public function markUsed(int $id, DateTimeImmutable $now): void
    {
        $statement = $this->db->prepare('UPDATE invitations SET used_at = ? WHERE id = ?');
        $statement->execute([Timestamp::of($now), $id]);
    }
}
