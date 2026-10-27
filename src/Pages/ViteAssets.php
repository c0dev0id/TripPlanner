<?php

declare(strict_types=1);

namespace Planner\Pages;

use Planner\Config;

/** The script and stylesheet tags of a page's bundle: from the Vite dev server, or from the build's manifest. */
final class ViteAssets
{
    /** The planner app. */
    public const APP = 'main.tsx';
    /** The read-only trip page. */
    public const VIEW = 'view.tsx';

    public function __construct(private readonly Config $config, private readonly string $manifestFile)
    {
    }

    public function tags(string $entry): string
    {
        if ($this->config->viteDevServer !== null) {
            $server = $this->config->viteDevServer;
            return "<script type=\"module\" src=\"$server/@vite/client\"></script>\n"
                . "<script type=\"module\" src=\"$server/$entry\"></script>";
        }
        $manifest = json_decode(file_get_contents($this->manifestFile), true, flags: JSON_THROW_ON_ERROR);
        $tags = array_map(fn (string $css) => "<link rel=\"stylesheet\" href=\"/build/$css\">", self::stylesheets($manifest, $entry));
        $tags[] = "<script type=\"module\" src=\"/build/{$manifest[$entry]['file']}\"></script>";
        return implode("\n", $tags);
    }

    /**
     * The stylesheets of the chunks a chunk imports, then its own: a style two entries share
     * is emitted with their shared chunk, and an entry's own styles come last, as in its source.
     */
    private static function stylesheets(array $manifest, string $key, array &$seen = []): array
    {
        if (isset($seen[$key])) {
            return [];
        }
        $seen[$key] = true;
        $chunk = $manifest[$key];
        $sheets = [];
        foreach ($chunk['imports'] ?? [] as $import) {
            array_push($sheets, ...self::stylesheets($manifest, $import, $seen));
        }
        return [...$sheets, ...$chunk['css'] ?? []];
    }
}
