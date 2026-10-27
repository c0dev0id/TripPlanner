<?php

declare(strict_types=1);

namespace Planner\Trip;

/** A trip as the library lists it. */
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

    public function toArray(): array
    {
        return ['id' => $this->id, 'name' => $this->name, 'startsOn' => $this->startsOn, 'dayCount' => $this->dayCount, 'updatedAt' => $this->updatedAt];
    }
}
