<?php

declare(strict_types=1);

namespace Planner\Tests;

use PDO;
use Planner\Database;

final class TestDatabase
{
    /** An in-memory database with the schema applied. */
    public static function create(): PDO
    {
        $db = Database::open(':memory:');
        Database::applySchema($db, dirname(__DIR__) . '/db/schema.sql');
        return $db;
    }
}
