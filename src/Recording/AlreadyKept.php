<?php

declare(strict_types=1);

namespace Planner\Recording;

use RuntimeException;

/** A recording's file was to be kept only if the user keeps it nowhere yet, and is kept already. */
final class AlreadyKept extends RuntimeException
{
}
