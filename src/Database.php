<?php

declare(strict_types=1);

namespace Planner;

use PDO;

final class Database
{
    /** Opens (and creates) the SQLite file with foreign keys on and WAL journaling. */
    public static function open(string $file): PDO
    {
        if ($file !== ':memory:' && !is_dir(dirname($file))) {
            mkdir(dirname($file), 0750, true);
        }
        $pdo = new PDO('sqlite:' . $file, options: [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec('PRAGMA journal_mode = WAL');
        $pdo->exec('PRAGMA busy_timeout = 5000');
        return $pdo;
    }

    public static function applySchema(PDO $pdo, string $schemaFile): void
    {
        $pdo->exec(file_get_contents($schemaFile));
    }
}
