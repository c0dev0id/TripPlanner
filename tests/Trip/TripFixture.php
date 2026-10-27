<?php

declare(strict_types=1);

namespace Planner\Tests\Trip;

/** A small valid trip document: two places, one day with two stops and the route between them. */
final class TripFixture
{
    public static function document(): array
    {
        return [
            'name' => 'Alps',
            'description' => 'A weekend.',
            'startsOn' => '2027-06-12',
            'places' => [
                self::place('home', 'Home', [11.5, 48.1]),
                self::place('hotel', 'Hotel Post', [11.4, 47.3], 'hotel'),
            ],
            'days' => [
                [
                    'id' => 'day1',
                    'name' => 'South',
                    'date' => null,
                    'notes' => '',
                    'stops' => [self::stop('s1', 'home'), self::stop('s2', 'hotel', 'overnight')],
                    'routes' => [self::route('r1', [11.5, 48.1], [11.4, 47.3])],
                ],
            ],
        ];
    }

    public static function place(string $id, string $name, array $lngLat, string $kind = 'other'): array
    {
        return ['id' => $id, 'name' => $name, 'kind' => $kind, 'lngLat' => $lngLat, 'address' => '', 'contact' => '', 'bookingReference' => '', 'notes' => ''];
    }

    public static function stop(string $id, string $placeId, string $role = 'visit'): array
    {
        return ['id' => $id, 'placeId' => $placeId, 'role' => $role, 'arriveAt' => null, 'pauseMinutes' => null, 'optional' => false, 'notes' => ''];
    }

    public static function route(string $id, array $from, array $to, array $legs = []): array
    {
        return [
            'id' => $id,
            'name' => '',
            'kind' => 'routed',
            'profile' => 'car',
            'optional' => false,
            'points' => [['id' => "$id-a", 'lngLat' => $from], ['id' => "$id-b", 'lngLat' => $to]],
            'legs' => $legs,
        ];
    }
}
