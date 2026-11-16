<?php

declare(strict_types=1);

namespace Planner\Trip;

use RuntimeException;

/** A folder was to go from among the trips, the places or the Stash into another of them. */
final class FolderOutOfItsTree extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('A folder cannot be moved between Trips, Places and the Stash.');
    }
}
