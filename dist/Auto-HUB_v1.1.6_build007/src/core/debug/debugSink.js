'use strict';

class DebugSink {
  constructor({ onDisplay = () => {}, onChange = () => {} } = {}) {
    this.onDisplay = onDisplay;
    this.onChange = onChange;
  }

  emitDisplay(entry) {
    try { this.onDisplay(entry); } catch (_) {}
  }

  emitChange(snapshot) {
    try { this.onChange(snapshot); } catch (_) {}
  }
}

module.exports = { DebugSink };
