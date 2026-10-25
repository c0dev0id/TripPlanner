<?php

declare(strict_types=1);

namespace Planner;

final class Config
{
    public function __construct(
        public readonly bool $debug,
        public readonly string $baseUrl,
        public readonly string $dataDir,
        public readonly ?string $viteDevServer,
        public readonly string $mailTransport,
        public readonly string $mailFrom,
        public readonly string $mailFromName,
        public readonly string $smtpHost,
        public readonly int $smtpPort,
        public readonly int $invitationTtl,
        public readonly int $passwordResetTtl,
    ) {
    }

    /** Reads default.php and, where present, local.php from the directory. */
    public static function load(string $dir): self
    {
        $values = require $dir . '/default.php';
        if (is_file($dir . '/local.php')) {
            $values = array_replace_recursive($values, require $dir . '/local.php');
        }
        return new self(
            debug: $values['debug'],
            baseUrl: rtrim($values['base_url'], '/'),
            dataDir: rtrim($values['data_dir'], '/'),
            viteDevServer: $values['vite_dev_server'] === null ? null : rtrim($values['vite_dev_server'], '/'),
            mailTransport: $values['mail']['transport'],
            mailFrom: $values['mail']['from'],
            mailFromName: $values['mail']['from_name'],
            smtpHost: $values['mail']['smtp_host'],
            smtpPort: $values['mail']['smtp_port'],
            invitationTtl: $values['invitation_ttl'],
            passwordResetTtl: $values['password_reset_ttl'],
        );
    }
}
