<?php

declare(strict_types=1);

namespace Planner\Http;

use League\Plates\Engine;
use Psr\Http\Message\ResponseInterface as Response;

final class View
{
    public function __construct(private readonly Engine $templates)
    {
    }

    /** Renders a page template into the response. */
    public function render(Response $response, string $template, array $data = []): Response
    {
        $response->getBody()->write($this->templates->render($template, $data));
        return $response->withHeader('Content-Type', 'text/html; charset=utf-8');
    }
}
