<?php

declare(strict_types=1);

namespace Planner\Tests\Journal;

use DateTimeImmutable;
use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Account\Users;
use Planner\Journal\Entries;
use Planner\Journal\Exif;
use Planner\Tests\TestDatabase;
use Planner\Tests\Trip\TripFixture;
use Planner\Trip\TripDocuments;
use Planner\Trip\TripDocumentValidator;
use Planner\Trip\Folders;
use Planner\Trip\Trips;

final class EntriesTest extends TestCase
{
    private PDO $db;
    private Entries $entries;
    private TripDocuments $documents;
    private int $userId;
    private int $otherUserId;
    private int $tripId;
    private DateTimeImmutable $now;

    private const PHOTO = ['name' => 'IMG_1.jpg', 'mediaType' => 'image/jpeg', 'size' => 1234, 'takenAt' => null, 'lngLat' => null];

    protected function setUp(): void
    {
        $this->db = TestDatabase::create();
        $this->now = new DateTimeImmutable('2026-10-27T10:00:00Z');
        $users = new Users($this->db);
        $this->userId = $users->create('rider@example.com', 'correct horse battery', $this->now)->id;
        $this->otherUserId = $users->create('other@example.com', 'correct horse battery', $this->now)->id;
        $this->tripId = (new Trips($this->db, new Folders($this->db)))->create($this->userId, 'Alps', $this->now)->id;
        $this->documents = new TripDocuments($this->db);
        $this->documents->save($this->userId, $this->tripId, TripDocumentValidator::validated(TripFixture::document()), 1, $this->now);
        $this->entries = new Entries($this->db);
    }

    public function testAddsNotesAndFilesOnTheTripAndItsParts(): void
    {
        $note = $this->entries->add($this->userId, $this->tripId, [], 'Packed the bags.', null, $this->now);
        $photo = $this->entries->add($this->userId, $this->tripId, ['stopId' => 's2'], '', self::PHOTO, $this->now);
        self::assertSame([null, null, null, 'Packed the bags.', null], [$note->dayId, $note->stopId, $note->routeId, $note->text, $note->file]);
        self::assertSame(['s2', ['name' => 'IMG_1.jpg', 'mediaType' => 'image/jpeg', 'size' => 1234, 'image' => true, 'width' => null, 'height' => null]], [$photo->stopId, $photo->file]);
        $measured = $this->entries->add($this->userId, $this->tripId, [], '', ['pixels' => [4000, 3000]] + self::PHOTO, $this->now);
        self::assertSame([4000, 3000], [$measured->file['width'], $measured->file['height']]);
        $this->entries->delete($this->userId, $this->tripId, $measured->id);
        self::assertSame([$note->id, $photo->id], array_map(fn ($e) => $e->id, $this->entries->listFor($this->userId, $this->tripId)));
        $heic = $this->entries->add($this->userId, $this->tripId, [], '', ['mediaType' => 'image/heic', 'name' => 'IMG_2.heic'] + self::PHOTO, $this->now);
        self::assertFalse($heic->file['image']);
        self::assertNull($this->entries->listFor($this->otherUserId, $this->tripId));
        self::assertNull($this->entries->add($this->otherUserId, $this->tripId, [], 'Mine', null, $this->now));
        self::assertNull($this->entries->add($this->userId, $this->tripId, ['dayId' => 'nope'], 'Nowhere', null, $this->now));
        self::assertNull($this->entries->find($this->userId, $this->tripId + 1, $note->id));
        self::assertSame('{"id":' . $note->id . ',"tripId":' . $this->tripId . ',"dayId":null,"stopId":null,"routeId":null,"text":"Packed the bags.","file":null,"takenAt":null,"lngLat":null,"takenLngLat":null,"createdAt":"2026-10-27T10:00:00Z","kind":"journal","url":null,"position":0}', json_encode($note));
    }

    public function testPlacesAPhotoOnTheDayOfItsDateWhereAsked(): void
    {
        $taken = ['takenAt' => '2027-06-12T14:30:00', 'lngLat' => [11.45, 47.8]] + self::PHOTO;
        $placed = $this->entries->add($this->userId, $this->tripId, [], '', $taken, $this->now, null, true);
        self::assertSame(['day1', '2027-06-12T14:30:00', [11.45, 47.8]], [$placed->dayId, $placed->takenAt, $placed->lngLat]);
        self::assertNull($this->entries->add($this->userId, $this->tripId, [], '', $taken, $this->now)->dayId);
        $otherDay = ['takenAt' => '2027-06-20T09:00:00'] + self::PHOTO;
        self::assertNull($this->entries->add($this->userId, $this->tripId, [], '', $otherDay, $this->now, null, true)->dayId);
        $onStop = $this->entries->add($this->userId, $this->tripId, ['stopId' => 's1'], '', $taken, $this->now, null, true);
        self::assertSame(['s1', null], [$onStop->stopId, $onStop->dayId]);
    }

    public function testStandsAtTheSpotUnlessThePhotoKnowsBetter(): void
    {
        $note = $this->entries->add($this->userId, $this->tripId, ['dayId' => 'day1'], 'Viewpoint', null, $this->now, [10.5, 47.5]);
        self::assertSame([10.5, 47.5], $note->lngLat);
        $located = ['lngLat' => [11.45, 47.8]] + self::PHOTO;
        $photo = $this->entries->add($this->userId, $this->tripId, ['dayId' => 'day1'], '', $located, $this->now, [10.5, 47.5]);
        self::assertSame([[11.45, 47.8], [11.45, 47.8]], [$photo->lngLat, $photo->takenLngLat]);
        $put = $this->entries->add($this->userId, $this->tripId, ['dayId' => 'day1'], '', self::PHOTO, $this->now, [10.5, 47.5]);
        self::assertSame([[10.5, 47.5], null], [$put->lngLat, $put->takenLngLat]);
    }

    public function testStandsWhereItIsPutOrNowhereAndKeepsWhereItWasTaken(): void
    {
        $photo = $this->entries->add($this->userId, $this->tripId, ['dayId' => 'day1'], '', ['lngLat' => [11.45, 47.8]] + self::PHOTO, $this->now);
        self::assertFalse($this->entries->place($this->otherUserId, $this->tripId, $photo->id, [10.5, 47.5]));
        self::assertTrue($this->entries->place($this->userId, $this->tripId, $photo->id, [10.5, 47.5]));
        $moved = $this->entries->find($this->userId, $this->tripId, $photo->id);
        self::assertSame([[10.5, 47.5], [11.45, 47.8]], [$moved->lngLat, $moved->takenLngLat]);
        self::assertTrue($this->entries->place($this->userId, $this->tripId, $photo->id, null));
        $hidden = $this->entries->find($this->userId, $this->tripId, $photo->id);
        self::assertSame([null, [11.45, 47.8]], [$hidden->lngLat, $hidden->takenLngLat]);
    }

    public function testListsThePhotosOfAllTheUsersTripsThatStandSomewhere(): void
    {
        $here = $this->entries->add($this->userId, $this->tripId, [], '', self::PHOTO, $this->now, [10.5, 47.5]);
        $this->entries->add($this->userId, $this->tripId, [], '', self::PHOTO, $this->now);
        $this->entries->add($this->userId, $this->tripId, [], 'A note with a place.', null, $this->now, [10.6, 47.6]);
        $other = (new Trips($this->db, new Folders($this->db)))->create($this->userId, 'Another', $this->now)->id;
        $there = $this->entries->add($this->userId, $other, [], '', self::PHOTO, $this->now, [11.5, 48.5]);
        self::assertEqualsCanonicalizing([$here->id, $there->id], array_map(fn ($e) => $e->id, $this->entries->photosOnMap($this->userId)));
        self::assertSame([], $this->entries->photosOnMap($this->otherUserId));
    }

    public function testOrdersAChapterAndTakesInEntriesOfOthers(): void
    {
        $add = fn (array $target, string $text) => $this->entries->add($this->userId, $this->tripId, $target, $text, null, $this->now)->id;
        [$onDay, $onRoute, $onTrip, $onStop] = [$add(['dayId' => 'day1'], 'Day'), $add(['routeId' => 'r1'], 'Route'), $add([], 'Trip'), $add(['stopId' => 's1'], 'Stop')];
        $late = $add([], 'Late');
        $listed = fn () => array_map(fn ($e) => [$e->id, $e->dayId, $e->routeId, $e->stopId], $this->entries->listFor($this->userId, $this->tripId));
        self::assertSame([$onDay, $onRoute, $onTrip, $onStop, $late], array_column($listed(), 0));

        self::assertTrue($this->entries->reorder($this->userId, $this->tripId, 'day1', [$onStop, $onRoute, $onDay]));
        self::assertSame([[$onStop, null, null, 's1'], [$onRoute, null, 'r1', null], [$onDay, 'day1', null, null], [$onTrip, null, null, null], [$late, null, null, null]], $listed());
        self::assertTrue($this->entries->reorder($this->userId, $this->tripId, null, [$late, $onRoute, $onTrip]));
        self::assertSame([[$onStop, null, null, 's1'], [$late, null, null, null], [$onRoute, null, null, null], [$onDay, 'day1', null, null], [$onTrip, null, null, null]], $listed());
        self::assertTrue($this->entries->reorder($this->userId, $this->tripId, 'day1', [$onTrip, $onStop, $onDay]));
        self::assertSame([[$onTrip, 'day1', null, null], [$late, null, null, null], [$onRoute, null, null, null], [$onStop, null, null, 's1'], [$onDay, 'day1', null, null]], $listed());

        $media = $this->entries->addMedia($this->userId, $this->tripId, 'day1', 'Hotel', null, 'https://example.org/hotel', $this->now);
        self::assertFalse($this->entries->reorder($this->userId, $this->tripId, 'day1', [$onDay, $media->id]));
        self::assertFalse($this->entries->reorder($this->userId, $this->tripId, 'day1', [$onDay, $onDay]));
        self::assertFalse($this->entries->reorder($this->userId, $this->tripId, 'nope', [$onDay]));
        self::assertFalse($this->entries->reorder($this->otherUserId, $this->tripId, 'day1', [$onDay]));
    }

    public function testLinksAnEntryAnewAndMovesItToTheEndOfAnotherChapter(): void
    {
        $add = fn (array $target, string $text) => $this->entries->add($this->userId, $this->tripId, $target, $text, null, $this->now)->id;
        [$first, $second, $onTrip] = [$add(['dayId' => 'day1'], 'First'), $add(['dayId' => 'day1'], 'Second'), $add([], 'Trip')];
        $linked = fn (int $id) => (fn ($e) => [$e->dayId, $e->routeId, $e->stopId, $e->position])($this->entries->find($this->userId, $this->tripId, $id));
        self::assertTrue($this->entries->relink($this->userId, $this->tripId, $first, ['routeId' => 'r1']));
        self::assertSame([null, 'r1', null, 0], $linked($first));
        self::assertTrue($this->entries->relink($this->userId, $this->tripId, $first, []));
        self::assertSame([null, null, null, 3], $linked($first));
        self::assertTrue($this->entries->relink($this->userId, $this->tripId, $onTrip, ['stopId' => 's2']));
        self::assertSame([null, null, 's2', 4], $linked($onTrip));
        self::assertFalse($this->entries->relink($this->userId, $this->tripId, $second, ['stopId' => 'nope']));
        self::assertFalse($this->entries->relink($this->otherUserId, $this->tripId, $second, []));
        self::assertSame(['day1', null, null, 1], $linked($second));
    }

    public function testRefusesAnEntryOnTwoParts(): void
    {
        $this->expectException(\PDOException::class);
        $this->entries->add($this->userId, $this->tripId, ['dayId' => 'day1', 'stopId' => 's1'], 'Both', null, $this->now);
    }

    public function testEditsAndDeletesOnlyOwnEntries(): void
    {
        $note = $this->entries->add($this->userId, $this->tripId, [], 'Draft', null, $this->now);
        self::assertFalse($this->entries->updateText($this->otherUserId, $this->tripId, $note->id, 'Theirs'));
        self::assertTrue($this->entries->updateText($this->userId, $this->tripId, $note->id, 'Final'));
        self::assertSame('Final', $this->entries->find($this->userId, $this->tripId, $note->id)->text);
        self::assertNull($this->entries->delete($this->otherUserId, $this->tripId, $note->id));
        self::assertSame($note->id, $this->entries->delete($this->userId, $this->tripId, $note->id)->id);
        self::assertNull($this->entries->find($this->userId, $this->tripId, $note->id));
    }

    public function testStaysWithTheDayWhenItsRouteOrStopGoesAndWithTheTripWhenItsDayDoes(): void
    {
        $onStop = $this->entries->add($this->userId, $this->tripId, ['stopId' => 's3'], 'Great cake', null, $this->now);
        $onRoute = $this->entries->add($this->userId, $this->tripId, ['routeId' => 'r1'], 'Hairpins', null, $this->now);
        $kept = $this->entries->add($this->userId, $this->tripId, ['stopId' => 's1'], 'Off we go', null, $this->now);
        $linked = fn ($entry) => (fn ($e) => [$e->dayId, $e->routeId, $e->stopId, $e->text])($this->entries->find($this->userId, $this->tripId, $entry->id));
        $document = TripFixture::document();
        array_pop($document['days'][0]['stops']);
        $this->documents->save($this->userId, $this->tripId, TripDocumentValidator::validated($document), 2, $this->now);
        self::assertSame(['day1', null, null, 'Great cake'], $linked($onStop));
        self::assertSame([null, 'r1', null, 'Hairpins'], $linked($onRoute));
        self::assertSame([null, null, 's1', 'Off we go'], $linked($kept));
        $document['days'] = [TripFixture::day('day2')];
        $this->documents->save($this->userId, $this->tripId, TripDocumentValidator::validated($document), 3, $this->now);
        self::assertSame([null, null, null, 'Great cake'], $linked($onStop));
        self::assertSame([null, null, null, 'Hairpins'], $linked($onRoute));
        self::assertSame([null, null, null, 'Off we go'], $linked($kept));
    }

    public function testKeepsADaysMediaApartFromTheJournal(): void
    {
        $note = $this->entries->add($this->userId, $this->tripId, ['dayId' => 'day1'], 'Packed the bags.', null, $this->now);
        $ticket = $this->entries->addMedia($this->userId, $this->tripId, 'day1', '', ['name' => 'ferry.pdf', 'mediaType' => 'application/pdf', 'size' => 99], null, $this->now);
        $link = $this->entries->addMedia($this->userId, $this->tripId, 'day1', 'Hotel', null, 'https://example.org/hotel', $this->now);
        self::assertSame(['media', 'day1', '', 'ferry.pdf', null], [$ticket->kind, $ticket->dayId, $ticket->text, $ticket->file['name'], $ticket->url]);
        self::assertSame(['media', 'Hotel', null, 'https://example.org/hotel'], [$link->kind, $link->text, $link->file, $link->url]);
        self::assertSame([$note->id], array_map(fn ($e) => $e->id, $this->entries->listFor($this->userId, $this->tripId)));
        self::assertSame([$ticket->id, $link->id], array_map(fn ($e) => $e->id, $this->entries->listFor($this->userId, $this->tripId, Entries::MEDIA)));
        self::assertNull($this->entries->find($this->userId, $this->tripId, $ticket->id));
        self::assertSame($ticket->id, $this->entries->find($this->userId, $this->tripId, $ticket->id, Entries::MEDIA)->id);
        self::assertNull($this->entries->addMedia($this->userId, $this->tripId, 'nope', '', null, 'https://example.org', $this->now));
        self::assertNull($this->entries->addMedia($this->otherUserId, $this->tripId, 'day1', '', null, 'https://example.org', $this->now));
        self::assertNull($this->entries->delete($this->userId, $this->tripId, $ticket->id));
    }

    public function testNamesMediaAnewAndGivesOnlyALinkAnAddress(): void
    {
        $ticket = $this->entries->addMedia($this->userId, $this->tripId, 'day1', '', ['name' => 'ferry.pdf', 'mediaType' => 'application/pdf', 'size' => 99], null, $this->now);
        $link = $this->entries->addMedia($this->userId, $this->tripId, 'day1', 'Hotel', null, 'https://example.org/hotel', $this->now);
        self::assertTrue($this->entries->changeMedia($this->userId, $this->tripId, $ticket->id, 'Ferry', 'https://example.org/no'));
        self::assertTrue($this->entries->changeMedia($this->userId, $this->tripId, $link->id, 'Hotel Post', 'https://example.org/post'));
        self::assertTrue($this->entries->changeMedia($this->userId, $this->tripId, $link->id, 'Hotel Post', null));
        self::assertFalse($this->entries->changeMedia($this->otherUserId, $this->tripId, $link->id, 'Theirs', null));
        $media = $this->entries->listFor($this->userId, $this->tripId, Entries::MEDIA);
        self::assertSame([['Ferry', null], ['Hotel Post', 'https://example.org/post']], array_map(fn ($e) => [$e->text, $e->url], $media));
    }

    public function testMovesAndCopiesMediaToADayOfAnotherTripOfTheUsers(): void
    {
        $trips = new Trips($this->db, new Folders($this->db));
        $otherTrip = $trips->create($this->userId, 'Vosges', $this->now)->id;
        $this->documents->save($this->userId, $otherTrip, TripDocumentValidator::validated(['name' => 'Vosges', 'days' => [TripFixture::day('other-day')]] + TripFixture::document()), 1, $this->now);
        $theirs = $trips->create($this->otherUserId, 'Theirs', $this->now)->id;
        $this->documents->save($this->otherUserId, $theirs, TripDocumentValidator::validated(['days' => [TripFixture::day('their-day')]] + TripFixture::document()), 1, $this->now);
        $ticket = $this->entries->addMedia($this->userId, $this->tripId, 'day1', 'Ferry', ['name' => 'ferry.pdf', 'mediaType' => 'application/pdf', 'size' => 99], null, $this->now);

        $copy = $this->entries->copyMedia($this->userId, $this->tripId, $ticket->id, 'other-day', $this->now);
        self::assertSame([$otherTrip, 'other-day', 'Ferry', 'ferry.pdf'], [$copy->tripId, $copy->dayId, $copy->text, $copy->file['name']]);
        self::assertNotSame($ticket->id, $copy->id);
        self::assertNull($this->entries->copyMedia($this->userId, $this->tripId, $ticket->id, 'their-day', $this->now));
        self::assertNull($this->entries->moveMedia($this->userId, $this->tripId, $ticket->id, 'their-day'));
        self::assertNull($this->entries->moveMedia($this->otherUserId, $this->tripId, $ticket->id, 'their-day'));

        $moved = $this->entries->moveMedia($this->userId, $this->tripId, $ticket->id, 'other-day');
        self::assertSame([$ticket->id, $otherTrip, 'other-day'], [$moved->id, $moved->tripId, $moved->dayId]);
        self::assertSame([], $this->entries->listFor($this->userId, $this->tripId, Entries::MEDIA));
        self::assertCount(2, $this->entries->listFor($this->userId, $otherTrip, Entries::MEDIA));
    }

    public function testTakesTheMediaOfADayThatIsGoneAndCopiesThoseOfATripsDaysToItsCopy(): void
    {
        $document = TripFixture::document();
        $document['days'][] = TripFixture::day('day2');
        $this->documents->save($this->userId, $this->tripId, TripDocumentValidator::validated($document), 2, $this->now);
        $kept = $this->entries->addMedia($this->userId, $this->tripId, 'day1', 'Map', ['name' => 'map.pdf', 'mediaType' => 'application/pdf', 'size' => 5], null, $this->now);
        $lost = $this->entries->addMedia($this->userId, $this->tripId, 'day2', 'Ferry', null, 'https://example.org/ferry', $this->now);
        $note = $this->entries->add($this->userId, $this->tripId, ['dayId' => 'day2'], 'A note', null, $this->now);

        $copyId = $this->documents->copy($this->userId, $this->tripId, $this->now);
        $copies = $this->entries->copyMediaOfTrip($this->tripId, $copyId, $this->now);
        self::assertSame([[$kept->id, 'Map'], [$lost->id, 'Ferry']], array_map(fn ($pair) => [$pair[0]->id, $pair[1]->text], $copies));
        $copiedDays = array_column($this->documents->load($this->userId, $copyId)['days'], 'id');
        self::assertSame($copiedDays, array_map(fn ($pair) => $pair[1]->dayId, $copies));
        self::assertSame([], $this->entries->listFor($this->userId, $copyId));

        self::assertSame([], $this->entries->takeMediaWithoutDay($this->tripId));
        $this->documents->save($this->userId, $this->tripId, TripDocumentValidator::validated(TripFixture::document()), 3, $this->now);
        self::assertSame([$lost->id], array_map(fn ($e) => $e->id, $this->entries->takeMediaWithoutDay($this->tripId)));
        self::assertSame([$kept->id], array_map(fn ($e) => $e->id, $this->entries->listFor($this->userId, $this->tripId, Entries::MEDIA)));
        self::assertNull($this->entries->find($this->userId, $this->tripId, $note->id)->dayId);
    }

    public function testReadsTimeAndPositionFromExifData(): void
    {
        $data = [
            'EXIF' => ['DateTimeOriginal' => '2027:06:12 14:30:05'],
            'GPS' => ['GPSLatitudeRef' => 'N', 'GPSLatitude' => ['47/1', '48/1', '0/1'], 'GPSLongitudeRef' => 'E', 'GPSLongitude' => ['11/1', '27/1', '3600/100']],
        ];
        $read = Exif::fromData($data);
        self::assertSame('2027-06-12T14:30:05', $read['takenAt']);
        self::assertEqualsWithDelta(11.46, $read['lngLat'][0], 1e-9);
        self::assertEqualsWithDelta(47.8, $read['lngLat'][1], 1e-9);
        self::assertSame(['takenAt' => null, 'lngLat' => null], Exif::fromData([]));
        $south = $data;
        $south['GPS']['GPSLatitudeRef'] = 'S';
        self::assertLessThan(0, Exif::fromData($south)['lngLat'][1]);
        $broken = $data;
        $broken['GPS']['GPSLongitude'] = ['11/0', '27/1', '0/1'];
        self::assertNull(Exif::fromData($broken)['lngLat']);
    }
}
