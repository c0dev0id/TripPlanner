<?php

declare(strict_types=1);

namespace Planner\Export;

/** A named set of export options a user keeps; its public properties are its JSON. */
final readonly class ExportPreset
{
    public function __construct(
        public int $id,
        public string $name,
        public ExportOptions $options,
    ) {
    }
}
