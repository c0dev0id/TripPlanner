<?php

declare(strict_types=1);

namespace Planner\Signup;

use DateTimeImmutable;
use Planner\Account\Users;
use Planner\Config;
use Planner\Http\Redirect;
use Planner\Http\View;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** The landing page: with open sign-up a form that mails a sign-up link, else the waiting list. */
final class LandingController
{
    public function __construct(
        private readonly Waitlist $waitlist,
        private readonly Inviter $inviter,
        private readonly Users $users,
        private readonly Config $config,
        private readonly View $view,
    ) {
    }

    public function show(Request $request, Response $response): Response
    {
        return $this->render($response);
    }

    /** Mails a sign-up link where the address has no account yet; the answer is the same either way. */
    public function requestSignup(Request $request, Response $response): Response
    {
        if (!$this->config->openSignup) {
            return Redirect::to($response, '/');
        }
        $form = (array) $request->getParsedBody();
        $email = trim((string) ($form['email'] ?? ''));
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            return $this->render($response, ['email' => $email, 'error' => t('That is not an e-mail address.')]);
        }
        if ($this->users->findByEmail($email) === null) {
            $this->inviter->sendSignupLink($email, new DateTimeImmutable());
        }
        return $this->render($response, ['notice' => t('If the address is new here, a mail with your sign-up link is on its way. Otherwise sign in.')]);
    }

    public function joinWaitlist(Request $request, Response $response): Response
    {
        $form = (array) $request->getParsedBody();
        $email = trim((string) ($form['email'] ?? ''));
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            return $this->render($response, ['email' => $email, 'error' => t('That is not an e-mail address.')]);
        }
        $this->waitlist->join($email, new DateTimeImmutable());
        return $this->render($response, ['notice' => t('You are on the list. The invitation comes by mail.')]);
    }

    private function render(Response $response, array $data = []): Response
    {
        return $this->view->render($response, 'landing', ['open' => $this->config->openSignup, ...$data]);
    }
}
