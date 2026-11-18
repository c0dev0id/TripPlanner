<?php

declare(strict_types=1);

namespace Planner\Share;

use Planner\Account\CurrentUser;
use Planner\Http\Json;
use Planner\Journal\FileStore;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** The card of a trip's shared page: kept as the owner's browser made it, and given to the owner and to whoever is sent the link. */
final class CardController
{
    public function __construct(
        private readonly Cards $cards,
        private readonly CurrentUser $currentUser,
    ) {
    }

    /** Keeps the card sent as the form's `image`, with the mark `of` of what it was made of. */
    public function replace(Request $request, Response $response, array $args): Response
    {
        $of = ((array) $request->getParsedBody())['of'] ?? null;
        $upload = $request->getUploadedFiles()['image'] ?? null;
        $problem = FileStore::problemOf($upload);
        if ($problem !== null) {
            return Json::error($response, 422, $problem);
        }
        if (!is_string($of) || preg_match('/^[0-9a-z]{1,32}$/', $of) !== 1 || $upload === null) {
            return Json::error($response, 422, 'The card is a picture with a mark of what it was made of.');
        }
        $image = (string) $upload->getStream();
        if (!Cards::isCard($image)) {
            return Json::error($response, 422, 'The card is a JPEG of 1200 by 630 pixels.');
        }
        return $this->cards->put($this->currentUser->get()->id, (int) $args['id'], $of, $image) ? $response->withStatus(204) : Json::error($response, 404, 'Trip not found.');
    }

    public function show(Request $request, Response $response, array $args): Response
    {
        return self::picture($response, $this->cards->image($this->currentUser->get()->id, (int) $args['id']), 'private');
    }

    /** The shared page's card. */
    public function shared(Request $request, Response $response, array $args): Response
    {
        return self::picture($response, $this->cards->sharedImage($args['token']), 'public');
    }

    /** A card for whom it is kept by: its address names what it was made of, so it is kept for good. */
    private static function picture(Response $response, ?string $image, string $keptBy): Response
    {
        if ($image === null) {
            return Json::error($response, 404, 'Not found.');
        }
        $response->getBody()->write($image);
        return $response->withHeader('Content-Type', 'image/jpeg')->withHeader('Cache-Control', "$keptBy, max-age=31536000, immutable");
    }
}
