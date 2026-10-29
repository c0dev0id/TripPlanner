<?php

declare(strict_types=1);

namespace Planner\Tests\Trip;

use DateTimeImmutable;
use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Account\Users;
use Planner\Tests\TestDatabase;
use Planner\Trip\Folders;
use Planner\Trip\Trips;
use Planner\Trip\UnknownFolder;

final class FoldersTest extends TestCase
{
    private PDO $db;
    private Folders $folders;
    private Trips $trips;
    private int $userId;
    private int $otherUserId;
    private DateTimeImmutable $now;

    protected function setUp(): void
    {
        $this->db = $db = TestDatabase::create();
        $this->now = new DateTimeImmutable('2026-10-27T10:00:00Z');
        $users = new Users($db);
        $this->userId = $users->create('rider@example.com', 'correct horse battery', $this->now)->id;
        $this->otherUserId = $users->create('other@example.com', 'correct horse battery', $this->now)->id;
        $this->folders = new Folders($db);
        $this->trips = new Trips($db, $this->folders);
    }

    public function testListsOwnFoldersByName(): void
    {
        $this->folders->create($this->userId, 'Scotland', null, $this->now);
        $this->folders->create($this->userId, 'alps', null, $this->now);
        $this->folders->create($this->otherUserId, 'Elsewhere', null, $this->now);
        self::assertSame(['alps', 'Scotland'], array_map(fn ($f) => $f->name, $this->folders->listFor($this->userId)));
    }

    public function testRenamesAndDeletesOnlyOwnFolders(): void
    {
        $folder = $this->folders->create($this->userId, 'Alps', null, $this->now);
        self::assertFalse($this->folders->rename($this->otherUserId, $folder->id, 'Mine'));
        self::assertTrue($this->folders->rename($this->userId, $folder->id, 'Alps 2026'));
        self::assertSame('Alps 2026', $this->folders->listFor($this->userId)[0]->name);
        self::assertFalse($this->folders->delete($this->otherUserId, $folder->id));
        self::assertTrue($this->folders->delete($this->userId, $folder->id));
        self::assertSame([], $this->folders->listFor($this->userId));
    }

    public function testTripsStayWhenTheirFolderGoes(): void
    {
        $folder = $this->folders->create($this->userId, 'Alps', null, $this->now);
        $trip = $this->trips->create($this->userId, 'Weekend', $this->now, $folder->id);
        self::assertSame($folder->id, $this->trips->listFor($this->userId)[0]->folderId);
        $this->folders->delete($this->userId, $folder->id);
        $listed = $this->trips->listFor($this->userId);
        self::assertSame($trip->id, $listed[0]->id);
        self::assertNull($listed[0]->folderId);
    }

    public function testNestsFoldersOnlyInsideOwnFolders(): void
    {
        $rides = $this->folders->create($this->userId, 'Rides', null, $this->now);
        $alps = $this->folders->create($this->userId, 'Alps', $rides->id, $this->now);
        self::assertSame([[$alps->id, $rides->id], [$rides->id, null]], array_map(fn ($f) => [$f->id, $f->parentId], $this->folders->listFor($this->userId)));
        $this->expectException(UnknownFolder::class);
        $this->folders->create($this->otherUserId, 'Theirs', $rides->id, $this->now);
    }

    public function testMovesWhatADeletedFolderHeldUpIntoItsParent(): void
    {
        $rides = $this->folders->create($this->userId, 'Rides', null, $this->now);
        $year = $this->folders->create($this->userId, '2023', $rides->id, $this->now);
        $alps = $this->folders->create($this->userId, 'Alps', $year->id, $this->now);
        $trip = $this->trips->create($this->userId, 'Weekend', $this->now, $year->id);
        self::assertTrue($this->folders->delete($this->userId, $year->id));
        self::assertSame([[$alps->id, $rides->id], [$rides->id, null]], array_map(fn ($f) => [$f->id, $f->parentId], $this->folders->listFor($this->userId)));
        self::assertSame([[$trip->id, $rides->id]], array_map(fn ($t) => [$t->id, $t->folderId], $this->trips->listFor($this->userId)));
    }

    public function testDeletesAFolderWithEverythingInside(): void
    {
        $rides = $this->folders->create($this->userId, 'Rides', null, $this->now);
        $year = $this->folders->create($this->userId, '2023', $rides->id, $this->now);
        $alps = $this->folders->create($this->userId, 'Alps', $year->id, $this->now);
        $other = $this->folders->create($this->userId, '2024', $rides->id, $this->now);
        $inYear = $this->trips->create($this->userId, 'Weekend', $this->now, $year->id);
        $inAlps = $this->trips->create($this->userId, 'Passes', $this->now, $alps->id);
        $kept = $this->trips->create($this->userId, 'Elsewhere', $this->now, $other->id);
        $this->db->prepare("INSERT INTO days (id, trip_id, position, name) VALUES ('d1', ?, 0, 'South')")->execute([$inAlps->id]);

        self::assertNull($this->folders->deleteWithContents($this->otherUserId, $year->id));
        $deleted = $this->folders->deleteWithContents($this->userId, $year->id);
        sort($deleted);
        self::assertSame([$inYear->id, $inAlps->id], $deleted);
        self::assertSame([$other->id, $rides->id], array_map(fn ($f) => $f->id, $this->folders->listFor($this->userId)));
        self::assertSame([$kept->id], array_map(fn ($t) => $t->id, $this->trips->listFor($this->userId)));
        self::assertSame(0, (int) $this->db->query('SELECT COUNT(*) FROM days')->fetchColumn());
        self::assertNull($this->folders->deleteWithContents($this->userId, $year->id));
    }

    public function testMovesATripBetweenFolders(): void
    {
        $folder = $this->folders->create($this->userId, 'Alps', null, $this->now);
        $trip = $this->trips->create($this->userId, 'Weekend', $this->now);
        self::assertTrue($this->trips->move($this->userId, $trip->id, $folder->id));
        self::assertSame($folder->id, $this->trips->listFor($this->userId)[0]->folderId);
        self::assertTrue($this->trips->move($this->userId, $trip->id, null));
        self::assertNull($this->trips->listFor($this->userId)[0]->folderId);
        self::assertFalse($this->trips->move($this->otherUserId, $trip->id, null));
    }

    public function testRenamesATripAndCountsItAsAChange(): void
    {
        $trip = $this->trips->create($this->userId, 'Weekend', $this->now);
        self::assertTrue($this->trips->rename($this->userId, $trip->id, 'Alps weekend', $this->now->modify('+1 day')));
        $listed = $this->trips->listFor($this->userId)[0];
        self::assertSame(['Alps weekend', '2026-10-28T10:00:00Z'], [$listed->name, $listed->updatedAt]);
        $version = $this->db->query("SELECT version FROM trips WHERE id = $trip->id")->fetchColumn();
        self::assertSame(2, (int) $version);
        self::assertFalse($this->trips->rename($this->otherUserId, $trip->id, 'Mine', $this->now));
    }

    public function testRefusesAnotherUsersFolder(): void
    {
        $folder = $this->folders->create($this->otherUserId, 'Theirs', null, $this->now);
        $trip = $this->trips->create($this->userId, 'Weekend', $this->now);
        try {
            $this->trips->move($this->userId, $trip->id, $folder->id);
            self::fail('moved into a folder of another user');
        } catch (UnknownFolder) {
        }
        $this->expectException(UnknownFolder::class);
        $this->trips->create($this->userId, 'Another', $this->now, $folder->id);
    }
}
