<?php

declare(strict_types=1);

namespace Planner\Trip;

/** A trip as the library lists it; its public properties are its JSON. */
final readonly class TripSummary
{
    public function __construct(
        public int $id,
        public string $name,
        public ?string $startsOn,
        public int $dayCount,
        public string $updatedAt,
    ) {
    }
}
