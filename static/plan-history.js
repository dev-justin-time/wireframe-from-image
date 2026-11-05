// Undo and redo over the studio plan.
//
// CivilGPT's editor kept a stack of project snapshots with an index into it.
// This keeps the same shape for the studio's plan: a `past` stack of the states
// a change started from, and a `future` stack holding what an undo pushed
// aside, so a fresh edit after an undo drops the redo branch instead of
// replaying a state that never followed this history.
//
// Snapshots are copied, not referenced. The plan is plain JSON — walls, rooms,
// takeoff, placed items — so a JSON round trip is the whole deep copy, and an
// edit that mutates the live object cannot reach back into the history.

export const HISTORY_LIMIT = 60;

const copy = (value) => (value === null || value === undefined
  ? null
  : JSON.parse(JSON.stringify(value)));

export function createHistory({ limit = HISTORY_LIMIT } = {}) {
  const past = [];
  const future = [];

  return {
    /** Remember `value` as the state before the change that is about to happen. */
    record(value) {
      past.push(copy(value));
      if (past.length > limit) past.shift();
      // A new edit invalidates whatever an undo had set aside to redo.
      future.length = 0;
    },

    /**
     * The state the last change started from, or null when there is none.
     * `current` is what the undo replaces, so a redo can come back to it.
     */
    undo(current) {
      if (!past.length) return null;
      const previous = past.pop();
      future.push(copy(current));
      return previous;
    },

    /** The state an undo pushed aside, or null when nothing was undone. */
    redo(current) {
      if (!future.length) return null;
      const next = future.pop();
      past.push(copy(current));
      return next;
    },

    /** Forget both stacks — a new plan is not an edit of the old one. */
    reset() {
      past.length = 0;
      future.length = 0;
    },

    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
    get depth() { return past.length; },
  };
}
