<?php

declare(strict_types=1);

namespace Planner\Trip;

/**
 * Checks a trip document sent by the client and returns it in the shape TripDocuments
 * stores: every field present, typed and within bounds. Throws InvalidDocument otherwise.
 */
final class TripDocumentValidator
{
    public const PLACE_KINDS = ['hotel', 'restaurant', 'fuel', 'sight', 'other'];
    public const STOP_ROLES = ['overnight', 'lunch', 'break', 'fuel', 'visit', 'photo'];
    public const ROUTE_KINDS = ['routed', 'track'];
    public const PROFILES = ['car', 'bike', 'foot'];
    private const MAX_TEXT = 20000;

    public static function validated(mixed $body): array
    {
        if (!is_array($body)) {
            throw new InvalidDocument('The document must be a JSON object.');
        }
        $places = [];
        foreach (self::list($body, 'places') as $i => $place) {
            $places[] = self::place($place, "places[$i]");
        }
        $placeIds = array_column($places, 'id');
        self::unique($placeIds, 'places');
        $days = [];
        foreach (self::list($body, 'days') as $i => $day) {
            $days[] = self::day($day, $placeIds, $places, "days[$i]");
        }
        self::unique(array_column($days, 'id'), 'days');
        return [
            'name' => self::text($body, 'name', 'document', 200, required: true),
            'description' => self::text($body, 'description', 'document'),
            'startsOn' => self::date($body, 'startsOn', 'document'),
            'places' => $places,
            'days' => $days,
        ];
    }

    private static function place(mixed $place, string $at): array
    {
        if (!is_array($place)) {
            throw new InvalidDocument("$at must be an object.");
        }
        return [
            'id' => self::id($place, $at),
            'name' => self::text($place, 'name', $at, 200),
            'kind' => self::oneOf($place, 'kind', self::PLACE_KINDS, $at),
            'lngLat' => self::lngLat($place['lngLat'] ?? null, "$at.lngLat"),
            'address' => self::text($place, 'address', $at),
            'contact' => self::text($place, 'contact', $at),
            'bookingReference' => self::text($place, 'bookingReference', $at),
            'notes' => self::text($place, 'notes', $at),
        ];
    }

    private static function day(mixed $day, array $placeIds, array $places, string $at): array
    {
        if (!is_array($day)) {
            throw new InvalidDocument("$at must be an object.");
        }
        $stops = [];
        foreach (self::list($day, 'stops') as $i => $stop) {
            $stops[] = self::stop($stop, $placeIds, "$at.stops[$i]");
        }
        self::unique(array_column($stops, 'id'), "$at.stops");
        $routes = self::list($day, 'routes');
        if (count($routes) !== max(0, count($stops) - 1)) {
            throw new InvalidDocument("$at.routes must hold one route per pair of consecutive stops.");
        }
        $positions = array_column($places, 'lngLat', 'id');
        $checked = [];
        foreach ($routes as $i => $route) {
            $from = $positions[$stops[$i]['placeId']];
            $to = $positions[$stops[$i + 1]['placeId']];
            $checked[] = self::route($route, $from, $to, "$at.routes[$i]");
        }
        self::unique(array_column($checked, 'id'), "$at.routes");
        return [
            'id' => self::id($day, $at),
            'name' => self::text($day, 'name', $at, 200),
            'date' => self::date($day, 'date', $at),
            'notes' => self::text($day, 'notes', $at),
            'stops' => $stops,
            'routes' => $checked,
        ];
    }

    private static function stop(mixed $stop, array $placeIds, string $at): array
    {
        if (!is_array($stop)) {
            throw new InvalidDocument("$at must be an object.");
        }
        $placeId = self::id($stop, $at, 'placeId');
        if (!in_array($placeId, $placeIds, true)) {
            throw new InvalidDocument("$at.placeId names no place of the trip.");
        }
        $arriveAt = $stop['arriveAt'] ?? null;
        if ($arriveAt !== null && !(is_string($arriveAt) && preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $arriveAt))) {
            throw new InvalidDocument("$at.arriveAt must be a time as HH:MM or null.");
        }
        $pause = $stop['pauseMinutes'] ?? null;
        if ($pause !== null && !(is_int($pause) && $pause >= 0 && $pause <= 24 * 60)) {
            throw new InvalidDocument("$at.pauseMinutes must be a number of minutes or null.");
        }
        return [
            'id' => self::id($stop, $at),
            'placeId' => $placeId,
            'role' => self::oneOf($stop, 'role', self::STOP_ROLES, $at),
            'arriveAt' => $arriveAt,
            'pauseMinutes' => $pause,
            'optional' => self::bool($stop, 'optional', $at),
            'notes' => self::text($stop, 'notes', $at),
        ];
    }

    private static function route(mixed $route, array $from, array $to, string $at): array
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
        if (count($points) < 2) {
            throw new InvalidDocument("$at.points must hold at least the two stops' positions.");
        }
        if ($points[0]['lngLat'] !== $from || $points[count($points) - 1]['lngLat'] !== $to) {
            throw new InvalidDocument("$at.points must start and end at the positions of its stops.");
        }
        $legs = $route['legs'] ?? null;
        if (!is_array($legs) || array_is_list($legs) && $legs !== []) {
            throw new InvalidDocument("$at.legs must be an object.");
        }
        foreach ($legs as $key => $leg) {
            if (!is_string($key) || !is_array($leg) || !is_string($leg['geometry'] ?? null) || !is_numeric($leg['distanceM'] ?? null) || !is_numeric($leg['durationS'] ?? null)) {
                throw new InvalidDocument("$at.legs must map leg keys to geometry, distanceM and durationS.");
            }
            $legs[$key] = ['geometry' => $leg['geometry'], 'distanceM' => (int) round($leg['distanceM']), 'durationS' => (int) round($leg['durationS'])];
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

    private static function text(array $parent, string $key, string $at, int $max = self::MAX_TEXT, bool $required = false): string
    {
        $value = $parent[$key] ?? '';
        if (!is_string($value) || strlen($value) > $max || ($required && trim($value) === '')) {
            throw new InvalidDocument("$at.$key must be text of up to $max characters" . ($required ? ', not empty.' : '.'));
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
