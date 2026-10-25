<?php $csrf = $this->csrfToken() ?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Trip Planner</title>
<meta name="csrf-name-key" content="<?= $this->e($csrf['nameKey']) ?>">
<meta name="csrf-name" content="<?= $this->e($csrf['name']) ?>">
<meta name="csrf-value-key" content="<?= $this->e($csrf['valueKey']) ?>">
<meta name="csrf-value" content="<?= $this->e($csrf['value']) ?>">
</head>
<body>
<div id="root"></div>
<?= $assets ?>
</body>
</html>
