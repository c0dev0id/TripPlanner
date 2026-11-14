<?php

declare(strict_types=1);

namespace Planner\Recording;

use RuntimeException;

/** Rides were to be merged that cannot be; the message says why. */
final class Unmergeable extends RuntimeException
{
}
