<?php

declare(strict_types=1);

namespace Planner\Signup;

use DateTimeImmutable;
use League\Plates\Engine;
use Planner\Account\Users;
use Planner\Config;
use Planner\Mail\Mailer;

/** Issues a sign-up link for an address and mails it: as an invitation, or as asked for by the visitor where sign-up is open. */
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

    /** Invites the address: it comes off the waiting list and gets the link. */
    public function invite(string $email, ?int $invitedBy, DateTimeImmutable $now): void
    {
        $this->waitlist->markInvited($email, $now);
        $this->send($email, $invitedBy, $now, 'mail::invitation', t('Your invitation to Trip Planner'));
    }

    /** Sends the address the link it asked for on the landing page. */
    public function sendSignupLink(string $email, DateTimeImmutable $now): void
    {
        $this->send($email, null, $now, 'mail::signup-link', t('Your Trip Planner sign-up link'));
    }

    private function send(string $email, ?int $invitedBy, DateTimeImmutable $now, string $template, string $subject): void
    {
        $email = Users::normalize($email);
        $token = $this->invitations->issue($email, $invitedBy, $now);
        $body = $this->templates->render($template, [
            'link' => $this->config->baseUrl . '/signup/' . $token,
            'days' => intdiv($this->config->invitationTtl, 86400),
        ]);
        $this->mailer->send($email, $subject, $body);
    }
}
