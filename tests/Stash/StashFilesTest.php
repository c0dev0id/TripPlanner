<?php

declare(strict_types=1);

namespace Planner\Tests\Stash;

use DateTimeImmutable;
use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Account\Users;
use Planner\Stash\StashFiles;
use Planner\Tests\TestDatabase;
use Planner\Trip\Folders;

final class StashFilesTest extends TestCase
{
    private PDO $db;
    private Folders $folders;
    private StashFiles $files;
    private int $userId;
    private int $stash;
    private DateTimeImmutable $now;

    protected function setUp(): void
    {
        $this->db = TestDatabase::create();
        $this->now = new DateTimeImmutable('2026-11-14T10:00:00Z');
        $this->userId = (new Users($this->db))->create('rider@example.com', 'correct horse battery', $this->now)->id;
        $this->folders = new Folders($this->db);
        $this->files = new StashFiles($this->db, $this->folders);
        $this->stash = (int) $this->db->query("SELECT id FROM folders WHERE kind = 'collections' AND user_id = $this->userId")->fetchColumn();
    }

    private function keep(string $gpx, ?int $folderId = null, string $name = 'A day out'): ?array
    {
        return $this->files->keep($this->userId, $folderId ?? $this->stash, $name, (string) gzencode($gpx), $this->now);
    }

    public function testKeepsAFileAsItCameWithWhatItHoldsBesideIt(): void
    {
        $kept = $this->keep(StashFixture::gpx());
        self::assertTrue($kept['added']);
        self::assertSame(['A day out', $this->stash, 2], [$kept['file']['name'], $kept['file']['folderId'], $kept['file']['waypoints']]);
        self::assertSame(['Over the pass', 'Morning', ''], array_column($kept['file']['items'], 'name'));
        self::assertSame([$kept['file']], $this->files->listFor($this->userId));
        self::assertSame(StashFixture::gpx(), gzdecode($this->files->gzip($this->userId, $kept['file']['id'])));
    }

    public function testAFileKeptAlreadyIsNotKeptAgainWhereverItIs(): void
    {
        $inside = $this->folders->create($this->userId, '2025', $this->stash, $this->now)->id;
        $first = $this->keep(StashFixture::gpx());
        $again = $this->keep(StashFixture::gpx(), $inside, 'Another name');
        self::assertFalse($again['added']);
        self::assertSame($first['file'], $again['file']);
        self::assertCount(1, $this->files->listFor($this->userId));
        self::assertTrue($this->keep(StashFixture::gpx('Another route'), $inside)['added']);
    }

    public function testKeepsFilesOnlyInTheUsersStash(): void
    {
        $outside = $this->folders->create($this->userId, 'Alps', null, $this->now)->id;
        $other = (new Users($this->db))->create('other@example.com', 'correct horse battery', $this->now)->id;
        self::assertNull($this->keep(StashFixture::gpx(), $outside));
        self::assertNull($this->files->keep($other, $this->stash, 'A day out', (string) gzencode(StashFixture::gpx()), $this->now));
        self::assertSame([], $this->files->listFor($this->userId));
    }

    public function testRenamesMovesAndDeletesOnlyTheUsersFiles(): void
    {
        $inside = $this->folders->create($this->userId, '2025', $this->stash, $this->now)->id;
        $outside = $this->folders->create($this->userId, 'Alps', null, $this->now)->id;
        $id = $this->keep(StashFixture::gpx())['file']['id'];
        $other = $this->userId + 1;
        self::assertTrue($this->files->rename($this->userId, $id, 'Sunday'));
        self::assertTrue($this->files->move($this->userId, $id, $inside));
        self::assertFalse($this->files->move($this->userId, $id, $outside));
        self::assertSame(['Sunday', $inside], [$this->files->listFor($this->userId)[0]['name'], $this->files->listFor($this->userId)[0]['folderId']]);
        self::assertFalse($this->files->rename($other, $id, 'Mine'));
        self::assertFalse($this->files->delete($other, $id));
        self::assertNull($this->files->gzip($other, $id));
        self::assertTrue($this->files->delete($this->userId, $id));
        self::assertSame(0, (int) $this->db->query('SELECT COUNT(*) FROM stash_items')->fetchColumn());
    }

    public function testAFolderDeletedGivesItsFilesToTheFolderAroundItOrTakesThemAlong(): void
    {
        $year = $this->folders->create($this->userId, '2025', $this->stash, $this->now)->id;
        $month = $this->folders->create($this->userId, 'July', $year, $this->now)->id;
        $this->keep(StashFixture::gpx(), $month);
        $this->keep(StashFixture::gpx('Another route'), $year);
        self::assertTrue($this->folders->delete($this->userId, $month));
        self::assertSame([$year, $year], array_column($this->files->listFor($this->userId), 'folderId'));
        self::assertNotNull($this->folders->deleteWithContents($this->userId, $year));
        self::assertSame([], $this->files->listFor($this->userId));
    }
}
