<?php

declare(strict_types=1);

namespace Planner\Trip;

use RuntimeException;

/** A folder cannot be moved into itself or into a folder inside it. */
final class FolderInsideItself extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('A folder cannot go into itself or into a folder inside it.');
    }
}
