<?php

declare(strict_types=1);

namespace Planner\Pages;

use Planner\Config;
use Planner\Http\View;
use Planner\Share\Publications;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Exception\HttpNotFoundException;

/** The read-only page of a trip, for printing and sharing: the owner's, or the one shared under a token. */
final class TripViewController
{
    /** How much of a trip's description a link's preview is given, in characters. */
    private const DESCRIPTION_LENGTH = 200;

    public function __construct(
        private readonly ViteAssets $assets,
        private readonly View $view,
        private readonly Publications $publications,
        private readonly Config $config,
    ) {
    }

    public function own(Request $request, Response $response, array $args): Response
    {
        return $this->view->render($response, 'trip-view', ['api' => '/api/trips/' . $args['id'], 'assets' => $this->assets->tags(ViteAssets::VIEW)]);
    }

    /** The shared page, headed with the trip's name, description and cover for whoever is sent its link. */
    public function shared(Request $request, Response $response, array $args): Response
    {
        $trip = $this->publications->shared($args['token']);
        if ($trip === null) {
            throw new HttpNotFoundException($request);
        }
        $api = '/api/shared/' . $args['token'];
        $description = trim((string) preg_replace('/\s+/', ' ', $trip['description']));
        return $this->view->render($response, 'trip-view', [
            'api' => $api,
            'assets' => $this->assets->tags(ViteAssets::VIEW),
            'shared' => [
                'title' => $trip['name'],
                'description' => mb_strlen($description) > self::DESCRIPTION_LENGTH ? mb_substr($description, 0, self::DESCRIPTION_LENGTH - 1) . '…' : $description,
                'image' => $trip['coverEntryId'] === null ? null : "{$this->config->baseUrl}$api/entries/{$trip['coverEntryId']}/preview",
            ],
        ]);
    }
}
