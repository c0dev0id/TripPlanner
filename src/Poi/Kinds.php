<?php

declare(strict_types=1);

namespace Planner\Poi;

/**
 * The kinds of places the planner knows, each by the values of one OpenStreetMap tag, and
 * the tags a place's details are made of: read from frontend/poi/places.json, the list the
 * planner itself draws from.
 */
final readonly class Kinds
{
    /**
     * @param list<array{id: string, key: string, values: list<string>, noAccess?: list<string>}> $kinds
     * @param list<string> $detailTags
     */
    public function __construct(public array $kinds, public array $detailTags)
    {
    }

    public static function load(string $file): self
    {
        $list = json_decode((string) file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
        return new self($list['kinds'], $list['detailTags']);
    }

    /** @return list<string> */
    public function ids(): array
    {
        return array_column($this->kinds, 'id');
    }

    /** The kind a place with these tags is of; null where it is of none, or not open to the public. */
    public function of(array $tags): ?string
    {
        foreach ($this->kinds as $kind) {
            if (in_array($tags[$kind['key']] ?? '', $kind['values'], true)) {
                return in_array($tags['access'] ?? '', $kind['noAccess'] ?? [], true) ? null : $kind['id'];
            }
        }
        return null;
    }
}
