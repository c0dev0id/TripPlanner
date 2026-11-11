<?php

declare(strict_types=1);

namespace Planner;

use RuntimeException;

/** Fetches files from other servers for the command line's tasks. */
final class Download
{
    /**
     * The content at the address, fetched with curl, which needs neither `allow_url_fopen`
     * nor a certificate file configured for PHP's own streams.
     *
     * @param string $task what fetches, named to the server, such as "make closures"
     * @throws RuntimeException with curl's reason where the address does not answer with its content
     */
    public static function get(string $url, string $task): string
    {
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_FAILONERROR => true,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_USERAGENT => "Trip Planner ($task)",
        ]);
        $content = curl_exec($curl);
        if ($content === false) {
            throw new RuntimeException("$url could not be fetched: " . curl_error($curl));
        }
        return $content;
    }

    /**
     * Posts the form fields to the address and saves the answer to the file.
     *
     * @param string $task what asks, named to the server
     * @throws RuntimeException with curl's reason where the address does not answer with content
     */
    public static function post(string $url, array $fields, string $file, string $task, int $timeoutS): void
    {
        $answer = fopen($file, 'w');
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_POSTFIELDS => http_build_query($fields),
            CURLOPT_FILE => $answer,
            CURLOPT_FAILONERROR => true,
            CURLOPT_TIMEOUT => $timeoutS,
            CURLOPT_ENCODING => '',
            CURLOPT_USERAGENT => "Trip Planner ($task)",
        ]);
        $done = curl_exec($curl);
        fclose($answer);
        if ($done === false) {
            throw new RuntimeException("$url could not be asked: " . curl_error($curl));
        }
    }
}
