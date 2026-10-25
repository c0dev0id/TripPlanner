<?php

declare(strict_types=1);

namespace Planner\Mail;

/** Appends mail to a file instead of sending it; for development. */
final class LogMailer implements Mailer
{
    public function __construct(private readonly string $file)
    {
    }

    public function send(string $to, string $subject, string $body): void
    {
        if (!is_dir(dirname($this->file))) {
            mkdir(dirname($this->file), 0750, true);
        }
        file_put_contents($this->file, "To: $to\nSubject: $subject\n\n$body\n---\n", FILE_APPEND);
    }
}
