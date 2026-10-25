<?php

declare(strict_types=1);

namespace Planner\Mail;

interface Mailer
{
    /** Sends a plain-text mail. */
    public function send(string $to, string $subject, string $body): void;
}
