export interface PumpDeps<Job, Result> {
  /** The next job from the current state, or undefined when nothing is missing. */
  next(): Job | undefined;
  run(job: Job): Promise<Result>;
  onResult(job: Job, result: Result): void;
  onFailure(job: Job, error: unknown): void;
}

/**
 * A pull-based request loop: each iteration asks the current state for the next missing
 * job, so nothing stale is ever queued. Calling the pump while it runs does nothing; the
 * running loop picks up new work once its job is done; the jobs pace themselves.
 */
export function createPump<Job, Result>(deps: PumpDeps<Job, Result>): () => Promise<void> {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      for (let job = deps.next(); job !== undefined; job = deps.next()) {
        try {
          deps.onResult(job, await deps.run(job));
        } catch (error) {
          deps.onFailure(job, error);
        }
      }
    } finally {
      running = false;
    }
  };
}
