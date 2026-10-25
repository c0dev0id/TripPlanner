<?php

declare(strict_types=1);

namespace Planner\Account;

final readonly class User
{
    public function __construct(
        public int $id,
        public string $email,
        public bool $isAdmin,
    ) {
    }
}
