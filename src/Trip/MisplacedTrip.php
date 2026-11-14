<?php

declare(strict_types=1);

namespace Planner\Trip;

use RuntimeException;

/** A list of places was to go outside the folders for places, or a trip into them or into the Stash, or a file out of the Stash. */
final class MisplacedTrip extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('Lists of places are kept among the Places, files in the Stash, trips in the other folders.');
    }
}
