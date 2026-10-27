<?php

declare(strict_types=1);

namespace Planner\Pages;

use Planner\Http\View;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** The read-only page of a trip, for printing and sharing: the owner's, or the one shared under a token. */
final class TripViewController
{
    public function __construct(private readonly ViteAssets $assets, private readonly View $view)
    {
    }

    public function own(Request $request, Response $response, array $args): Response
    {
        return $this->page($response, '/api/trips/' . $args['id']);
    }

    public function shared(Request $request, Response $response, array $args): Response
    {
        return $this->page($response, '/api/shared/' . $args['token']);
    }

    private function page(Response $response, string $api): Response
    {
        return $this->view->render($response, 'trip-view', ['api' => $api, 'assets' => $this->assets->tags(ViteAssets::VIEW)]);
    }
}
