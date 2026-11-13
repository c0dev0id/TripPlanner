<?php

declare(strict_types=1);

namespace Planner\Tests\Recording;

use DateTimeImmutable;
use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Account\Users;
use Planner\Export\Polyline;
use Planner\Recording\AlreadyKept;
use Planner\Recording\Recordings;
use Planner\Tests\TestDatabase;
use Planner\Tests\Trip\TripFixture;
use Planner\Trip\Folders;
use Planner\Trip\TripDocuments;
use Planner\Trip\TripDocumentValidator;
use Planner\Trip\Trips;

final class RecordingsTest extends TestCase
{
    private PDO $db;
    private Recordings $recordings;
    private TripDocuments $documents;
    private Trips $trips;
    private int $userId;
    private int $tripId;
    private DateTimeImmutable $now;

    protected function setUp(): void
    {
        $this->db = TestDatabase::create();
        $this->now = new DateTimeImmutable('2026-10-31T10:00:00Z');
        $this->userId = (new Users($this->db))->create('rider@example.com', 'correct horse battery', $this->now)->id;
        $this->trips = new Trips($this->db, new Folders($this->db));
        $this->documents = new TripDocuments($this->db);
        $this->recordings = new Recordings($this->db);
        $this->tripId = $this->trips->create($this->userId, 'Alps', $this->now)->id;
        $this->documents->save($this->userId, $this->tripId, TripDocumentValidator::validated(TripFixture::document()), 1, $this->now);
    }

    public function testKeepsARecordingOnADayOfTheUsersTrip(): void
    {
        $gzip = gzencode('<gpx><trk/></gpx>');
        $recording = $this->recordings->add($this->userId, $this->tripId, 'day1', 'Morning ride', $gzip, $this->now);
        self::assertSame(['day1', 'Morning ride'], [$recording->dayId, $recording->name]);
        self::assertNull($this->recordings->add($this->userId + 1, $this->tripId, 'day1', 'Theirs', $gzip, $this->now));
        self::assertNull($this->recordings->add($this->userId, $this->tripId, 'no-such-day', 'Nowhere', $gzip, $this->now));
        self::assertSame($gzip, $this->recordings->gzip($this->userId, $this->tripId, $recording->id));
        self::assertNull($this->recordings->gzip($this->userId + 1, $this->tripId, $recording->id));

        self::assertTrue($this->recordings->rename($this->userId, $this->tripId, $recording->id, 'Ride to the pass'));
        self::assertFalse($this->recordings->rename($this->userId + 1, $this->tripId, $recording->id, 'Mine'));
        self::assertSame(['Ride to the pass'], array_map(fn ($r) => $r->name, $this->recordings->listFor($this->userId, $this->tripId)));
        self::assertNull($this->recordings->listFor($this->userId + 1, $this->tripId));

        self::assertFalse($this->recordings->delete($this->userId + 1, $this->tripId, $recording->id));
        self::assertTrue($this->recordings->delete($this->userId, $this->tripId, $recording->id));
        self::assertSame([], $this->recordings->listFor($this->userId, $this->tripId));
    }

    public function testKeepsWhatItsFileTellsBesideTheRecording(): void
    {
        $recording = $this->recordings->add($this->userId, $this->tripId, 'day1', 'Ride', gzencode(self::gpx([[11.5, 48.1], [11.5, 48.2]], '2027-06-12T08:00:00+02:00')), $this->now);
        self::assertSame('2027-06-12T06:00:00Z', $recording->startedAt);
        self::assertEqualsWithDelta(11_120, $recording->distanceM, 10);
        self::assertEquals([$recording], $this->recordings->listFor($this->userId, $this->tripId));

        $bare = $this->recordings->add($this->userId, $this->tripId, 'day1', 'No times', gzencode(self::gpx([[11.5, 48.1], [11.5, 48.2]], null)), $this->now);
        self::assertNull($bare->startedAt);
    }

    public function testKeepsAFileOnceWhereAskedTo(): void
    {
        $gzip = gzencode(self::gpx([[11.5, 48.1], [11.5, 48.2]], null));
        $this->recordings->add($this->userId, $this->tripId, 'day1', 'Ride', $gzip, $this->now, true);
        self::assertNotNull($this->recordings->add($this->userId, $this->tripId, 'day1', 'On purpose', $gzip, $this->now));
        $this->expectException(AlreadyKept::class);
        $this->recordings->add($this->userId, $this->tripId, 'day1', 'Again', $gzip, $this->now, true);
    }

    public function testListsTheRecordingsThatWaitInTheFolderForRecordings(): void
    {
        $folders = new Folders($this->db);
        $inbox = array_values(array_filter($folders->listFor($this->userId), fn ($folder) => $folder->kind === 'recordings'))[0]->id;
        $year = $this->trips->create($this->userId, '2027', $this->now, $folders->create($this->userId, 'Tracker', $inbox, $this->now)->id, 'collection')->id;
        $document = ['days' => [TripFixture::day('2027-06')]] + TripFixture::document();
        $this->documents->save($this->userId, $year, TripDocumentValidator::validated($document), 1, $this->now);
        $waiting = $this->recordings->add($this->userId, $year, '2027-06', 'Waiting', gzencode(self::gpx([[11.5, 48.1], [11.5, 48.2]], '2027-06-12T06:00:00Z')), $this->now);
        $this->recordings->add($this->userId, $this->tripId, 'day1', 'On its day', gzencode('<gpx/>'), $this->now);

        $unassigned = $this->recordings->unassigned($this->userId);
        self::assertSame([[$waiting->id, $year, 'Waiting', '2027-06-12T06:00:00Z']], array_map(fn ($r) => [$r['id'], $r['tripId'], $r['name'], $r['startedAt']], $unassigned));
        self::assertCount(2, Polyline::decode($unassigned[0]['line']));
        self::assertSame([], $this->recordings->unassigned($this->userId + 1));

        self::assertTrue($this->recordings->move($this->userId, $year, $waiting->id, 'day1'));
        self::assertSame([], $this->recordings->unassigned($this->userId));
    }

    /** A GPX file of one track along the points, the first with the time. */
    private static function gpx(array $points, ?string $time): string
    {
        $trackpoints = array_map(fn (array $p, int $i) => "<trkpt lat=\"$p[1]\" lon=\"$p[0]\">" . ($i === 0 && $time !== null ? "<time>$time</time>" : '') . '</trkpt>', $points, array_keys($points));
        return '<?xml version="1.0"?><gpx><metadata><time>2020-01-01T00:00:00Z</time></metadata><trk><trkseg>' . implode('', $trackpoints) . '</trkseg></trk></gpx>';
    }

    public function testMovesToAnotherDayOfTheUsersAndToNoOther(): void
    {
        $document = TripFixture::document();
        $document['days'][] = TripFixture::day('day2');
        $this->documents->save($this->userId, $this->tripId, TripDocumentValidator::validated($document), 2, $this->now);
        $otherTrip = $this->trips->create($this->userId, 'Other', $this->now)->id;
        $other = TripFixture::document();
        $other['days'] = [TripFixture::day('elsewhere')];
        $this->documents->save($this->userId, $otherTrip, TripDocumentValidator::validated($other), 1, $this->now);
        $recording = $this->recordings->add($this->userId, $this->tripId, 'day1', 'Ride', gzencode('<gpx><trk/></gpx>'), $this->now);

        self::assertFalse($this->recordings->move($this->userId, $this->tripId, $recording->id, 'no-such-day'));
        self::assertFalse($this->recordings->move($this->userId + 1, $this->tripId, $recording->id, 'day2'));
        self::assertTrue($this->recordings->move($this->userId, $this->tripId, $recording->id, 'day2'));
        self::assertSame(['day2'], array_map(fn ($r) => $r->dayId, $this->recordings->listFor($this->userId, $this->tripId)));
        self::assertTrue($this->recordings->move($this->userId, $this->tripId, $recording->id, 'elsewhere'));
        self::assertSame(['elsewhere'], array_map(fn ($r) => $r->dayId, $this->recordings->listFor($this->userId, $otherTrip)));
    }

    public function testGoesWithItsDayAndIsCopiedWithTheTrip(): void
    {
        $this->recordings->add($this->userId, $this->tripId, 'day1', 'Morning ride', gzencode('<gpx/>'), $this->now);
        $copyId = $this->documents->copy($this->userId, $this->tripId, $this->now);
        $copied = $this->recordings->listFor($this->userId, $copyId);
        self::assertSame(['Morning ride'], array_map(fn ($r) => $r->name, $copied));
        self::assertNotSame('day1', $copied[0]->dayId);

        $document = TripFixture::document();
        $document['days'] = [];
        $this->documents->save($this->userId, $this->tripId, TripDocumentValidator::validated($document), 2, $this->now);
        self::assertSame([], $this->recordings->listFor($this->userId, $this->tripId));
        self::assertCount(1, $this->recordings->listFor($this->userId, $copyId));
    }

    public function testFollowsADayThatJoinsAnotherInAMerge(): void
    {
        $other = $this->trips->create($this->userId, 'Alps, again', $this->now)->id;
        $document = TripFixture::document();
        $document['days'] = [['date' => '2027-06-12'] + TripFixture::day('b1')];
        $this->documents->save($this->userId, $other, TripDocumentValidator::validated($document), 1, $this->now);
        $this->recordings->add($this->userId, $other, 'b1', 'Second file', gzencode('<gpx/>'), $this->now);
        $this->documents->merge($this->userId, $this->tripId, [$other], $this->now);
        self::assertSame([['day1', 'Second file']], array_map(fn ($r) => [$r->dayId, $r->name], $this->recordings->listFor($this->userId, $this->tripId)));
    }
}
