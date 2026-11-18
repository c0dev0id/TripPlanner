<?php

declare(strict_types=1);

namespace Planner\Tests\Tag;

use DateTimeImmutable;
use PHPUnit\Framework\TestCase;
use Planner\Account\Users;
use Planner\Name;
use Planner\Tag\Tags;
use Planner\Tests\TestDatabase;
use Planner\Trip\Folders;
use Planner\Trip\Trips;

final class TagsTest extends TestCase
{
    public function testKeepsAUsersTagsAndTheTripsTheyAreOn(): void
    {
        $db = TestDatabase::create();
        $now = new DateTimeImmutable('2026-11-18T10:00:00Z');
        $users = new Users($db);
        $userId = $users->create('rider@example.com', 'correct horse battery', $now)->id;
        $otherId = $users->create('other@example.com', 'correct horse battery', $now)->id;
        $trips = new Trips($db, new Folders($db));
        $tripId = $trips->create($userId, 'Alps', $now)->id;
        $tags = new Tags($db);

        $ridden = $tags->create($userId, 'Ridden', '#2e7d32');
        $idea = $tags->create($userId, 'Idea', '#1565c0');
        self::assertNull($tags->create($userId, 'ridden', '#000000'));
        self::assertNotNull($theirs = $tags->create($otherId, 'Ridden', '#000000'));
        self::assertSame(['Idea', 'Ridden'], array_column($tags->listFor($userId), 'name'));

        self::assertTrue($tags->change($userId, $idea['id'], 'Ideas', '#ff8800'));
        self::assertFalse($tags->change($userId, $idea['id'], 'Ridden', '#ff8800'));
        self::assertFalse($tags->change($otherId, $idea['id'], 'Mine', '#ff8800'));
        self::assertSame(['id' => $idea['id'], 'name' => 'Ideas', 'color' => '#ff8800'], $tags->listFor($userId)[0]);

        self::assertTrue($tags->set($userId, $tripId, $ridden['id'], true));
        self::assertTrue($tags->set($userId, $tripId, $ridden['id'], true));
        self::assertTrue($tags->set($userId, $tripId, $idea['id'], true));
        self::assertFalse($tags->set($userId, $tripId, $theirs['id'], true));
        self::assertFalse($tags->set($otherId, $tripId, $theirs['id'], true));
        self::assertSame([$ridden['id'], $idea['id']], $trips->listFor($userId)[0]->tagIds);

        self::assertTrue($tags->set($userId, $tripId, $ridden['id'], false));
        self::assertFalse($tags->delete($otherId, $idea['id']));
        self::assertTrue($tags->delete($userId, $idea['id']));
        self::assertSame([], $trips->listFor($userId)[0]->tagIds);
    }

    public function testTakesANameAndAColour(): void
    {
        self::assertSame('Ridden', Name::of(' Ridden ', Tags::MAX_NAME));
        self::assertNull(Name::of('', Tags::MAX_NAME));
        self::assertNull(Name::of(str_repeat('a', Tags::MAX_NAME + 1), Tags::MAX_NAME));
        self::assertNull(Name::of(7, Tags::MAX_NAME));
        self::assertSame('#a1b2c3', Tags::colorOf('#A1B2C3'));
        self::assertNull(Tags::colorOf('red'));
        self::assertNull(Tags::colorOf('#fff'));
    }
}
