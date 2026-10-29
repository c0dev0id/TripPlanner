<?php

declare(strict_types=1);

namespace Planner\Trip;

/** A trip as the library lists it; its public properties are its JSON. */
final readonly class TripSummary
{
    public function __construct(
        public int $id,
        /** A trip, or a collection of planning material. */
        public string $kind,
        public string $name,
        public ?int $folderId,
        /** Planned, or ridden: done. */
        public string $state,
        public ?string $startsOn,
        public int $dayCount,
        public string $updatedAt,
    ) {
    }
}
