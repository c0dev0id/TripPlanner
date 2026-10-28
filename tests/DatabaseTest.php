<?php

declare(strict_types=1);

namespace Planner\Tests;

use DateTimeImmutable;
use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Account\Users;
use Planner\Database;

final class DatabaseTest extends TestCase
{
    public function testDropsEveryTableSoThatTheSchemaAppliesAfresh(): void
    {
        $db = TestDatabase::create();
        (new Users($db))->create('rider@example.com', 'correct horse battery', new DateTimeImmutable());
        Database::dropAll($db);
        self::assertSame([], $db->query("SELECT name FROM sqlite_master WHERE type = 'table'")->fetchAll(PDO::FETCH_COLUMN));
        Database::applySchema($db, dirname(__DIR__) . '/db/schema.sql');
        self::assertSame(0, (int) $db->query('SELECT COUNT(*) FROM users')->fetchColumn());
        self::assertSame('1', (string) $db->query('PRAGMA foreign_keys')->fetchColumn());
    }
}
