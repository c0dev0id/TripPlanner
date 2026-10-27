<?php

declare(strict_types=1);

namespace Planner\Trip;

use RuntimeException;

/** A trip was to go into a folder the user does not have. */
final class UnknownFolder extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('No such folder.');
    }
}
