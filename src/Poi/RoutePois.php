<?php

declare(strict_types=1);

namespace Planner\Poi;

/** What a POI search found along a route for one kind of place; its public properties are its JSON. */
final readonly class RoutePois
{
    /**
     * @param int $reachM how far from the route was searched, in metres
     * @param string $lineMark the planner's mark of the line the route had then
     * @param list<array{id: string, lngLat: array{float, float}, tags: array<string, string>}> $places
     * @param string $foundAt when, as an ISO 8601 time
     */
    public function __construct(
        public string $routeId,
        public string $category,
        public int $reachM,
        public string $lineMark,
        public array $places,
        public string $foundAt,
    ) {
    }
}
