<?php

declare(strict_types=1);

namespace Planner\Tests\Account;

use DateTimeImmutable;
use PDOException;
use PHPUnit\Framework\TestCase;
use Planner\Account\Users;
use Planner\Tests\TestDatabase;

final class UsersTest extends TestCase
{
    private Users $users;
    private DateTimeImmutable $now;

    protected function setUp(): void
    {
        $this->users = new Users(TestDatabase::create());
        $this->now = new DateTimeImmutable('2026-10-25T20:00:00Z');
    }

    public function testCreatesAndFindsByEmailIgnoringCaseAndSpace(): void
    {
        $created = $this->users->create(' Rider@Example.com ', 'correct horse battery', $this->now);
        $found = $this->users->findByEmail('rider@example.COM');
        self::assertNotNull($found);
        self::assertSame($created->id, $found->id);
        self::assertSame('rider@example.com', $found->email);
        self::assertFalse($found->isAdmin);
    }

    public function testFindsById(): void
    {
        $created = $this->users->create('rider@example.com', 'correct horse battery', $this->now);
        self::assertSame('rider@example.com', $this->users->findById($created->id)?->email);
        self::assertNull($this->users->findById($created->id + 1));
    }

    public function testRejectsASecondAccountForTheSameAddress(): void
    {
        $this->users->create('rider@example.com', 'correct horse battery', $this->now);
        $this->expectException(PDOException::class);
        $this->users->create('RIDER@example.com', 'another password', $this->now);
    }

    public function testAuthenticatesWithTheRightPasswordOnly(): void
    {
        $this->users->create('rider@example.com', 'correct horse battery', $this->now);
        self::assertSame('rider@example.com', $this->users->authenticate('rider@example.com', 'correct horse battery')?->email);
        self::assertNull($this->users->authenticate('rider@example.com', 'wrong'));
        self::assertNull($this->users->authenticate('nobody@example.com', 'correct horse battery'));
    }

    public function testChangesThePassword(): void
    {
        $user = $this->users->create('rider@example.com', 'correct horse battery', $this->now);
        $this->users->changePassword($user->id, 'a new password');
        self::assertNull($this->users->authenticate('rider@example.com', 'correct horse battery'));
        self::assertNotNull($this->users->authenticate('rider@example.com', 'a new password'));
    }

    public function testGrantsAdminToAnExistingAccountOnly(): void
    {
        $this->users->create('rider@example.com', 'correct horse battery', $this->now);
        self::assertTrue($this->users->grantAdmin('rider@example.com'));
        self::assertTrue($this->users->findByEmail('rider@example.com')?->isAdmin);
        self::assertFalse($this->users->grantAdmin('nobody@example.com'));
    }
}
