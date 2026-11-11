<?php

declare(strict_types=1);

namespace Planner\Tests\Account;

use DateTimeImmutable;
use PHPUnit\Framework\TestCase;
use Planner\Account\Preferences;
use Planner\Account\Users;
use Planner\Tests\TestDatabase;

final class PreferencesTest extends TestCase
{
    public function testAreAnEmptyObjectUntilSetAndEachUsersOwn(): void
    {
        $db = TestDatabase::create();
        $now = new DateTimeImmutable('2026-11-11T10:00:00Z');
        $users = new Users($db);
        $rider = $users->create('rider@example.com', 'correct horse battery', $now)->id;
        $other = $users->create('other@example.com', 'correct horse battery', $now)->id;
        $preferences = new Preferences($db);
        self::assertEquals((object) [], $preferences->of($rider));
        $preferences->set($rider, (object) ['placeReachM' => (object) ['fuel' => 200]]);
        $preferences->set($rider, (object) ['placeReachM' => (object) ['fuel' => 500, 'hotel' => 5000]]);
        self::assertEquals((object) ['placeReachM' => (object) ['fuel' => 500, 'hotel' => 5000]], $preferences->of($rider));
        self::assertEquals((object) [], $preferences->of($other));
    }
}
