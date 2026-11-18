<?php

declare(strict_types=1);

namespace Planner\Tests\Share;

use DateTimeImmutable;
use PHPUnit\Framework\TestCase;
use Planner\Account\Users;
use Planner\Share\Cards;
use Planner\Tests\TestDatabase;
use Planner\Trip\Folders;
use Planner\Trip\Trips;

final class CardsTest extends TestCase
{
    private static function jpeg(int $width, int $height): string
    {
        ob_start();
        imagejpeg(imagecreatetruecolor($width, $height));
        return (string) ob_get_clean();
    }

    public function testKeepsOneCardForATripOfItsOwner(): void
    {
        $db = TestDatabase::create();
        $now = new DateTimeImmutable('2026-11-18T10:00:00Z');
        $userId = (new Users($db))->create('rider@example.com', 'correct horse battery', $now)->id;
        $trips = new Trips($db, new Folders($db));
        $tripId = $trips->create($userId, 'Alps', $now)->id;
        $cards = new Cards($db);
        $image = self::jpeg(Cards::WIDTH, Cards::HEIGHT);

        self::assertNull($cards->madeOf($userId, $tripId));
        self::assertFalse($cards->put($userId + 1, $tripId, 'a1', $image));
        self::assertTrue($cards->put($userId, $tripId, 'a1', $image));
        self::assertTrue($cards->put($userId, $tripId, 'b2', $image));
        self::assertSame('b2', $cards->madeOf($userId, $tripId));
        self::assertSame($image, $cards->image($userId, $tripId));
        self::assertNull($cards->image($userId + 1, $tripId));

        self::assertNull($cards->sharedImage(str_repeat('0', 32)));
        $token = $trips->share($userId, $tripId);
        self::assertSame(['b2', $image], [$cards->sharedMadeOf($token), $cards->sharedImage($token)]);
        $trips->unshare($userId, $tripId);
        self::assertNull($cards->sharedImage($token));

        $trips->delete($userId, $tripId);
        self::assertSame(0, (int) $db->query('SELECT count(*) FROM trip_cards')->fetchColumn());
    }

    public function testTakesAJpegOfTheCardsSizeAlone(): void
    {
        self::assertTrue(Cards::isCard(self::jpeg(Cards::WIDTH, Cards::HEIGHT)));
        self::assertFalse(Cards::isCard(self::jpeg(Cards::HEIGHT, Cards::WIDTH)));
        self::assertFalse(Cards::isCard('not a picture'));
        ob_start();
        imagepng(imagecreatetruecolor(Cards::WIDTH, Cards::HEIGHT));
        self::assertFalse(Cards::isCard((string) ob_get_clean()));
    }
}
