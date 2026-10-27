<?php

declare(strict_types=1);

namespace Planner\Trip;

use Planner\Name;

/**
 * Checks a trip document sent by the client and returns it in the shape TripDocuments
 * stores: every field present, typed and within bounds. Throws InvalidDocument otherwise.
 */
final class TripDocumentValidator
{
    public const STOP_KINDS = ['hotel', 'restaurant', 'cafe', 'fuel', 'sight', 'photo', 'break', 'other'];
    public const ROUTE_KINDS = ['routed', 'track'];
    public const PROFILES = ['car', 'bike', 'foot'];
    public const STATES = ['planned', 'done'];
    private const MAX_TEXT = 20000;

    public static function validated(mixed $body): array
    {
        if (!is_array($body)) {
            throw new InvalidDocument('The document must be a JSON object.');
        }
        $days = [];
        foreach (self::list($body, 'days') as $i => $day) {
            $days[] = self::day($day, "days[$i]");
        }
        self::unique(array_column($days, 'id'), 'days');
        return [
            'name' => Name::of($body['name'] ?? null) ?? throw new InvalidDocument('document.name must be text of up to 200 characters, not empty.'),
            'description' => self::text($body, 'description', 'document'),
            'state' => self::oneOf($body, 'state', self::STATES, 'document'),
            'days' => $days,
        ];
    }


    private static function day(mixed $day, string $at): array
    {
        if (!is_array($day)) {
            throw new InvalidDocument("$at must be an object.");
        }
        $routes = [];
        $positions = [];
        foreach (self::list($day, 'routes') as $i => $route) {
            $routes[] = $checked = self::route($route, "$at.routes[$i]");
            foreach ($checked['points'] as $point) {
                if (isset($positions[$point['id']])) {
                    throw new InvalidDocument("$at.routes' points hold the same id twice.");
                }
                $positions[$point['id']] = $point['lngLat'];
            }
        }
        self::unique(array_column($routes, 'id'), "$at.routes");
        $stops = [];
        foreach (self::list($day, 'stops') as $i => $stop) {
            $stops[] = self::stop($stop, $positions, "$at.stops[$i]");
        }
        self::unique(array_column($stops, 'id'), "$at.stops");
        return [
            'id' => self::id($day, $at),
            'name' => self::text($day, 'name', $at, 200),
            'date' => self::date($day, 'date', $at),
            'notes' => self::text($day, 'notes', $at),
            'routes' => $routes,
            'stops' => $stops,
        ];
    }

    /** @param array<string, array{0: float, 1: float}> $positions the day's route points by id */
    private static function stop(mixed $stop, array $positions, string $at): array
    {
        if (!is_array($stop)) {
            throw new InvalidDocument("$at must be an object.");
        }
        $lngLat = self::lngLat($stop['lngLat'] ?? null, "$at.lngLat");
        $pointId = $stop['pointId'] ?? null;
        if ($pointId !== null) {
            if (!is_string($pointId) || !isset($positions[$pointId])) {
                throw new InvalidDocument("$at.pointId names no route point of the day.");
            }
            if ($positions[$pointId] !== $lngLat) {
                throw new InvalidDocument("$at must stand at its route point.");
            }
        }
        $arriveAt = self::time($stop, 'arriveAt', $at);
        $pause = $stop['pauseMinutes'] ?? null;
        if ($pause !== null && !(is_int($pause) && $pause >= 0 && $pause <= 24 * 60)) {
            throw new InvalidDocument("$at.pauseMinutes must be a number of minutes or null.");
        }
        return [
            'id' => self::id($stop, $at),
            'name' => self::text($stop, 'name', $at, 200),
            'kind' => self::oneOf($stop, 'kind', self::STOP_KINDS, $at),
            'lngLat' => $lngLat,
            'pointId' => $pointId,
            'address' => self::text($stop, 'address', $at),
            'contact' => self::text($stop, 'contact', $at),
            'bookingReference' => self::text($stop, 'bookingReference', $at),
            'notes' => self::text($stop, 'notes', $at),
            'arriveAt' => $arriveAt,
            'pauseMinutes' => $pause,
            'optional' => self::bool($stop, 'optional', $at),
        ];
    }

    private static function route(mixed $route, string $at): array
    {
        if (!is_array($route)) {
            throw new InvalidDocument("$at must be an object.");
        }
        $points = [];
        foreach (self::list($route, 'points') as $i => $point) {
            if (!is_array($point)) {
                throw new InvalidDocument("$at.points[$i] must be an object.");
            }
            $straight = $point['straight'] ?? false;
            if (!is_bool($straight)) {
                throw new InvalidDocument("$at.points[$i].straight must be a boolean.");
            }
            $points[] = ['id' => self::id($point, "$at.points[$i]"), 'lngLat' => self::lngLat($point['lngLat'] ?? null, "$at.points[$i].lngLat")] + ($straight ? ['straight' => true] : []);
        }
        $legs = $route['legs'] ?? null;
        if (!is_array($legs) || array_is_list($legs) && $legs !== []) {
            throw new InvalidDocument("$at.legs must be an object.");
        }
        foreach ($legs as $key => $leg) {
            $duration = $leg['durationS'] ?? null;
            if (!is_string($key) || !is_array($leg) || !is_string($leg['geometry'] ?? null) || !is_numeric($leg['distanceM'] ?? null) || !($duration === null || is_numeric($duration))) {
                throw new InvalidDocument("$at.legs must map leg keys to geometry, distanceM and durationS (a number or null).");
            }
            $legs[$key] = ['geometry' => $leg['geometry'], 'distanceM' => (int) round($leg['distanceM']), 'durationS' => $duration === null ? null : (int) round($duration)];
        }
        return [
            'id' => self::id($route, $at),
            'name' => self::text($route, 'name', $at, 200),
            'kind' => self::oneOf($route, 'kind', self::ROUTE_KINDS, $at),
            'profile' => self::oneOf($route, 'profile', self::PROFILES, $at),
            'optional' => self::bool($route, 'optional', $at),
            'points' => $points,
            'legs' => $legs,
        ];
    }

    private static function list(array $parent, string $key): array
    {
        $value = $parent[$key] ?? null;
        if (!is_array($value) || !array_is_list($value)) {
            throw new InvalidDocument("$key must be a list.");
        }
        return $value;
    }

    private static function id(array $parent, string $at, string $key = 'id'): string
    {
        $value = $parent[$key] ?? null;
        if (!is_string($value) || $value === '' || strlen($value) > 64) {
            throw new InvalidDocument("$at.$key must be an id of up to 64 characters.");
        }
        return $value;
    }

    private static function text(array $parent, string $key, string $at, int $max = self::MAX_TEXT): string
    {
        $value = $parent[$key] ?? '';
        if (!is_string($value) || strlen($value) > $max) {
            throw new InvalidDocument("$at.$key must be text of up to $max characters.");
        }
        return $value;
    }

    private static function oneOf(array $parent, string $key, array $allowed, string $at): string
    {
        $value = $parent[$key] ?? null;
        if (!in_array($value, $allowed, true)) {
            throw new InvalidDocument("$at.$key must be one of " . implode(', ', $allowed) . '.');
        }
        return $value;
    }

    private static function bool(array $parent, string $key, string $at): bool
    {
        $value = $parent[$key] ?? false;
        if (!is_bool($value)) {
            throw new InvalidDocument("$at.$key must be a boolean.");
        }
        return $value;
    }

    private static function time(array $parent, string $key, string $at): ?string
    {
        $value = $parent[$key] ?? null;
        if ($value !== null && !(is_string($value) && preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $value))) {
            throw new InvalidDocument("$at.$key must be a time as HH:MM or null.");
        }
        return $value;
    }

    private static function date(array $parent, string $key, string $at): ?string
    {
        $value = $parent[$key] ?? null;
        if ($value !== null && !(is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) && checkdate((int) substr($value, 5, 2), (int) substr($value, 8, 2), (int) substr($value, 0, 4)))) {
            throw new InvalidDocument("$at.$key must be a date as YYYY-MM-DD or null.");
        }
        return $value;
    }

    /** @return array{0: float, 1: float} */
    private static function lngLat(mixed $value, string $at): array
    {
        if (!is_array($value) || count($value) !== 2 || !is_numeric($value[0] ?? null) || !is_numeric($value[1] ?? null)) {
            throw new InvalidDocument("$at must be [longitude, latitude].");
        }
        [$lng, $lat] = [(float) $value[0], (float) $value[1]];
        if ($lng < -180 || $lng > 180 || $lat < -90 || $lat > 90) {
            throw new InvalidDocument("$at is outside the world.");
        }
        return [$lng, $lat];
    }

    private static function unique(array $ids, string $at): void
    {
        if (count($ids) !== count(array_unique($ids))) {
            throw new InvalidDocument("$at holds the same id twice.");
        }
    }
}
