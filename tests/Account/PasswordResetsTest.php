<?php

declare(strict_types=1);

namespace Planner\Tests\Account;

use DateTimeImmutable;
use PHPUnit\Framework\TestCase;
use Planner\Account\PasswordResets;
use Planner\Account\Users;
use Planner\Tests\TestDatabase;

final class PasswordResetsTest extends TestCase
{
    private PasswordResets $resets;
    private int $userId;
    private DateTimeImmutable $now;

    protected function setUp(): void
    {
        $db = TestDatabase::create();
        $this->now = new DateTimeImmutable('2026-10-25T20:00:00Z');
        $this->userId = (new Users($db))->create('rider@example.com', 'correct horse battery', $this->now)->id;
        $this->resets = new PasswordResets($db, 3600);
    }

    public function testFindsAnIssuedResetByItsToken(): void
    {
        $token = $this->resets->issue($this->userId, $this->now);
        $reset = $this->resets->findValid($token, $this->now->modify('+59 minutes'));
        self::assertSame($this->userId, $reset?->userId);
        self::assertNull($this->resets->findValid('not-a-token', $this->now));
    }

    public function testExpiresAfterItsLifetime(): void
    {
        $token = $this->resets->issue($this->userId, $this->now);
        self::assertNull($this->resets->findValid($token, $this->now->modify('+60 minutes')));
    }

    public function testIsSpentOnceUsed(): void
    {
        $token = $this->resets->issue($this->userId, $this->now);
        $reset = $this->resets->findValid($token, $this->now);
        $this->resets->markUsed($reset->id, $this->now);
        self::assertNull($this->resets->findValid($token, $this->now));
    }
}
