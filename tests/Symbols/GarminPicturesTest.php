<?php

declare(strict_types=1);

namespace Planner\Tests\Symbols;

use PHPUnit\Framework\TestCase;
use Planner\Symbols\GarminPictures;

final class GarminPicturesTest extends TestCase
{
    private string $dir;

    protected function setUp(): void
    {
        $this->dir = sys_get_temp_dir() . '/planner-symbols-' . bin2hex(random_bytes(4));
        mkdir("$this->dir/source", 0755, true);
        file_put_contents("$this->dir/list.json", json_encode(['groups' => [['title' => 'Markers', 'names' => ['Flag, Blue', 'Navaid, Green/Red', 'Gambling/casino', 'Custom 0']]], 'withoutPicture' => ['Custom 0']]));
        file_put_contents("$this->dir/source/Flag%2C%20Blue.png", "\x89PNG flag");
        file_put_contents("$this->dir/source/Navaid%2C%20Green-Red.png", "\x89PNG navaid");
    }

    protected function tearDown(): void
    {
        foreach (['source', 'out'] as $sub) {
            array_map('unlink', glob("$this->dir/$sub/*") ?: []);
            @rmdir("$this->dir/$sub");
        }
        unlink("$this->dir/list.json");
        rmdir($this->dir);
    }

    public function testFetchesEachExpectedPictureOnceUnderItsNameASlashMadeADash(): void
    {
        $out = "$this->dir/out";
        $first = GarminPictures::fetch("$this->dir/list.json", $out, "$this->dir/source/");
        self::assertSame(['fetched' => 2, 'kept' => 0, 'missing' => ['Gambling/casino']], $first);
        self::assertSame("\x89PNG navaid", file_get_contents("$out/Navaid, Green-Red.png"));
        self::assertSame(['fetched' => 0, 'kept' => 2, 'missing' => ['Gambling/casino']], GarminPictures::fetch("$this->dir/list.json", $out, "$this->dir/source/"));
    }
}
