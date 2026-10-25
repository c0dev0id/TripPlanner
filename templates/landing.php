<?php $this->layout('layout', ['title' => 'Plan the whole trip']) ?>
<section class="hero">
  <h1>Plan the whole trip, not one route.</h1>
  <p>Days of stops with arrival times and pauses, hotels kept once and used every night,
  alternative routes for bad weather, photos and receipts where they belong, and GPX
  export in the shape your device needs.</p>
</section>
<section class="card">
  <h2>Get an invitation</h2>
  <p>Sign-up is by invitation. Leave your e-mail address and one comes when a place is free.</p>
  <?php if (isset($notice)): ?><p class="notice"><?= $this->e($notice) ?></p><?php endif ?>
  <?php if (isset($error)): ?><p class="error"><?= $this->e($error) ?></p><?php endif ?>
  <form method="post" action="/waitlist">
    <?= $this->csrf() ?>
    <label>E-mail <input type="email" name="email" required autocomplete="email" value="<?= $this->e($email ?? '') ?>"></label>
    <button type="submit">Join the waiting list</button>
  </form>
</section>
