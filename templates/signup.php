<?php $this->layout('layout', ['title' => 'Create your account']) ?>
<section class="card">
  <h1>Create your account</h1>
  <?php if ($email === null): ?>
    <p class="error">This invitation is not valid any more. Ask for a new one from the <a href="/">waiting list</a>.</p>
  <?php else: ?>
    <?php if (isset($error)): ?><p class="error"><?= $this->e($error) ?></p><?php endif ?>
    <form method="post">
      <?= $this->csrf() ?>
      <label>E-mail <input type="email" value="<?= $this->e($email) ?>" disabled></label>
      <label>Password <input type="password" name="password" required minlength="10" autocomplete="new-password"></label>
      <label>Password again <input type="password" name="password_repeat" required minlength="10" autocomplete="new-password"></label>
      <button type="submit">Create account</button>
    </form>
  <?php endif ?>
</section>
