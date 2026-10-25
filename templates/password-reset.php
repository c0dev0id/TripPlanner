<?php $this->layout('layout', ['title' => 'New password']) ?>
<section class="card">
  <h1>New password</h1>
  <?php if (!$valid): ?>
    <p class="error">This link is not valid any more. <a href="/password/forgot">Ask for a new one.</a></p>
  <?php else: ?>
    <?php if (isset($error)): ?><p class="error"><?= $this->e($error) ?></p><?php endif ?>
    <form method="post">
      <?= $this->csrf() ?>
      <label>Password <input type="password" name="password" required minlength="10" autocomplete="new-password"></label>
      <label>Password again <input type="password" name="password_repeat" required minlength="10" autocomplete="new-password"></label>
      <button type="submit">Set the password</button>
    </form>
  <?php endif ?>
</section>
