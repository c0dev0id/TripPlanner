<?php $this->layout('layout', ['title' => t('Plan the whole trip')]) ?>
<section class="hero">
  <h1><?= $this->e(t('Plan the whole trip, not one route.')) ?></h1>
  <p><?= $this->e(t('Days of stops with arrival times and pauses, hotels kept once and used every night, alternative routes for bad weather, photos and receipts where they belong, and GPX export in the shape your device needs.')) ?></p>
</section>
<section class="card">
  <?php if ($open): ?>
    <h2><?= $this->e(t('Create your account')) ?></h2>
    <p><?= $this->e(t('Enter your e-mail address; a link to set your password comes by mail.')) ?></p>
  <?php else: ?>
    <h2><?= $this->e(t('Get an invitation')) ?></h2>
    <p><?= $this->e(t('Sign-up is by invitation. Leave your e-mail address and one comes when a place is free.')) ?></p>
  <?php endif ?>
  <?php if (isset($notice)): ?><p class="notice"><?= $this->e($notice) ?></p><?php endif ?>
  <?php if (isset($error)): ?><p class="error"><?= $this->e($error) ?></p><?php endif ?>
  <form method="post" action="<?= $open ? '/signup' : '/waitlist' ?>">
    <?= $this->csrf() ?>
    <label><?= $this->e(t('E-mail')) ?> <input type="email" name="email" required autocomplete="email" value="<?= $this->e($email ?? '') ?>"></label>
    <button type="submit"><?= $this->e($open ? t('Send me the link') : t('Join the waiting list')) ?></button>
  </form>
</section>
