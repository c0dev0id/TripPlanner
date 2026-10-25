<?php

declare(strict_types=1);

namespace Planner\Account;

use DateTimeImmutable;
use PDO;
use Planner\Timestamp;

final class Users
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function findByEmail(string $email): ?User
    {
        $statement = $this->db->prepare('SELECT id, email, is_admin FROM users WHERE email = ?');
        $statement->execute([self::normalize($email)]);
        return $this->user($statement->fetch());
    }

    public function findById(int $id): ?User
    {
        $statement = $this->db->prepare('SELECT id, email, is_admin FROM users WHERE id = ?');
        $statement->execute([$id]);
        return $this->user($statement->fetch());
    }

    public function create(string $email, string $password, DateTimeImmutable $now): User
    {
        $statement = $this->db->prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)');
        $statement->execute([self::normalize($email), password_hash($password, PASSWORD_DEFAULT), Timestamp::of($now)]);
        return new User((int) $this->db->lastInsertId(), self::normalize($email), false);
    }

    /** The user with this e-mail address and password, or null for either being wrong. */
    public function authenticate(string $email, string $password): ?User
    {
        $statement = $this->db->prepare('SELECT id, email, is_admin, password_hash FROM users WHERE email = ?');
        $statement->execute([self::normalize($email)]);
        $row = $statement->fetch();
        if ($row === false || !password_verify($password, $row['password_hash'])) {
            return null;
        }
        return $this->user($row);
    }

    public function changePassword(int $userId, string $password): void
    {
        $statement = $this->db->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        $statement->execute([password_hash($password, PASSWORD_DEFAULT), $userId]);
    }

    /** Makes the user with this address an admin; false when there is none. */
    public function grantAdmin(string $email): bool
    {
        $statement = $this->db->prepare('UPDATE users SET is_admin = 1 WHERE email = ?');
        $statement->execute([self::normalize($email)]);
        return $statement->rowCount() === 1;
    }

    public static function normalize(string $email): string
    {
        return mb_strtolower(trim($email));
    }

    private function user(array|false $row): ?User
    {
        return $row === false ? null : new User((int) $row['id'], $row['email'], (bool) $row['is_admin']);
    }
}
