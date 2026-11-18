<?php

declare(strict_types=1);

namespace Planner;

/** The name of a trip, a folder or another thing a user names: trimmed text of up to 200 characters. */
final class Name
{
    /** The name as stored, or null where the value is none or longer than `$max` characters. */
    public static function of(mixed $value, int $max = 200): ?string
    {
        if (!is_string($value)) {
            return null;
        }
        $name = trim($value);
        return $name === '' || mb_strlen($name) > $max ? null : $name;
    }
}
