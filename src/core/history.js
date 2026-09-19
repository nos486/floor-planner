/**
 * Undo/Redo history stack manager.
 */
export class HistoryManager {
  constructor(maxStates = 60) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxStates = maxStates;
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener({
          canUndo: this.canUndo(),
          canRedo: this.canRedo()
        });
      } catch (err) {
        console.error('Error in history listener:', err);
      }
    }
  }

  /**
   * Pushes a new snapshot onto the undo stack and clears redo stack.
   */
  push(snapshot) {
    // Clone state deeply
    const cloned = JSON.parse(JSON.stringify(snapshot));
    this.undoStack.push(cloned);
    if (this.undoStack.length > this.maxStates) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.notify();
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  /**
   * Undoes the last action, moving current state to redoStack and returning target snapshot.
   */
  undo(currentState) {
    if (!this.canUndo()) return null;
    const targetState = this.undoStack.pop();
    this.redoStack.push(JSON.parse(JSON.stringify(currentState)));
    this.notify();
    return targetState;
  }

  /**
   * Redoes the last undone action, moving current state to undoStack and returning target snapshot.
   */
  redo(currentState) {
    if (!this.canRedo()) return null;
    const targetState = this.redoStack.pop();
    this.undoStack.push(JSON.parse(JSON.stringify(currentState)));
    this.notify();
    return targetState;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }
}
