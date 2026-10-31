<?php

declare(strict_types=1);

namespace Planner\Account;

final readonly class User
{
    public function __construct(
        public int $id,
        public string $email,
        public bool $isAdmin,
        /** Whether the account still has the password it was handed over with, which must be replaced before anything else. */
        public bool $mustChangePassword = false,
    ) {
    }
}
