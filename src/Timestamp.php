<?php

declare(strict_types=1);

namespace Planner;

use DateTimeImmutable;
use DateTimeZone;

final class Timestamp
{
    /** The database form of a time: ISO 8601 in UTC. */
    public static function of(DateTimeImmutable $time): string
    {
        return $time->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z');
    }
}
