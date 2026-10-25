<?php

declare(strict_types=1);

namespace Planner\Pages;

use Planner\Config;

/** The script and stylesheet tags of the planner app: from the Vite dev server, or from the build's manifest. */
final class ViteAssets
{
    private const ENTRY = 'main.tsx';

    public function __construct(private readonly Config $config, private readonly string $manifestFile)
    {
    }

    public function tags(): string
    {
        if ($this->config->viteDevServer !== null) {
            $server = $this->config->viteDevServer;
            return "<script type=\"module\" src=\"$server/@vite/client\"></script>\n"
                . "<script type=\"module\" src=\"$server/" . self::ENTRY . "\"></script>";
        }
        $manifest = json_decode(file_get_contents($this->manifestFile), true, flags: JSON_THROW_ON_ERROR);
        $entry = $manifest[self::ENTRY];
        $tags = array_map(fn (string $css) => "<link rel=\"stylesheet\" href=\"/build/$css\">", $entry['css'] ?? []);
        $tags[] = "<script type=\"module\" src=\"/build/{$entry['file']}\"></script>";
        return implode("\n", $tags);
    }
}
