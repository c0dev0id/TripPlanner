<?php

declare(strict_types=1);

namespace Planner\Share;

use Planner\Account\CurrentUser;
use Planner\Http\Json;
use Planner\Journal\Entries;
use Planner\Trip\TripDocuments;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** What the owner sets of a trip's public page: the journal on it, the GPX files, the photo at its top, the routes and tracks it leaves out. And the trip as a visitor gets it, for the owner to look at. */
final class PublicationController
{
    public function __construct(
        private readonly Publications $publications,
        private readonly TripDocuments $documents,
        private readonly Entries $entries,
        private readonly Cards $cards,
        private readonly CurrentUser $currentUser,
    ) {
    }

    public function show(Request $request, Response $response, array $args): Response
    {
        [$userId, $tripId] = [$this->currentUser->get()->id, (int) $args['id']];
        $publication = $this->publications->of($userId, $tripId);
        return $publication === null ? Json::error($response, 404, 'Trip not found.') : Json::of($response, $publication + ['card' => $this->cards->madeOf($userId, $tripId)]);
    }

    /** The trip's document as the shared API gives it, whether the trip is shared or not. */
    public function preview(Request $request, Response $response, array $args): Response
    {
        [$userId, $tripId] = [$this->currentUser->get()->id, (int) $args['id']];
        $document = $this->documents->load($userId, $tripId);
        if ($document === null) {
            return Json::error($response, 404, 'Trip not found.');
        }
        $publication = $this->publications->of($userId, $tripId);
        return Json::of($response, PublicTrip::document($document, $publication, $publication['hiddenRouteIds']));
    }

    /** Sets all of it from `{journal, gpx, coverEntryId, hiddenRouteIds}`; the cover is an image of the trip's journal, or null. */
    public function replace(Request $request, Response $response, array $args): Response
    {
        [$journal, $gpx, $coverEntryId, $hidden] = [Json::field($request, 'journal'), Json::field($request, 'gpx'), Json::field($request, 'coverEntryId'), Json::field($request, 'hiddenRouteIds')];
        if (!is_bool($journal) || !is_bool($gpx) || ($coverEntryId !== null && !is_int($coverEntryId)) || !is_array($hidden) || !array_is_list($hidden) || array_filter($hidden, is_string(...)) !== $hidden) {
            return Json::error($response, 422, 'The publication names the journal, the GPX files, a cover and the routes left out.');
        }
        [$userId, $tripId] = [$this->currentUser->get()->id, (int) $args['id']];
        if ($coverEntryId !== null && !($this->entries->find($userId, $tripId, $coverEntryId)?->file['image'] ?? false)) {
            return Json::error($response, 422, 'The cover is a photo of the journal.');
        }
        return $this->publications->set($userId, $tripId, $journal, $gpx, $coverEntryId, $hidden) ? $response->withStatus(204) : Json::error($response, 404, 'Trip not found.');
    }
}
