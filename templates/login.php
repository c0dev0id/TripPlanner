<?php $this->layout('layout', ['title' => 'Sign in']) ?>
<section class="card">
  <h1>Sign in</h1>
  <?php if (isset($notice)): ?><p class="notice"><?= $this->e($notice) ?></p><?php endif ?>
  <?php if (isset($error)): ?><p class="error"><?= $this->e($error) ?></p><?php endif ?>
  <form method="post" action="/login">
    <?= $this->csrf() ?>
    <label>E-mail <input type="email" name="email" required autocomplete="email" value="<?= $this->e($email ?? '') ?>"></label>
    <label>Password <input type="password" name="password" required autocomplete="current-password"></label>
    <button type="submit">Sign in</button>
  </form>
  <p><a href="/password/forgot">Forgot the password?</a></p>
</section>
