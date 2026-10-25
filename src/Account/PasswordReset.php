<?php

declare(strict_types=1);

namespace Planner\Account;

final readonly class PasswordReset
{
    public function __construct(
        public int $id,
        public int $userId,
    ) {
    }
}
