<?php

declare(strict_types=1);

namespace Planner\Tests\Trip;

use PHPUnit\Framework\TestCase;
use Planner\Trip\TripMerge;

final class TripMergeTest extends TestCase
{
    private static function day(string $id, ?string $date, string $name = '', string $notes = ''): array
    {
        return ['id' => $id, 'date' => $date, 'name' => $name, 'notes' => $notes, 'routes' => [['id' => "$id-r"]], 'stops' => [['id' => "$id-s"]]];
    }

    public function testJoinsTheDayOfTheSameDateAndPlacesTheOthersByDate(): void
    {
        $merged = TripMerge::days('trip', [self::day('a', '2027-06-12'), self::day('b', '2027-06-14', 'North', 'Early start')], [
            self::day('x', '2027-06-14', 'Pass', 'Fuel up'),
            self::day('y', '2027-06-13'),
            self::day('z', null, 'Loose'),
            self::day('w', '2027-06-01'),
        ]);
        self::assertSame(['w', 'a', 'y', 'b', 'z'], array_column($merged['days'], 'id'));
        self::assertSame(['x' => 'b'], $merged['joined']);
        $b = $merged['days'][3];
        self::assertSame(['North', "Early start\n\nFuel up", ['b-r', 'x-r'], ['b-s', 'x-s']], [$b['name'], $b['notes'], array_column($b['routes'], 'id'), array_column($b['stops'], 'id')]);
    }

    public function testNamesAJoinedDayAfterTheOtherWhereItHasNoName(): void
    {
        $merged = TripMerge::days('trip', [self::day('a', '2027-06-12')], [self::day('x', '2027-06-12', 'Pass')]);
        self::assertSame(['Pass', ''], [$merged['days'][0]['name'], $merged['days'][0]['notes']]);
    }

    public function testAppendsTheSectionsOfACollection(): void
    {
        $merged = TripMerge::days('collection', [self::day('a', null, 'Austria')], [self::day('x', null, 'France'), self::day('y', null, 'Austria')]);
        self::assertSame(['a', 'x', 'y'], array_column($merged['days'], 'id'));
        self::assertSame([], $merged['joined']);
    }
}
