<?php

declare(strict_types=1);

namespace Planner\Tests\Signup;

use DateTimeImmutable;
use PHPUnit\Framework\TestCase;
use Planner\Signup\Waitlist;
use Planner\Tests\TestDatabase;

final class WaitlistTest extends TestCase
{
    private Waitlist $waitlist;
    private DateTimeImmutable $now;

    protected function setUp(): void
    {
        $this->waitlist = new Waitlist(TestDatabase::create());
        $this->now = new DateTimeImmutable('2026-10-25T20:00:00Z');
    }

    public function testListsAddressesOldestFirstAndOnlyOnce(): void
    {
        $this->waitlist->join('second@example.com', $this->now->modify('+1 hour'));
        $this->waitlist->join('First@Example.com', $this->now);
        $this->waitlist->join('first@example.com', $this->now->modify('+2 hours'));
        self::assertSame(
            [
                ['email' => 'first@example.com', 'created_at' => '2026-10-25T20:00:00Z'],
                ['email' => 'second@example.com', 'created_at' => '2026-10-25T21:00:00Z'],
            ],
            $this->waitlist->pending(),
        );
    }

    public function testLeavesTheListWhenInvited(): void
    {
        $this->waitlist->join('rider@example.com', $this->now);
        $this->waitlist->markInvited('RIDER@example.com', $this->now);
        self::assertSame([], $this->waitlist->pending());
    }
}
