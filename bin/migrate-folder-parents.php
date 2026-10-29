#!/usr/bin/env php
<?php

// One-shot: lets the folders of a database made before folders could nest hold other
// folders. Delete this file once it has run on every installation.

declare(strict_types=1);

use Planner\Kernel;

require dirname(__DIR__) . '/vendor/autoload.php';

$pdo = Kernel::container(dirname(__DIR__))->get(PDO::class);
$columns = array_column($pdo->query('PRAGMA table_info(folders)')->fetchAll(), 'name');
if (!in_array('parent_id', $columns, true)) {
    $pdo->exec('ALTER TABLE folders ADD COLUMN parent_id INTEGER REFERENCES folders(id)');
}
$pdo->exec('CREATE INDEX IF NOT EXISTS folders_parent ON folders(parent_id)');
echo "Folders can hold folders.\n";
