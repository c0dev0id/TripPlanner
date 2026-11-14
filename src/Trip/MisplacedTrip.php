<?php

declare(strict_types=1);

namespace Planner\Trip;

use RuntimeException;

/** A collection was to go outside the folders for collections and places, or a trip into them. */
final class MisplacedTrip extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('Collections are kept in the folders for collections and places, trips in the others.');
    }
}
