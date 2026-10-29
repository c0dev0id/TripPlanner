<?php

declare(strict_types=1);

namespace Planner\Tests\Trip;

use DateTimeImmutable;
use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Account\Users;
use Planner\Tests\TestDatabase;
use Planner\Trip\Duplicates;
use Planner\Trip\Folders;
use Planner\Trip\TripDocuments;
use Planner\Trip\TripDocumentValidator;
use Planner\Trip\Trips;

final class DuplicatesTest extends TestCase
{
    /** The fixture's route as tracks recorded along it, about 15 m east and west of it. */
    private const EAST = '_ixvzAoi||T~qy@nwH~qy@nwH~qy@nwH~qy@nwH~qy@nwH~qy@nwH~qy@nwH~qy@nwH~qy@nwH~qy@nwH~s`BnwH~s`BnwH~s`BnwH~s`BnwH~s`BnwH~s`BnwH~s`BnwH~s`BnwH~s`BnwH~s`BnwH';
    private const WEST = '_ixvzAop{|T~qy@nwH~qy@nwH~qy@nwH~qy@nwH~qy@nwH~qy@nwH~qy@nwH~qy@nwH~qy@nwH~qy@nwH~s`BnwH~s`BnwH~s`BnwH~s`BnwH~s`BnwH~s`BnwH~s`BnwH~s`BnwH~s`BnwH~s`BnwH';

    private PDO $db;
    private Trips $trips;
    private TripDocuments $documents;
    private int $userId;
    private DateTimeImmutable $now;

    protected function setUp(): void
    {
        $this->db = TestDatabase::create();
        $this->now = new DateTimeImmutable('2026-10-27T10:00:00Z');
        $this->userId = (new Users($this->db))->create('rider@example.com', 'correct horse battery', $this->now)->id;
        $this->trips = new Trips($this->db, new Folders($this->db));
        $this->documents = new TripDocuments($this->db);
    }

    /** A trip of one day on `date` with the routes, saved for `userId`; its days and routes named after it. */
    private function trip(string $name, ?string $date, array $routes, ?int $userId = null): int
    {
        $userId ??= $this->userId;
        $id = $this->trips->create($userId, $name, $this->now)->id;
        $day = ['date' => $date, 'name' => "$name day"] + TripFixture::day("$name-d", $routes);
        $this->documents->save($userId, $id, TripDocumentValidator::validated(['name' => $name, 'description' => '', 'state' => 'planned', 'days' => [$day]]), 1, $this->now);
        return $id;
    }

    private function route(string $id, string $name = ''): array
    {
        return ['name' => $name] + TripFixture::route($id, [[11.5, 48.1], [11.45, 47.8], [11.4, 47.3]]);
    }

    private function track(string $id, string $line): array
    {
        return ['line' => $line] + TripFixture::track($id);
    }

    public function testFindsCopiesWhateverTheirDate(): void
    {
        $alps = $this->trip('Alps', '2027-06-12', [$this->route('r1', 'Pass')]);
        $this->trip('Later', '2028-01-01', [$this->route('r2')]);
        $this->trip('Elsewhere', null, [TripFixture::route('r3', [[8, 50], [8.1, 50.1]])]);
        self::assertSame(
            [['kind' => 'copies', 'routes' => [
                ['tripId' => $alps, 'tripName' => 'Alps', 'tripKind' => 'trip', 'dayId' => 'Alps-d', 'dayIndex' => 0, 'dayName' => 'Alps day', 'date' => '2027-06-12', 'routeId' => 'r1', 'routeName' => 'Pass', 'distanceM' => 89_300],
                ['tripId' => $alps + 1, 'tripName' => 'Later', 'tripKind' => 'trip', 'dayId' => 'Later-d', 'dayIndex' => 0, 'dayName' => 'Later day', 'date' => '2028-01-01', 'routeId' => 'r2', 'routeName' => '', 'distanceM' => 89_300],
            ]]],
            $this->roundedDistances((new Duplicates($this->db))->of($this->userId)),
        );
    }

    public function testFindsTheSameRideKeptTwiceOnTheSameDateOrAnUndatedDay(): void
    {
        $this->trip('Planned', '2027-06-12', [$this->route('r1')]);
        $this->trip('Recorded', '2027-06-12', [$this->track('t1', self::EAST)]);
        $this->trip('Reference', null, [$this->track('t2', self::WEST)]);
        $this->trip('Again', '2027-07-01', [$this->track('t3', self::WEST)]);
        $groups = (new Duplicates($this->db))->of($this->userId);
        self::assertSame(['same ride'], array_column($groups, 'kind'));
        // In the order of their trips' names; the ride a month later is the same road ridden again, but a copy of the undated reference.
        self::assertSame(['t3', 'r1', 't1', 't2'], array_column($groups[0]['routes'], 'routeId'));
    }

    public function testLeavesTheSameRoadOnAnotherDateAndOtherUsersAlone(): void
    {
        $this->trip('Planned', '2027-06-12', [$this->route('r1')]);
        $this->trip('Again', '2027-07-01', [$this->track('t1', self::EAST)]);
        $other = (new Users($this->db))->create('other@example.com', 'correct horse battery', $this->now)->id;
        $this->trip('Theirs', '2027-06-12', [$this->route('o1')], $other);
        self::assertSame([], (new Duplicates($this->db))->of($this->userId));
    }

    /** The groups with each route's length to the 100 m, which is all the tests know of it. */
    private function roundedDistances(array $groups): array
    {
        foreach ($groups as &$group) {
            foreach ($group['routes'] as &$route) {
                $route['distanceM'] = (int) round($route['distanceM'], -2);
            }
        }
        return $groups;
    }
}
