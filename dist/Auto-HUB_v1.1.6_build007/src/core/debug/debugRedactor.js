'use strict';

const SECRET_KEY_RE = /(password|passwd|pwd|token|secret|authorization|cookie|credential|api[_-]?key|private[_-]?key)/i;
const PATH_KEY_RE = /(path|nativePath|fullPath|filePath|dir|directory|folder)/i;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const ABSOLUTE_PATH_RE = /^(\/Users\/|\/Volumes\/|\/private\/|\/tmp\/|[A-Za-z]:\\|\\\\)/;

function truncateString(value, maxLength) {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength) + `...[truncated ${value.length - maxLength} chars]`;
}

function summarizePath(value) {
  const text = String(value || '');
  const normalized = text.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) return '[path]';
  return `.../${parts[parts.length - 1]}`;
}

function redactString(value, key, options) {
  if (SECRET_KEY_RE.test(String(key || ''))) return '[REDACTED]';

  let next = String(value);
  if (PATH_KEY_RE.test(String(key || '')) || ABSOLUTE_PATH_RE.test(next)) {
    next = summarizePath(next);
  }
  next = next.replace(EMAIL_RE, '[REDACTED_EMAIL]');
  return truncateString(next, options.maxStringLength);
}

function redactValue(value, key, options, depth, seen) {
  if (value == null) return value;
  if (typeof value === 'string') return redactString(value, key, options);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'function') return '[Function]';
  if (depth >= options.maxDepth) return '[MaxDepth]';

  if (typeof value === 'object') {
    if (seen && seen.has(value)) return '[Circular]';
    if (seen) seen.add(value);
  }

  if (Array.isArray(value)) {
    const limit = Math.min(value.length, options.maxArrayItems);
    const items = [];
    for (let i = 0; i < limit; i += 1) {
      items.push(redactValue(value[i], key, options, depth + 1, seen));
    }
    if (value.length > limit) items.push(`[truncated ${value.length - limit} items]`);
    return items;
  }

  const output = {};
  Object.keys(value).forEach((itemKey) => {
    if (SECRET_KEY_RE.test(itemKey)) {
      output[itemKey] = '[REDACTED]';
      return;
    }
    output[itemKey] = redactValue(value[itemKey], itemKey, options, depth + 1, seen);
  });
  return output;
}

class DebugRedactor {
  constructor(options = {}) {
    this.options = {
      maxDepth: options.maxDepth || 6,
      maxArrayItems: options.maxArrayItems || 50,
      maxStringLength: options.maxStringLength || 500
    };
  }

  redact(value) {
    const seen = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
    return redactValue(value, '', this.options, 0, seen);
  }
}

module.exports = { DebugRedactor };
