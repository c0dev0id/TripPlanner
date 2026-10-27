<?php

declare(strict_types=1);

namespace Planner\Trip;

/** A folder of the library; its public properties are its JSON. */
final readonly class Folder
{
    public function __construct(
        public int $id,
        public string $name,
    ) {
    }
}
