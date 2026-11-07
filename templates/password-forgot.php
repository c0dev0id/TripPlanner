<?php $this->layout('layout', ['title' => t('Reset the password')]) ?>
<section class="card">
  <h1><?= $this->e(t('Reset the password')) ?></h1>
  <?php if (isset($notice)): ?>
    <p class="notice"><?= $this->e($notice) ?></p>
  <?php else: ?>
    <p><?= $this->e(t('Enter the address of your account and a link to set a new password comes by mail.')) ?></p>
    <form method="post" action="/password/forgot">
      <?= $this->csrf() ?>
      <label><?= $this->e(t('E-mail')) ?> <input type="email" name="email" required autocomplete="email"></label>
      <button type="submit"><?= $this->e(t('Send the link')) ?></button>
    </form>
  <?php endif ?>
</section>
