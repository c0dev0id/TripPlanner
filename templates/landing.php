<?php $this->layout('layout', ['title' => t('Plan the whole trip')]) ?>
<section class="hero">
  <h1><?= $this->t('Plan the whole trip, not one route.') ?></h1>
  <p><?= $this->t('Days with stops, arrival times and breaks, hotels saved once and reused every night, alternative routes for bad weather, photos and receipts where they belong, and GPX export in the format your device needs.') ?></p>
</section>
<section class="card">
  <?php if ($open): ?>
    <h2><?= $this->t('Create your account') ?></h2>
    <p><?= $this->t('Enter your e-mail address and a link to set your password will be sent to you.') ?></p>
  <?php else: ?>
    <h2><?= $this->t('Request an invitation') ?></h2>
    <p><?= $this->t('Sign-up is by invitation. Leave your e-mail address and you will get one as soon as a spot is free.') ?></p>
  <?php endif ?>
  <?php if (isset($notice)): ?><p class="notice"><?= $this->e($notice) ?></p><?php endif ?>
  <?php if (isset($error)): ?><p class="error"><?= $this->e($error) ?></p><?php endif ?>
  <form method="post" action="<?= $open ? '/signup' : '/waitlist' ?>">
    <?= $this->csrf() ?>
    <label><?= $this->t('E-mail') ?> <input type="email" name="email" required autocomplete="email" value="<?= $this->e($email ?? '') ?>"></label>
    <button type="submit"><?= $open ? $this->t('Send me the link') : $this->t('Join the waiting list') ?></button>
  </form>
</section>
