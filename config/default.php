<?php

declare(strict_types=1);

// Defaults for development. config/local.php (not in git) overrides any of these.
return [
    'debug' => false,
    'base_url' => 'http://localhost:8080',
    // The SQLite database, uploaded files and the mail log live here.
    'data_dir' => dirname(__DIR__) . '/var',
    // Address of a running `npm run dev`; null serves the built frontend from public/app.
    'vite_dev_server' => null,
    'mail' => [
        'transport' => 'log', // 'smtp' or 'log'
        'from' => 'planner@localhost',
        'from_name' => 'Trip Planner',
        'smtp_host' => '127.0.0.1',
        'smtp_port' => 25,
    ],
    'invitation_ttl' => 14 * 86400,
    'password_reset_ttl' => 3600,
];
