<?php

declare(strict_types=1);

namespace Planner\Tests\Trip;

use DateTimeImmutable;
use PHPUnit\Framework\TestCase;
use Planner\Account\Users;
use Planner\Tests\TestDatabase;
use Planner\Trip\Folders;
use Planner\Trip\Trips;

final class FoldersTest extends TestCase
{
    private Folders $folders;
    private Trips $trips;
    private int $userId;
    private int $otherUserId;
    private DateTimeImmutable $now;

    protected function setUp(): void
    {
        $db = TestDatabase::create();
        $this->now = new DateTimeImmutable('2026-10-27T10:00:00Z');
        $users = new Users($db);
        $this->userId = $users->create('rider@example.com', 'correct horse battery', $this->now)->id;
        $this->otherUserId = $users->create('other@example.com', 'correct horse battery', $this->now)->id;
        $this->folders = new Folders($db);
        $this->trips = new Trips($db);
    }

    public function testListsOwnFoldersByName(): void
    {
        $this->folders->create($this->userId, 'Scotland', $this->now);
        $this->folders->create($this->userId, 'alps', $this->now);
        $this->folders->create($this->otherUserId, 'Elsewhere', $this->now);
        self::assertSame(['alps', 'Scotland'], array_map(fn ($f) => $f->name, $this->folders->listFor($this->userId)));
    }

    public function testRenamesAndDeletesOnlyOwnFolders(): void
    {
        $folder = $this->folders->create($this->userId, 'Alps', $this->now);
        self::assertFalse($this->folders->rename($this->otherUserId, $folder->id, 'Mine'));
        self::assertTrue($this->folders->rename($this->userId, $folder->id, 'Alps 2026'));
        self::assertSame('Alps 2026', $this->folders->listFor($this->userId)[0]->name);
        self::assertFalse($this->folders->has($this->otherUserId, $folder->id));
        self::assertFalse($this->folders->delete($this->otherUserId, $folder->id));
        self::assertTrue($this->folders->delete($this->userId, $folder->id));
        self::assertSame([], $this->folders->listFor($this->userId));
    }

    public function testTripsStayWhenTheirFolderGoes(): void
    {
        $folder = $this->folders->create($this->userId, 'Alps', $this->now);
        $trip = $this->trips->create($this->userId, 'Weekend', $this->now, $folder->id);
        self::assertSame($folder->id, $this->trips->listFor($this->userId)[0]->folderId);
        $this->folders->delete($this->userId, $folder->id);
        $listed = $this->trips->listFor($this->userId);
        self::assertSame($trip->id, $listed[0]->id);
        self::assertNull($listed[0]->folderId);
    }

    public function testMovesATripBetweenFolders(): void
    {
        $folder = $this->folders->create($this->userId, 'Alps', $this->now);
        $trip = $this->trips->create($this->userId, 'Weekend', $this->now);
        self::assertTrue($this->trips->move($this->userId, $trip->id, $folder->id));
        self::assertSame($folder->id, $this->trips->listFor($this->userId)[0]->folderId);
        self::assertTrue($this->trips->move($this->userId, $trip->id, null));
        self::assertNull($this->trips->listFor($this->userId)[0]->folderId);
        self::assertFalse($this->trips->move($this->otherUserId, $trip->id, null));
    }
}
