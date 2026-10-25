<?php

declare(strict_types=1);

namespace Planner;

/** One-time tokens sent by mail; only their hash is stored. */
final class Token
{
    public static function generate(): string
    {
        return bin2hex(random_bytes(32));
    }

    public static function hash(string $token): string
    {
        return hash('sha256', $token);
    }
}
