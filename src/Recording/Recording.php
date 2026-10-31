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
    ) {
    }
}
