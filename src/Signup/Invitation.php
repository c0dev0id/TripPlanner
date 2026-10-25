<?php

declare(strict_types=1);

namespace Planner\Signup;

final readonly class Invitation
{
    public function __construct(
        public int $id,
        public string $email,
    ) {
    }
}
