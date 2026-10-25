<?php

declare(strict_types=1);

namespace Planner\Pages;

use Planner\Http\View;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** The page that loads the planner app. */
final class AppController
{
    public function __construct(private readonly ViteAssets $assets, private readonly View $view)
    {
    }

    public function show(Request $request, Response $response): Response
    {
        return $this->view->render($response, 'app', ['assets' => $this->assets->tags()]);
    }
}
