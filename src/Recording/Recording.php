<?php

declare(strict_types=1);

namespace Planner\Recording;

/** A ride as recorded, kept on a day of a trip; its public properties are its JSON. */
final readonly class Recording
{
    public function __construct(
        public int $id,
        public string $dayId,
        public string $name,
        /** Its length in metres, and the time of its first point in UTC, null where its file gives none. */
        public int $distanceM,
        public ?string $startedAt,
    ) {
    }
}
