<?php

declare(strict_types=1);

namespace Planner\Tests\Recording;

use DateTimeImmutable;
use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Account\Users;
use Planner\Export\Polyline;
use Planner\Recording\Recordings;
use Planner\Recording\Unmergeable;
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

    public function testKeepsARideForItsUserWithWhatItsFileTells(): void
    {
        $gzip = gzencode(self::gpx([[11.5, 48.1], [11.5, 48.2]], '2027-06-12T08:00:00+02:00'));
        ['recording' => $ride, 'added' => $added] = $this->recordings->keep($this->userId, 'Morning ride', $gzip, $this->now);
        self::assertTrue($added);
        self::assertSame(['Morning ride', '2027-06-12T06:00:00Z', null], [$ride->name, $ride->startedAt, $ride->dayId]);
        self::assertEqualsWithDelta(11_120, $ride->distanceM, 10);
        self::assertSame($gzip, $this->recordings->gzip($this->userId, $ride->id));
        self::assertNull($this->recordings->gzip($this->userId + 1, $ride->id));
        self::assertNull($this->recordings->keep($this->userId, 'No times', gzencode(self::gpx([[11.5, 48.1], [11.5, 48.2]], null)), $this->now)['recording']->startedAt);

        self::assertTrue($this->recordings->rename($this->userId, $ride->id, 'Ride to the pass'));
        self::assertFalse($this->recordings->rename($this->userId + 1, $ride->id, 'Mine'));
        self::assertSame(['No times', 'Ride to the pass'], array_column($this->recordings->rides($this->userId), 'name'));
        self::assertSame([], $this->recordings->rides($this->userId + 1));

        self::assertFalse($this->recordings->delete($this->userId + 1, $ride->id));
        self::assertTrue($this->recordings->delete($this->userId, $ride->id));
        self::assertSame(['No times'], array_column($this->recordings->rides($this->userId), 'name'));
    }

    public function testKeepsAFileOnceForAUser(): void
    {
        $gzip = gzencode(self::gpx([[11.5, 48.1], [11.5, 48.2]], null));
        $first = $this->recordings->keep($this->userId, 'Ride', $gzip, $this->now)['recording'];
        ['recording' => $again, 'added' => $added] = $this->recordings->keep($this->userId, 'Again', $gzip, $this->now, 'day1');
        self::assertFalse($added);
        self::assertSame([$first->id, 'Ride', 'day1'], [$again->id, $again->name, $again->dayId]);
        self::assertCount(1, $this->recordings->rides($this->userId));
        self::assertEquals([$again], $this->recordings->listFor($this->userId, $this->tripId));

        $theirs = (new Users($this->db))->create('other@example.com', 'correct horse battery', $this->now)->id;
        self::assertTrue($this->recordings->keep($theirs, 'Theirs', $gzip, $this->now)['added']);
        self::assertNull($this->recordings->keep($theirs, 'On my day', gzencode('<gpx/>'), $this->now, 'day1'));
        self::assertCount(1, $this->recordings->rides($theirs));
    }

    public function testPutsARideOnAnyNumberOfTheUsersDays(): void
    {
        $other = $this->trips->create($this->userId, 'Vosges', $this->now)->id;
        $this->documents->save($this->userId, $other, TripDocumentValidator::validated(['name' => 'Vosges', 'days' => [TripFixture::day('other-day')]] + TripFixture::document()), 1, $this->now);
        $later = $this->recordings->keep($this->userId, 'Later', gzencode(self::gpx([[11.5, 48.1], [11.5, 48.2]], '2027-06-13T08:00:00Z')), $this->now, 'day1')['recording'];
        $earlier = $this->recordings->keep($this->userId, 'Earlier', gzencode(self::gpx([[7.1, 48.0], [7.2, 48.1]], '2027-06-12T08:00:00Z')), $this->now)['recording'];

        self::assertFalse($this->recordings->link($this->userId, $earlier->id, 'no-such-day'));
        self::assertFalse($this->recordings->link($this->userId + 1, $earlier->id, 'day1'));
        self::assertTrue($this->recordings->link($this->userId, $earlier->id, 'day1'));
        self::assertTrue($this->recordings->link($this->userId, $earlier->id, 'day1'));
        self::assertTrue($this->recordings->link($this->userId, $earlier->id, 'other-day'));
        self::assertSame([['Earlier', 'day1'], ['Later', 'day1']], array_map(fn ($r) => [$r->name, $r->dayId], $this->recordings->listFor($this->userId, $this->tripId)));
        self::assertSame([['Earlier', 'other-day']], array_map(fn ($r) => [$r->name, $r->dayId], $this->recordings->listFor($this->userId, $other)));
        self::assertNull($this->recordings->listFor($this->userId + 1, $this->tripId));

        $rides = $this->recordings->rides($this->userId);
        self::assertSame([$earlier->id, $later->id], array_column($rides, 'id'));
        self::assertSame([['tripId' => $this->tripId, 'dayId' => 'day1', 'trip' => 'Alps'], ['tripId' => $other, 'dayId' => 'other-day', 'trip' => 'Vosges']], $rides[0]['days']);
        self::assertEqualsWithDelta([[7.1, 48.0], [7.2, 48.1]], Polyline::decode($rides[0]['line']), 1e-6);

        self::assertFalse($this->recordings->unlink($this->userId + 1, $earlier->id, 'day1'));
        self::assertTrue($this->recordings->unlink($this->userId, $earlier->id, 'day1'));
        self::assertFalse($this->recordings->unlink($this->userId, $earlier->id, 'day1'));
        self::assertSame(['Later'], array_map(fn ($r) => $r->name, $this->recordings->listFor($this->userId, $this->tripId)));
        self::assertCount(2, $this->recordings->rides($this->userId));
    }

    public function testRemembersTheDaysARideIsNotOfUntilItIsPutOnThem(): void
    {
        $ride = $this->recordings->keep($this->userId, 'Ride', gzencode(self::gpx([[11.5, 48.1], [11.5, 48.2]], null)), $this->now)['recording'];
        self::assertFalse($this->recordings->decline($this->userId + 1, $ride->id, 'day1'));
        self::assertFalse($this->recordings->decline($this->userId, $ride->id, 'no-such-day'));
        self::assertTrue($this->recordings->decline($this->userId, $ride->id, 'day1'));
        self::assertTrue($this->recordings->decline($this->userId, $ride->id, 'day1'));
        self::assertSame(['day1' => [$ride->id]], $this->recordings->declined($this->userId));
        self::assertSame([], $this->recordings->declined($this->userId + 1));

        $this->recordings->link($this->userId, $ride->id, 'day1');
        self::assertSame([], $this->recordings->declined($this->userId));
    }

    public function testGivesTheDaysOfTheUsersTripsWithTheirRoutes(): void
    {
        $collections = array_values(array_filter((new Folders($this->db))->listFor($this->userId), fn ($folder) => $folder->kind === 'collections'))[0]->id;
        $material = $this->trips->create($this->userId, 'Material', $this->now, $collections, 'collection')->id;
        $this->documents->save($this->userId, $material, TripDocumentValidator::validated(['days' => [TripFixture::day('section')]] + TripFixture::document()), 1, $this->now);

        $days = iterator_to_array($this->documents->tripDays($this->userId), false);
        $document = TripFixture::document();
        self::assertSame(array_column($document['days'], 'id'), array_column($days, 'id'));
        self::assertSame([$this->tripId, $document['days'][0]['date']], [$days[0]['tripId'], $days[0]['date']]);
        self::assertSame(array_column($document['days'][0]['routes'], 'id'), array_column($days[0]['routes'], 'id'));
        self::assertSame([], iterator_to_array($this->documents->tripDays($this->userId + 1), false));
        self::assertSame(array_slice(array_column($document['days'], 'id'), 1), array_column(iterator_to_array($this->documents->tripDays($this->userId, 1), false), 'id'));
        self::assertSame([count($document['days']), 0], [$this->documents->tripDayCount($this->userId), $this->documents->tripDayCount($this->userId + 1)]);
    }

    public function testMergesRidesThatFollowOneAnotherAndRemembersTheirFiles(): void
    {
        $files = $rides = [];
        foreach ([['2027-06-12T08:00:00Z', 48.1, 48.2], ['2027-06-12T11:00:00Z', 48.2, 48.3], ['2027-06-12T15:00:00Z', 48.3, 48.4], ['2027-06-13T08:00:00Z', 48.4, 48.5]] as $i => [$time, $from, $to]) {
            $files[] = gzencode(self::gpx([[11.5, $from], [11.5, $to]], $time));
            $rides[] = $this->recordings->keep($this->userId, "Piece $i", $files[$i], $this->now)['recording'];
        }
        $untimed = $this->recordings->keep($this->userId, 'No times', gzencode(self::gpx([[11.5, 48.1], [11.5, 48.2]], null)), $this->now)['recording'];
        $this->recordings->link($this->userId, $rides[1]->id, 'day1');

        self::assertSame([['startedAt' => '2027-06-12T11:00:00Z', 'pauseS' => 10_800, 'distanceM' => 0]], $this->recordings->joints($this->userId, [$rides[1]->id, $rides[0]->id]));
        [$apart] = $this->recordings->joints($this->userId, [$rides[0]->id, $rides[3]->id]);
        self::assertSame(['2027-06-13T08:00:00Z', 86_400], [$apart['startedAt'], $apart['pauseS']]);
        self::assertEqualsWithDelta(22_240, $apart['distanceM'], 20);
        self::assertNull($this->recordings->joints($this->userId, [$rides[0]->id, $untimed->id])[0]['pauseS']);
        self::assertNull($this->recordings->joints($this->userId + 1, [$rides[0]->id, $rides[1]->id]));
        self::assertNull($this->recordings->merge($this->userId + 1, [$rides[0]->id, $rides[1]->id], $this->now));
        foreach ([[$rides[0]->id, $rides[2]->id], [$rides[0]->id, $untimed->id]] as $refused) {
            try {
                $this->recordings->merge($this->userId, $refused, $this->now);
                self::fail('Merged what does not follow one another, or has no times.');
            } catch (Unmergeable) {
            }
        }

        $merged = $this->recordings->merge($this->userId, [$rides[1]->id, $rides[0]->id], $this->now);
        $kept = array_column($this->recordings->rides($this->userId), null, 'id');
        self::assertSame([$untimed->id, $merged, $rides[2]->id, $rides[3]->id], array_keys($kept));
        self::assertSame(['Piece 0', '2027-06-12T08:00:00Z', ['day1']], [$kept[$merged]['name'], $kept[$merged]['startedAt'], array_column($kept[$merged]['days'], 'dayId')]);
        self::assertEqualsWithDelta(22_240, $kept[$merged]['distanceM'], 20);
        self::assertSame(2, substr_count((string) gzdecode($this->recordings->gzip($this->userId, $merged)), '<trkseg>'));

        // A piece dropped again is the merged ride, also once that is merged on.
        ['recording' => $again, 'added' => $added] = $this->recordings->keep($this->userId, 'Piece 0 again', $files[0], $this->now);
        self::assertSame([$merged, false], [$again->id, $added]);
        $whole = $this->recordings->merge($this->userId, [$merged, $rides[2]->id], $this->now);
        foreach ([$files[0], $files[1], $files[2]] as $file) {
            self::assertSame($whole, $this->recordings->keep($this->userId, 'Again', $file, $this->now)['recording']->id);
        }
        self::assertTrue($this->recordings->delete($this->userId, $whole));
        self::assertTrue($this->recordings->keep($this->userId, 'Anew', $files[0], $this->now)['added']);
    }

    /** A GPX file of one track along the points, the first with the time. */
    private static function gpx(array $points, ?string $time): string
    {
        $trackpoints = array_map(fn (array $p, int $i) => "<trkpt lat=\"$p[1]\" lon=\"$p[0]\">" . ($i === 0 && $time !== null ? "<time>$time</time>" : '') . '</trkpt>', $points, array_keys($points));
        return '<?xml version="1.0"?><gpx><metadata><time>2020-01-01T00:00:00Z</time></metadata><trk><trkseg>' . implode('', $trackpoints) . '</trkseg></trk></gpx>';
    }

    public function testStaysWhenItsDayGoesAndIsOnTheDaysOfACopy(): void
    {
        $this->recordings->keep($this->userId, 'Morning ride', gzencode('<gpx/>'), $this->now, 'day1');
        $copyId = $this->documents->copy($this->userId, $this->tripId, $this->now);
        $copied = $this->recordings->listFor($this->userId, $copyId);
        self::assertSame(['Morning ride'], array_map(fn ($r) => $r->name, $copied));
        self::assertNotSame('day1', $copied[0]->dayId);
        self::assertCount(2, $this->recordings->rides($this->userId)[0]['days']);
        self::assertSame(1, $this->documents->outlines($this->userId)[$copyId][0]['recordings']);

        $document = TripFixture::document();
        $document['days'] = [];
        $this->documents->save($this->userId, $this->tripId, TripDocumentValidator::validated($document), 2, $this->now);
        self::assertSame([], $this->recordings->listFor($this->userId, $this->tripId));
        $this->trips->delete($this->userId, $copyId);
        self::assertSame([['Morning ride', []]], array_map(fn (array $ride) => [$ride['name'], $ride['days']], $this->recordings->rides($this->userId)));
    }

    public function testFollowsADayThatJoinsAnotherInAMerge(): void
    {
        $other = $this->trips->create($this->userId, 'Alps, again', $this->now)->id;
        $document = TripFixture::document();
        $document['days'] = [['date' => '2027-06-12'] + TripFixture::day('b1')];
        $this->documents->save($this->userId, $other, TripDocumentValidator::validated($document), 1, $this->now);
        $both = $this->recordings->keep($this->userId, 'First file', gzencode('<gpx><trk/></gpx>'), $this->now, 'day1')['recording'];
        $this->recordings->link($this->userId, $both->id, 'b1');
        $this->recordings->keep($this->userId, 'Second file', gzencode('<gpx/>'), $this->now, 'b1');
        $this->documents->merge($this->userId, $this->tripId, [$other], $this->now);
        $merged = array_map(fn ($r) => [$r->dayId, $r->name], $this->recordings->listFor($this->userId, $this->tripId));
        sort($merged);
        self::assertSame([['day1', 'First file'], ['day1', 'Second file']], $merged);
    }
}
