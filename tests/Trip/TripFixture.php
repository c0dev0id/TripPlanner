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
                        self::stop('s2', 'Hotel Post', [11.4, 47.3], 'r1-2', 'Hotel'),
                        self::stop('s3', 'Café & Bar', [11.46, 47.81], null, 'Navaid, Black'),
                    ],
                ],
            ],
        ];
    }

    public static function stop(string $id, string $name, array $lngLat, ?string $pointId, ?string $symbol = null): array
    {
        return [
            'id' => $id,
            'name' => $name,
            'symbol' => $symbol,
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
            'profile' => 'motorcycle',
            'highways' => 'allow',
            'optional' => false,
            'points' => array_map(fn (int $i, array $lngLat) => ['id' => "$id-$i", 'lngLat' => $lngLat], array_keys($positions), $positions),
            'legs' => $legs,
        ];
    }

    /** A track south from Hotel Post: 11.4,47.3 to 11.35,47.2 to 11.3,47.1. */
    public static function track(string $id): array
    {
        return ['id' => $id, 'name' => '', 'kind' => 'track', 'profile' => 'motorcycle', 'optional' => false, 'line' => '_y}eyA_sxvT~hbE~s`B~hbE~s`B'];
    }

    public static function day(string $id, array $routes = [], array $stops = []): array
    {
        return ['id' => $id, 'name' => '', 'date' => null, 'notes' => '', 'routes' => $routes, 'stops' => $stops];
    }
}
