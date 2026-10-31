<?php

declare(strict_types=1);

namespace Planner\Account;

use DateTimeImmutable;
use PDO;
use Planner\Timestamp;

final class Users
{
    private const COLUMNS = 'id, email, is_admin, must_change_password';

    /** Letters and digits of a generated password: none that reads like another off a terminal. */
    private const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    private const GENERATED_PASSWORD_LENGTH = 16;

    public function __construct(private readonly PDO $db)
    {
    }

    public function findByEmail(string $email): ?User
    {
        $statement = $this->db->prepare('SELECT ' . self::COLUMNS . ' FROM users WHERE email = ?');
        $statement->execute([self::normalize($email)]);
        return $this->user($statement->fetch());
    }

    public function findById(int $id): ?User
    {
        $statement = $this->db->prepare('SELECT ' . self::COLUMNS . ' FROM users WHERE id = ?');
        $statement->execute([$id]);
        return $this->user($statement->fetch());
    }

    public function create(string $email, string $password, DateTimeImmutable $now, bool $mustChangePassword = false): User
    {
        $statement = $this->db->prepare('INSERT INTO users (email, password_hash, must_change_password, created_at) VALUES (?, ?, ?, ?)');
        $statement->execute([self::normalize($email), password_hash($password, PASSWORD_DEFAULT), (int) $mustChangePassword, Timestamp::of($now)]);
        return new User((int) $this->db->lastInsertId(), self::normalize($email), false, $mustChangePassword);
    }

    /** Creates an account with a generated password, to be replaced at the first sign-in, and returns the password to hand over. */
    public function createWithInitialPassword(string $email, DateTimeImmutable $now): string
    {
        $password = '';
        for ($i = 0; $i < self::GENERATED_PASSWORD_LENGTH; $i++) {
            $password .= self::PASSWORD_ALPHABET[random_int(0, strlen(self::PASSWORD_ALPHABET) - 1)];
        }
        $this->create($email, $password, $now, mustChangePassword: true);
        return $password;
    }

    /** The user with this e-mail address and password, or null for either being wrong. */
    public function authenticate(string $email, string $password): ?User
    {
        $statement = $this->db->prepare('SELECT ' . self::COLUMNS . ', password_hash FROM users WHERE email = ?');
        $statement->execute([self::normalize($email)]);
        $row = $statement->fetch();
        if ($row === false || !password_verify($password, $row['password_hash'])) {
            return null;
        }
        return $this->user($row);
    }

    /** Sets the user's own password, which also ends the need to change a generated one. */
    public function changePassword(int $userId, string $password): void
    {
        $statement = $this->db->prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?');
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
        return $row === false ? null : new User((int) $row['id'], $row['email'], (bool) $row['is_admin'], (bool) $row['must_change_password']);
    }
}
