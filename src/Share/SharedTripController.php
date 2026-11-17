<?php

declare(strict_types=1);

namespace Planner\Share;

use DateTimeImmutable;
use Planner\Export\GpxExportController;
use Planner\Export\TripGpx;
use Planner\Http\Json;
use Planner\Journal\Entries;
use Planner\Journal\EntryFiles;
use Planner\Trip\TripDocuments;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** The read-only API of a trip shared under a token: its document, its GPX file, and its journal with its pictures and files once that is published. No sign-in. */
final class SharedTripController
{
    public function __construct(
        private readonly TripDocuments $documents,
        private readonly Publications $publications,
        private readonly Entries $entries,
        private readonly EntryFiles $files,
    ) {
    }

    public function document(Request $request, Response $response, array $args): Response
    {
        $document = $this->publicDocument($args['token']);
        return $document === null ? Json::error($response, 404, 'This trip is not shared.') : Json::of($response, $document);
    }

    /**
     * One route or track of the trip (`routes=<id>`) as a GPX file of its own, written as
     * an export without options is, where its page offers GPX files. A file never holds
     * more than one line: that is what most devices take a file to be.
     */
    public function gpx(Request $request, Response $response, array $args): Response
    {
        $document = $this->publicDocument($args['token']);
        if ($document === null || !$document['public']['gpx']) {
            return Json::error($response, 404, 'This trip is not shared.');
        }
        $routeId = $request->getQueryParams()['routes'] ?? null;
        foreach ($document['days'] as $index => $day) {
            if (in_array($routeId, array_column($day['routes'], 'id'), true)) {
                return GpxExportController::download($response, TripGpx::routeFileName($document, $index, $routeId) . '.gpx', 'application/gpx+xml', TripGpx::day($document, $index, new DateTimeImmutable(), routeIds: [$routeId]));
            }
        }
        return Json::error($response, 404, 'Day or route not found.');
    }

    /** The journal, empty until it is published. */
    public function entries(Request $request, Response $response, array $args): Response
    {
        if ($this->publications->shared($args['token']) === null) {
            return Json::error($response, 404, 'This trip is not shared.');
        }
        return Json::of($response, array_map(PublicTrip::entry(...), $this->entries->listShared($args['token'])));
    }

    /** A file of the journal that is no image. An image goes out as the pictures made of it alone, which carry nothing the camera wrote into it. */
    public function file(Request $request, Response $response, array $args): Response
    {
        $entry = $this->entries->findShared($args['token'], (int) $args['entry']);
        return $this->files->file($response, str_starts_with($entry?->file['mediaType'] ?? '', 'image/') ? null : $entry);
    }

    public function image(Request $request, Response $response, array $args): Response
    {
        return $this->files->image($response, $this->entries->findShared($args['token'], (int) $args['entry']), (int) $args['px']);
    }

    private function publicDocument(string $token): ?array
    {
        $document = $this->documents->loadShared($token);
        return $document === null ? null : PublicTrip::document($document, $this->publications->shared($token));
    }
}
