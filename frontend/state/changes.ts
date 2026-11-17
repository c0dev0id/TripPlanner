import { CHANGES_CHANNEL } from '../api';

let channel: BroadcastChannel | undefined;

/** Tells the read-only pages open in this browser that the server has something new: a preview beside the planner, or one in a window of its own. */
export function announceChange(): void {
  channel ??= new BroadcastChannel(CHANGES_CHANNEL);
  channel.postMessage('changed');
}
