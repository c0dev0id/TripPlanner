<?php

declare(strict_types=1);

namespace Planner\Signup;

use DateTimeImmutable;
use League\Plates\Engine;
use Planner\Config;
use Planner\Mail\Mailer;

/** Issues an invitation, takes the address off the waiting list and mails the link. */
final class Inviter
{
    public function __construct(
        private readonly Invitations $invitations,
        private readonly Waitlist $waitlist,
        private readonly Mailer $mailer,
        private readonly Engine $templates,
        private readonly Config $config,
    ) {
    }

    public function invite(string $email, ?int $invitedBy, DateTimeImmutable $now): void
    {
        $token = $this->invitations->issue($email, $invitedBy, $now);
        $this->waitlist->markInvited($email, $now);
        $body = $this->templates->render('mail::invitation', [
            'link' => $this->config->baseUrl . '/signup/' . $token,
            'days' => intdiv($this->config->invitationTtl, 86400),
        ]);
        $this->mailer->send($email, 'Your invitation to Trip Planner', $body);
    }
}
