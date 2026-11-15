<?php $this->layout('layout', ['title' => t('Reset password')]) ?>
<section class="card">
  <h1><?= $this->t('Reset password') ?></h1>
  <?php if (isset($notice)): ?>
    <p class="notice"><?= $this->e($notice) ?></p>
  <?php else: ?>
    <p><?= $this->t('Enter the e-mail address of your account and a link to set a new password will be sent to you.') ?></p>
    <form method="post" action="/password/forgot">
      <?= $this->csrf() ?>
      <label><?= $this->t('E-mail') ?> <input type="email" name="email" required autocomplete="email"></label>
      <button type="submit"><?= $this->t('Send link') ?></button>
    </form>
  <?php endif ?>
</section>
