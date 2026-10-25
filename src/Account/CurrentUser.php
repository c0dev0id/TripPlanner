<?php

declare(strict_types=1);

namespace Planner\Account;

/** The signed-in user of this request, kept in the session by id. */
final class CurrentUser
{
    private ?User $user = null;
    private bool $loaded = false;

    public function __construct(private readonly Users $users)
    {
    }

    public function get(): ?User
    {
        if (!$this->loaded) {
            $id = $_SESSION['user_id'] ?? null;
            $this->user = is_int($id) ? $this->users->findById($id) : null;
            $this->loaded = true;
        }
        return $this->user;
    }

    public function login(User $user): void
    {
        session_regenerate_id(true);
        $_SESSION['user_id'] = $user->id;
        $this->user = $user;
        $this->loaded = true;
    }

    public function logout(): void
    {
        $_SESSION = [];
        session_destroy();
        $this->user = null;
        $this->loaded = true;
    }
}
