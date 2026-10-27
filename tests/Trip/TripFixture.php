<?php

declare(strict_types=1);

namespace Planner\Tests\Trip;

/**
 * A small valid trip document: one day with a route of three points, a stop bound to its
 * first and last point, and a free stop beside it.
 */
final class TripFixture
{
    public static function document(): array
    {
        return [
            'name' => 'Alps',
            'description' => 'A weekend.',
            'state' => 'planned',
            'days' => [
                [
                    'id' => 'day1',
                    'name' => 'South',
                    'date' => '2027-06-12',
                    'notes' => '',
                    'routes' => [self::route('r1', [[11.5, 48.1], [11.45, 47.8], [11.4, 47.3]])],
                    'stops' => [
                        self::stop('s1', 'Home', [11.5, 48.1], 'r1-0'),
                        self::stop('s2', 'Hotel Post', [11.4, 47.3], 'r1-2', 'hotel'),
                        self::stop('s3', 'Café & Bar', [11.46, 47.81], null, 'cafe'),
                    ],
                ],
            ],
        ];
    }

    public static function stop(string $id, string $name, array $lngLat, ?string $pointId, string $kind = 'other'): array
    {
        return [
            'id' => $id,
            'name' => $name,
            'kind' => $kind,
            'lngLat' => $lngLat,
            'pointId' => $pointId,
            'address' => '',
            'contact' => '',
            'bookingReference' => '',
            'notes' => '',
            'arriveAt' => null,
            'pauseMinutes' => null,
            'optional' => false,
        ];
    }

    /** A route whose points are named `<id>-<index>`. */
    public static function route(string $id, array $positions, array $legs = []): array
    {
        return [
            'id' => $id,
            'name' => '',
            'kind' => 'routed',
            'profile' => 'car',
            'optional' => false,
            'points' => array_map(fn (int $i, array $lngLat) => ['id' => "$id-$i", 'lngLat' => $lngLat], array_keys($positions), $positions),
            'legs' => $legs,
        ];
    }

    public static function day(string $id, array $routes = [], array $stops = []): array
    {
        return ['id' => $id, 'name' => '', 'date' => null, 'notes' => '', 'routes' => $routes, 'stops' => $stops];
    }
}
