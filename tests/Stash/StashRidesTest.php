<?php

declare(strict_types=1);

namespace Planner\Tests\Stash;

use DateTimeImmutable;
use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Account\Users;
use Planner\Recording\Recordings;
use Planner\Stash\GpxIndex;
use Planner\Stash\StashFiles;
use Planner\Stash\StashRides;
use Planner\Tests\TestDatabase;
use Planner\Trip\Folders;

final class StashRidesTest extends TestCase
{
    private PDO $db;
    private StashFiles $files;
    private Recordings $recordings;
    private StashRides $rides;
    private int $userId;
    private int $stash;
    private DateTimeImmutable $now;

    protected function setUp(): void
    {
        $this->db = TestDatabase::create();
        $this->now = new DateTimeImmutable('2026-11-14T10:00:00Z');
        $this->userId = (new Users($this->db))->create('rider@example.com', 'correct horse battery', $this->now)->id;
        $this->files = new StashFiles($this->db, new Folders($this->db));
        $this->recordings = new Recordings($this->db);
        $this->rides = new StashRides($this->files, $this->recordings);
        $this->stash = (int) $this->db->query("SELECT id FROM folders WHERE kind = 'collections' AND user_id = $this->userId")->fetchColumn();
    }

    private function fileOf(string $gpx): int
    {
        return $this->files->keep($this->userId, $this->stash, 'A day out', (string) gzencode($gpx), $this->now)['file']['id'];
    }

    public function testKeepsATrackAloneWithItsTimesNamedAfterItselfOrItsFile(): void
    {
        $id = $this->fileOf(StashFixture::gpx());
        self::assertSame(['kept' => 2, 'known' => 0], $this->rides->keep($this->userId, $id, null, $this->now));
        $rides = $this->recordings->rides($this->userId);
        $byName = array_column($rides, null, 'name');
        self::assertSame(['A day out', 'Morning'], [min(array_keys($byName)), max(array_keys($byName))]);
        $morning = $byName['Morning'];
        self::assertSame('2025-07-08T15:24:36Z', $morning['startedAt']);
        $kept = GpxIndex::of((string) gzdecode($this->recordings->gzip($this->userId, $morning['id'])));
        self::assertSame([0, ['Morning']], [$kept->waypoints, array_column($kept->items, 'name')]);
        self::assertStringContainsString('<ele>130</ele>', (string) gzdecode($this->recordings->gzip($this->userId, $morning['id'])));
    }

    public function testKeepsOnlyTheTracksAskedForAndKnowsThoseKeptAlready(): void
    {
        $id = $this->fileOf(StashFixture::gpx());
        self::assertSame(['kept' => 1, 'known' => 0], $this->rides->keep($this->userId, $id, [0], $this->now));
        self::assertSame(['kept' => 1, 'known' => 1], $this->rides->keep($this->userId, $id, null, $this->now));
        self::assertCount(2, $this->recordings->rides($this->userId));
    }

    public function testAFileOfOneTrackIsKeptAsItIsAndKnownAsTheRideTheFileWasKeptAs(): void
    {
        $gpx = '<gpx><wpt lat="49.4" lon="8.7"/><trk><name>Ride</name><trkseg><trkpt lat="49.4" lon="8.7"/><trkpt lat="49.5" lon="8.8"/></trkseg></trk></gpx>';
        $this->recordings->keep($this->userId, 'Ride', (string) gzencode($gpx), $this->now);
        self::assertSame(['kept' => 0, 'known' => 1], $this->rides->keep($this->userId, $this->fileOf($gpx), null, $this->now));
    }

    public function testKeepsNothingOfAnotherUsersFile(): void
    {
        $id = $this->fileOf(StashFixture::gpx());
        self::assertNull($this->rides->keep($this->userId + 1, $id, null, $this->now));
        self::assertSame([], $this->recordings->rides($this->userId));
    }
}
