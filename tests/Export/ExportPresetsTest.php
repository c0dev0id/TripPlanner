<?php

declare(strict_types=1);

namespace Planner\Tests\Export;

use DateTimeImmutable;
use PHPUnit\Framework\TestCase;
use Planner\Account\Users;
use Planner\Export\ExportOptions;
use Planner\Export\ExportPresets;
use Planner\Tests\TestDatabase;

final class ExportPresetsTest extends TestCase
{
    private ExportPresets $presets;
    private int $userId;
    private int $otherUserId;
    private DateTimeImmutable $now;

    protected function setUp(): void
    {
        $db = TestDatabase::create();
        $this->now = new DateTimeImmutable('2026-10-27T10:00:00Z');
        $users = new Users($db);
        $this->userId = $users->create('rider@example.com', 'correct horse battery', $this->now)->id;
        $this->otherUserId = $users->create('other@example.com', 'correct horse battery', $this->now)->id;
        $this->presets = new ExportPresets($db);
    }

    private function garmin(int $reachM = 500): ExportOptions
    {
        return new ExportOptions('day', 'routes', false, $reachM);
    }

    public function testKeepsAPresetByNameAndReplacesItsOptions(): void
    {
        $first = $this->presets->save($this->userId, 'Garmin', $this->garmin(), $this->now);
        $this->presets->save($this->otherUserId, 'Garmin', $this->garmin(), $this->now);
        $again = $this->presets->save($this->userId, 'Garmin', $this->garmin(1000), $this->now);
        self::assertSame($first->id, $again->id);
        self::assertSame(1000, $again->options->reachM);
        $listed = $this->presets->listFor($this->userId);
        self::assertCount(1, $listed);
        self::assertEquals($this->garmin(1000), $listed[0]->options);
        self::assertSame('{"id":' . $first->id . ',"name":"Garmin","options":{"per":"day","form":"routes","optional":false,"reachM":1000}}', json_encode($listed[0]));
    }

    public function testDeletesOnlyOwnPresets(): void
    {
        $preset = $this->presets->save($this->userId, 'Garmin', $this->garmin(), $this->now);
        self::assertFalse($this->presets->delete($this->otherUserId, $preset->id));
        self::assertTrue($this->presets->delete($this->userId, $preset->id));
        self::assertSame([], $this->presets->listFor($this->userId));
    }
}
