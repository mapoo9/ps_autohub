'use strict';

function measureBytes(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).length;
  }
  try {
    return unescape(encodeURIComponent(text)).length;
  } catch (_) {
    return text.length;
  }
}

class DebugBuffer {
  constructor({ maxEntries = 1000, maxBytes = 1024 * 1024 } = {}) {
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
    this.entries = [];
    this.sizes = [];
    this.byteSize = 0;
    this.truncated = false;
  }

  setLimits({ maxEntries = this.maxEntries, maxBytes = this.maxBytes } = {}) {
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
    this.trim();
  }

  push(entry) {
    const size = measureBytes(entry) + 1;
    this.entries.push(entry);
    this.sizes.push(size);
    this.byteSize += size;
    this.trim();
    return entry;
  }

  trim() {
    while (
      this.entries.length > this.maxEntries ||
      (this.maxBytes > 0 && this.byteSize > this.maxBytes)
    ) {
      this.entries.shift();
      this.byteSize -= this.sizes.shift() || 0;
      this.truncated = true;
    }
  }

  clear() {
    this.entries = [];
    this.sizes = [];
    this.byteSize = 0;
    this.truncated = false;
  }

  hasEntries() {
    return this.entries.length > 0;
  }

  getEntries() {
    return this.entries.slice();
  }

  getSnapshot() {
    return {
      count: this.entries.length,
      byteSize: this.byteSize,
      maxEntries: this.maxEntries,
      maxBytes: this.maxBytes,
      truncated: this.truncated
    };
  }
}

module.exports = { DebugBuffer, measureBytes };
