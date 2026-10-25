<?php

declare(strict_types=1);

namespace Planner\Account;

use DateTimeImmutable;
use League\Plates\Engine;
use Planner\Config;
use Planner\Http\View;
use Planner\Mail\Mailer;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class PasswordResetController
{
    public const MIN_PASSWORD_LENGTH = 10;

    public function __construct(
        private readonly Users $users,
        private readonly PasswordResets $resets,
        private readonly Mailer $mailer,
        private readonly Engine $templates,
        private readonly Config $config,
        private readonly View $view,
    ) {
    }

    public function showForgot(Request $request, Response $response): Response
    {
        return $this->view->render($response, 'password-forgot');
    }

    /** Mails a reset link where the address is known; the answer is the same either way. */
    public function sendReset(Request $request, Response $response): Response
    {
        $form = (array) $request->getParsedBody();
        $user = $this->users->findByEmail((string) ($form['email'] ?? ''));
        if ($user !== null) {
            $token = $this->resets->issue($user->id, new DateTimeImmutable());
            $body = $this->templates->render('mail::password-reset', [
                'link' => $this->config->baseUrl . '/password/reset/' . $token,
                'minutes' => intdiv($this->config->passwordResetTtl, 60),
            ]);
            $this->mailer->send($user->email, 'Reset your Trip Planner password', $body);
        }
        return $this->view->render($response, 'password-forgot', [
            'notice' => 'If the address belongs to an account, a mail with a reset link is on its way.',
        ]);
    }

    public function showReset(Request $request, Response $response, array $args): Response
    {
        $reset = $this->resets->findValid($args['token'], new DateTimeImmutable());
        return $this->view->render($response, 'password-reset', ['valid' => $reset !== null]);
    }

    public function reset(Request $request, Response $response, array $args): Response
    {
        $now = new DateTimeImmutable();
        $reset = $this->resets->findValid($args['token'], $now);
        if ($reset === null) {
            return $this->view->render($response, 'password-reset', ['valid' => false]);
        }
        $form = (array) $request->getParsedBody();
        $error = self::passwordError((string) ($form['password'] ?? ''), (string) ($form['password_repeat'] ?? ''));
        if ($error !== null) {
            return $this->view->render($response, 'password-reset', ['valid' => true, 'error' => $error]);
        }
        $this->users->changePassword($reset->userId, $form['password']);
        $this->resets->markUsed($reset->id, $now);
        return $this->view->render($response, 'login', ['notice' => 'Password changed. Sign in with the new one.']);
    }

    /** Why a chosen password is not accepted, or null. */
    public static function passwordError(string $password, string $repeat): ?string
    {
        if (mb_strlen($password) < self::MIN_PASSWORD_LENGTH) {
            return sprintf('The password needs at least %d characters.', self::MIN_PASSWORD_LENGTH);
        }
        if ($password !== $repeat) {
            return 'The two passwords differ.';
        }
        return null;
    }
}
