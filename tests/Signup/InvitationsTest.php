<?php

declare(strict_types=1);

namespace Planner\Tests\Signup;

use DateTimeImmutable;
use PHPUnit\Framework\TestCase;
use Planner\Signup\Invitations;
use Planner\Tests\TestDatabase;

final class InvitationsTest extends TestCase
{
    private Invitations $invitations;
    private DateTimeImmutable $now;

    protected function setUp(): void
    {
        $this->invitations = new Invitations(TestDatabase::create(), 14 * 86400);
        $this->now = new DateTimeImmutable('2026-10-25T20:00:00Z');
    }

    public function testFindsAnIssuedInvitationByItsToken(): void
    {
        $token = $this->invitations->issue('Rider@Example.com', null, $this->now);
        self::assertSame(64, strlen($token));
        $invitation = $this->invitations->findValid($token, $this->now->modify('+13 days'));
        self::assertSame('rider@example.com', $invitation?->email);
        self::assertNull($this->invitations->findValid('not-a-token', $this->now));
    }

    public function testExpiresAfterItsLifetime(): void
    {
        $token = $this->invitations->issue('rider@example.com', null, $this->now);
        self::assertNull($this->invitations->findValid($token, $this->now->modify('+14 days')));
    }

    public function testIsSpentOnceUsed(): void
    {
        $token = $this->invitations->issue('rider@example.com', null, $this->now);
        $invitation = $this->invitations->findValid($token, $this->now);
        $this->invitations->markUsed($invitation->id, $this->now);
        self::assertNull($this->invitations->findValid($token, $this->now));
    }

    public function testIssuesIndependentTokensForTheSameAddress(): void
    {
        $first = $this->invitations->issue('rider@example.com', null, $this->now);
        $second = $this->invitations->issue('rider@example.com', null, $this->now);
        self::assertNotSame($first, $second);
        self::assertNotNull($this->invitations->findValid($first, $this->now));
        self::assertNotNull($this->invitations->findValid($second, $this->now));
    }
}
