<?php

declare(strict_types=1);

namespace Planner\Tests\Signup;

use DateTimeImmutable;
use League\Plates\Engine;
use PHPUnit\Framework\TestCase;
use Planner\Config;
use Planner\Mail\Mailer;
use Planner\Signup\Invitations;
use Planner\Signup\Inviter;
use Planner\Signup\Waitlist;
use Planner\Tests\TestDatabase;

final class InviterTest extends TestCase
{
    private Invitations $invitations;
    private Waitlist $waitlist;
    private Inviter $inviter;
    /** @var array{to: string, subject: string, body: string}[] */
    private array $sent = [];
    private DateTimeImmutable $now;

    protected function setUp(): void
    {
        $db = TestDatabase::create();
        $this->invitations = new Invitations($db, 14 * 86400);
        $this->waitlist = new Waitlist($db);
        $templates = new Engine(dirname(__DIR__, 2) . '/templates');
        $templates->addFolder('mail', dirname(__DIR__, 2) . '/templates/mail');
        $mailer = new class ($this->sent) implements Mailer {
            public function __construct(private array &$sent)
            {
            }

            public function send(string $to, string $subject, string $body): void
            {
                $this->sent[] = ['to' => $to, 'subject' => $subject, 'body' => $body];
            }
        };
        $config = new Config(
            debug: false,
            baseUrl: 'https://planner.example',
            dataDir: '/nowhere',
            viteDevServer: null,
            mailTransport: 'log',
            mailFrom: 'planner@example',
            mailFromName: 'Trip Planner',
            smtpHost: '127.0.0.1',
            smtpPort: 25,
            invitationTtl: 14 * 86400,
            passwordResetTtl: 3600,
            openSignup: true,
        );
        $this->inviter = new Inviter($this->invitations, $this->waitlist, $mailer, $templates, $config);
        $this->now = new DateTimeImmutable('2026-11-07T10:00:00Z');
    }

    public function testAnInvitationMailsALinkThatOpensSignUpAndTakesTheAddressOffTheList(): void
    {
        $this->waitlist->join('rider@example.com', $this->now);
        $this->inviter->invite('rider@example.com', null, $this->now);
        self::assertSame([], $this->waitlist->pending());
        self::assertSame('Your invitation to Trip Planner', $this->sent[0]['subject']);
        self::assertSame('rider@example.com', $this->invitations->findValid($this->tokenIn($this->sent[0]['body']), $this->now)?->email);
    }

    public function testASignUpLinkAskedForMailsTheSameKindOfLink(): void
    {
        $this->inviter->sendSignupLink('Rider@Example.com', $this->now);
        self::assertCount(1, $this->sent);
        self::assertSame(['rider@example.com', 'Your Trip Planner sign-up link'], [$this->sent[0]['to'], $this->sent[0]['subject']]);
        self::assertStringContainsString('valid for 14 days', $this->sent[0]['body']);
        self::assertStringContainsString('https://planner.example/signup/', $this->sent[0]['body']);
        self::assertSame('rider@example.com', $this->invitations->findValid($this->tokenIn($this->sent[0]['body']), $this->now)?->email);
    }

    private function tokenIn(string $body): string
    {
        self::assertMatchesRegularExpression('#/signup/([0-9a-f]{64})#', $body);
        preg_match('#/signup/([0-9a-f]{64})#', $body, $match);
        return $match[1];
    }
}
