<?php

declare(strict_types=1);

namespace Planner\Http;

use RuntimeException;

/** An uploaded file that did not arrive or is not what was asked for; its message says which. */
final class InvalidUpload extends RuntimeException
{
}
