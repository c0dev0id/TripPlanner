<?php

declare(strict_types=1);

namespace Planner\Tests\Poi;

use DateTimeImmutable;
use PHPUnit\Framework\TestCase;
use Planner\Account\Users;
use Planner\Poi\OwnPlaces;
use Planner\Tests\TestDatabase;
use Planner\Tests\Trip\TripFixture;
use Planner\Trip\Folders;
use Planner\Trip\TripDocuments;
use Planner\Trip\TripDocumentValidator;
use Planner\Trip\Trips;

final class OwnPlacesTest extends TestCase
{
    public function testGivesThePlacesOfTheListsInTheFolderForPlacesAndInNoOther(): void
    {
        $db = TestDatabase::create();
        $now = new DateTimeImmutable('2026-11-14T10:00:00Z');
        $userId = (new Users($db))->create('rider@example.com', 'correct horse battery', $now)->id;
        $folders = new Folders($db);
        $trips = new Trips($db, $folders);
        $documents = new TripDocuments($db);
        $special = array_column($folders->listFor($userId), 'id', 'kind');
        $save = function (int $tripId, array $days) use ($documents, $userId, $now): void {
            $documents->save($userId, $tripId, TripDocumentValidator::validated(['name' => 'Our places', 'days' => $days] + TripFixture::document()), 1, $now);
        };

        $list = $trips->create($userId, 'Our places', $now, $folders->create($userId, 'Club', $special['places'], $now)->id, 'collection')->id;
        $save($list, [
            ['name' => 'Inns'] + TripFixture::day('inns', [], [['website' => 'https://post.example/'] + TripFixture::stop('p2', 'Post', [8.5, 47.1], null, 'Restaurant'), TripFixture::stop('p1', 'Adler', [8.4, 47.0], null)]),
            ['name' => 'Hotels'] + TripFixture::day('hotels', [], [TripFixture::stop('p3', 'Krone', [8.6, 47.2], null)]),
        ]);
        $elsewhere = $trips->create($userId, 'Material', $now, $special['collections'], 'collection')->id;
        $save($elsewhere, [TripFixture::day('other', [], [TripFixture::stop('w1', 'Waypoint', [9.0, 46.0], null)])]);

        $places = (new OwnPlaces($db))->of($userId);
        self::assertSame([['Adler', 'Inns'], ['Post', 'Inns'], ['Krone', 'Hotels']], array_map(fn (array $p) => [$p['name'], $p['kind']], $places));
        self::assertSame(
            ['id' => 'p2', 'name' => 'Post', 'symbol' => 'Restaurant', 'lngLat' => [8.5, 47.1], 'address' => '', 'contact' => '', 'website' => 'https://post.example/', 'notes' => '', 'tripId' => $list, 'list' => 'Our places', 'dayId' => 'inns', 'kind' => 'Inns'],
            $places[1],
        );
        self::assertSame([], (new OwnPlaces($db))->of($userId + 1));
    }
}
