<?php

declare(strict_types=1);

namespace Planner\Trip;

use InvalidArgumentException;

/** A trip document that does not have the shape the planner stores. */
final class InvalidDocument extends InvalidArgumentException
{
}
