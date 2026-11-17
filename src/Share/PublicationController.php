<?php

declare(strict_types=1);

namespace Planner\Share;

use Planner\Account\CurrentUser;
use Planner\Http\Json;
use Planner\Journal\Entries;
use Planner\Trip\TripDocuments;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** What the owner sets of a trip's public page: the journal on it, the GPX file, the photo at its top. And the trip as a visitor gets it, for the owner to look at. */
final class PublicationController
{
    public function __construct(
        private readonly Publications $publications,
        private readonly TripDocuments $documents,
        private readonly Entries $entries,
        private readonly CurrentUser $currentUser,
    ) {
    }

    public function show(Request $request, Response $response, array $args): Response
    {
        $publication = $this->publications->of($this->currentUser->get()->id, (int) $args['id']);
        return $publication === null ? Json::error($response, 404, 'Trip not found.') : Json::of($response, $publication);
    }

    /** The trip's document as the shared API gives it, whether the trip is shared or not. */
    public function preview(Request $request, Response $response, array $args): Response
    {
        [$userId, $tripId] = [$this->currentUser->get()->id, (int) $args['id']];
        $document = $this->documents->load($userId, $tripId);
        return $document === null ? Json::error($response, 404, 'Trip not found.') : Json::of($response, PublicTrip::document($document, $this->publications->of($userId, $tripId)));
    }

    /** Sets all three from `{journal, gpx, coverEntryId}`; the cover is an image of the trip's journal, or null. */
    public function replace(Request $request, Response $response, array $args): Response
    {
        [$journal, $gpx, $coverEntryId] = [Json::field($request, 'journal'), Json::field($request, 'gpx'), Json::field($request, 'coverEntryId')];
        if (!is_bool($journal) || !is_bool($gpx) || ($coverEntryId !== null && !is_int($coverEntryId))) {
            return Json::error($response, 422, 'The publication names the journal, the GPX file and a cover.');
        }
        [$userId, $tripId] = [$this->currentUser->get()->id, (int) $args['id']];
        if ($coverEntryId !== null && !($this->entries->find($userId, $tripId, $coverEntryId)?->file['image'] ?? false)) {
            return Json::error($response, 422, 'The cover is a photo of the journal.');
        }
        return $this->publications->set($userId, $tripId, $journal, $gpx, $coverEntryId) ? $response->withStatus(204) : Json::error($response, 404, 'Trip not found.');
    }
}
