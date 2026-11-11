<?php

declare(strict_types=1);

namespace Planner\Poi;

/**
 * The areas `make places` is run for, by their code: the regions of the larger countries
 * (ISO 3166-2) and the smaller countries whole (ISO 3166-1). A list to pick from; any other
 * code of either kind is fetched as well.
 */
final class Areas
{
    public const NAMES = [
        'AT-1' => 'Austria: Burgenland',
        'AT-2' => 'Austria: Kärnten',
        'AT-3' => 'Austria: Niederösterreich',
        'AT-4' => 'Austria: Oberösterreich',
        'AT-5' => 'Austria: Salzburg',
        'AT-6' => 'Austria: Steiermark',
        'AT-7' => 'Austria: Tirol',
        'AT-8' => 'Austria: Vorarlberg',
        'AT-9' => 'Austria: Wien',
        'BE' => 'Belgium',
        'CH' => 'Switzerland',
        'DE-BW' => 'Germany: Baden-Württemberg',
        'DE-BY' => 'Germany: Bayern',
        'DE-BE' => 'Germany: Berlin',
        'DE-BB' => 'Germany: Brandenburg',
        'DE-HB' => 'Germany: Bremen',
        'DE-HH' => 'Germany: Hamburg',
        'DE-HE' => 'Germany: Hessen',
        'DE-MV' => 'Germany: Mecklenburg-Vorpommern',
        'DE-NI' => 'Germany: Niedersachsen',
        'DE-NW' => 'Germany: Nordrhein-Westfalen',
        'DE-RP' => 'Germany: Rheinland-Pfalz',
        'DE-SL' => 'Germany: Saarland',
        'DE-SN' => 'Germany: Sachsen',
        'DE-ST' => 'Germany: Sachsen-Anhalt',
        'DE-SH' => 'Germany: Schleswig-Holstein',
        'DE-TH' => 'Germany: Thüringen',
        'FR-ARA' => 'France: Auvergne-Rhône-Alpes',
        'FR-BFC' => 'France: Bourgogne-Franche-Comté',
        'FR-BRE' => 'France: Bretagne',
        'FR-CVL' => 'France: Centre-Val de Loire',
        'FR-20R' => 'France: Corse',
        'FR-GES' => 'France: Grand Est',
        'FR-HDF' => 'France: Hauts-de-France',
        'FR-IDF' => 'France: Île-de-France',
        'FR-NOR' => 'France: Normandie',
        'FR-NAQ' => 'France: Nouvelle-Aquitaine',
        'FR-OCC' => 'France: Occitanie',
        'FR-PDL' => 'France: Pays de la Loire',
        'FR-PAC' => 'France: Provence-Alpes-Côte d\'Azur',
        'IT-21' => 'Italy: Piemonte',
        'IT-23' => 'Italy: Valle d\'Aosta',
        'IT-25' => 'Italy: Lombardia',
        'IT-32' => 'Italy: Trentino-Alto Adige',
        'IT-34' => 'Italy: Veneto',
        'IT-36' => 'Italy: Friuli-Venezia Giulia',
        'IT-42' => 'Italy: Liguria',
        'IT-45' => 'Italy: Emilia-Romagna',
        'NL' => 'Netherlands',
    ];

    /**
     * The list as lines of text: each area's code and name, and for those kept how many
     * places and when they were fetched last. An area of which a kind was never fetched, or
     * last fetched before the others, says so, and such areas are named again at the end
     * as the ones to fetch again. Areas kept that are not on the list come last.
     *
     * @param list<array{area: string, kind: string, places: int, fetchedAt: string}> $fetches
     * @param list<string> $kinds every kind the planner knows
     */
    public static function listing(array $fetches, array $kinds): string
    {
        $byArea = [];
        foreach ($fetches as $fetch) {
            $byArea[$fetch['area']][$fetch['kind']] = $fetch;
        }
        $lines = [];
        $again = [];
        foreach (self::NAMES + array_fill_keys(array_keys($byArea), '') as $code => $name) {
            $kept = $byArea[$code] ?? [];
            $state = '';
            if ($kept !== []) {
                $last = max(array_column($kept, 'fetchedAt'));
                $behind = [];
                foreach ($kinds as $kind) {
                    if (($kept[$kind]['fetchedAt'] ?? null) !== $last) {
                        $behind[] = $kind . ' ' . (isset($kept[$kind]) ? substr($kept[$kind]['fetchedAt'], 0, 10) : 'never');
                    }
                }
                $state = sprintf('%d places, fetched %s', array_sum(array_column($kept, 'places')), substr($last, 0, 10)) . ($behind === [] ? '' : ', but ' . implode(', ', $behind));
                if ($behind !== []) {
                    $again[] = $code;
                }
            }
            $lines[] = sprintf('%-7s %s', $code, implode(' — ', array_filter([$name, $state])));
        }
        if ($again !== []) {
            $lines[] = "\nFetched in part, to fetch again: " . implode(', ', $again);
        }
        return implode("\n", $lines) . "\n";
    }
}
