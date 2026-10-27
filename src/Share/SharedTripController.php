<?php

declare(strict_types=1);

namespace Planner\Share;

use Planner\Http\Json;
use Planner\Journal\Entries;
use Planner\Journal\EntryFiles;
use Planner\Trip\TripDocuments;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** The read-only API of a trip shared under a token: its document, its journal, the journal's files. No sign-in. */
final class SharedTripController
{
    public function __construct(
        private readonly TripDocuments $documents,
        private readonly Entries $entries,
        private readonly EntryFiles $files,
    ) {
    }

    public function document(Request $request, Response $response, array $args): Response
    {
        $document = $this->documents->loadShared($args['token']);
        return $document === null ? Json::error($response, 404, 'This trip is not shared.') : Json::of($response, $document);
    }

    public function entries(Request $request, Response $response, array $args): Response
    {
        $entries = $this->entries->listShared($args['token']);
        return $entries === null ? Json::error($response, 404, 'This trip is not shared.') : Json::of($response, $entries);
    }

    public function file(Request $request, Response $response, array $args): Response
    {
        return $this->files->file($response, $this->entries->findShared($args['token'], (int) $args['entry']));
    }

    public function preview(Request $request, Response $response, array $args): Response
    {
        return $this->files->preview($response, $this->entries->findShared($args['token'], (int) $args['entry']));
    }
}
