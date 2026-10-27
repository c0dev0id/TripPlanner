<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Trip Planner</title>
<?php $this->insert('theme') ?>
</head>
<body>
<div id="root" data-api="<?= $this->e($api) ?>"></div>
<?= $assets ?>
</body>
</html>
