<?php

declare(strict_types=1);

namespace Planner\Trip;

use RuntimeException;

/** The document was saved from a version that is no longer the current one. */
final class VersionConflict extends RuntimeException
{
    public function __construct(public readonly int $currentVersion)
    {
        parent::__construct('The trip was changed elsewhere since it was loaded.');
    }
}
