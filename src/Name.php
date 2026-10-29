<?php

declare(strict_types=1);

namespace Planner;

/** The name of a trip, a folder or another thing a user names: trimmed text of up to 200 characters. */
final class Name
{
    /** The name as stored, or null where the value is none. */
    public static function of(mixed $value): ?string
    {
        if (!is_string($value)) {
            return null;
        }
        $name = trim($value);
        return $name === '' || mb_strlen($name) > 200 ? null : $name;
    }
}
