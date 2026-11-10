<?php

declare(strict_types=1);

// Defaults for development. config/local.php (not in git) overrides any of these.
return [
    'debug' => false,
    'base_url' => 'http://localhost:8080',
    // The SQLite database, uploaded files, the sessions and the mail log live here.
    'data_dir' => dirname(__DIR__) . '/var',
    // Address of a running `npm run dev`; null serves the built frontend from public/build.
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
    // A sign-in lasts this long from the last request, in the browser and on the server.
    'session_ttl' => 30 * 86400,
    // Anyone may sign up from the landing page, by a link mailed to their address; false
    // keeps sign-up to invitations from the admin page or `make invite`.
    'open_signup' => true,
];
