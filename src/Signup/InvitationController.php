<?php

declare(strict_types=1);

namespace Planner\Signup;

use DateTimeImmutable;
use Planner\Account\CurrentUser;
use Planner\Http\Redirect;
use Planner\Http\View;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** The admin's waiting list page and the invitations sent from it. */
final class InvitationController
{
    public function __construct(
        private readonly Waitlist $waitlist,
        private readonly Inviter $inviter,
        private readonly CurrentUser $currentUser,
        private readonly View $view,
    ) {
    }

    public function waitlist(Request $request, Response $response): Response
    {
        return $this->view->render($response, 'admin/waitlist', ['pending' => $this->waitlist->pending()]);
    }

    public function invite(Request $request, Response $response): Response
    {
        $form = (array) $request->getParsedBody();
        $email = trim((string) ($form['email'] ?? ''));
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            return $this->view->render($response, 'admin/waitlist', [
                'pending' => $this->waitlist->pending(),
                'error' => 'That is not an e-mail address.',
            ]);
        }
        $this->inviter->invite($email, $this->currentUser->get()->id, new DateTimeImmutable());
        return Redirect::to($response, '/admin/waitlist');
    }
}
