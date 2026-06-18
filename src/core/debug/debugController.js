'use strict';

const {
  DEBUG_LEVELS,
  DEFAULT_SCHEMA_VERSION,
  DEFAULT_SOURCE,
  DISPLAY_LIMITS,
  clampDebugLevel,
  createDebugSessionId,
  getRawLimitsForLevel,
  normalizeBuildFingerprint
} = require('./debugConfig');
const { DebugBuffer } = require('./debugBuffer');
const { DebugRedactor } = require('./debugRedactor');
const { DebugSink } = require('./debugSink');

function isoNow() {
  return new Date().toISOString();
}

function normalizeSeverity(value) {
  const text = String(value || 'info').toLowerCase();
  return ['debug', 'info', 'warning', 'error'].includes(text) ? text : 'info';
}

function normalizeEventName(value) {
  const text = String(value || 'event').trim();
  return text || 'event';
}

class DebugController {
  constructor({
    level = DEBUG_LEVELS.OFF,
    uiVisible = false,
    source = DEFAULT_SOURCE,
    sessionId = createDebugSessionId(),
    buildFingerprint = {},
    redactor = new DebugRedactor(),
    sink = new DebugSink()
  } = {}) {
    this.level = clampDebugLevel(level);
    this.uiVisible = !!uiVisible;
    this.source = source || DEFAULT_SOURCE;
    this.sessionId = sessionId;
    this.seq = 0;
    this.buildFingerprint = normalizeBuildFingerprint(buildFingerprint);
    this.redactor = redactor;
    this.sink = sink;
    this.rawBuffer = new DebugBuffer(getRawLimitsForLevel(this.level));
    this.displayBuffer = new DebugBuffer(DISPLAY_LIMITS);
  }

  setDebugLevel(level) {
    this.level = clampDebugLevel(level);
    this.rawBuffer.setLimits(getRawLimitsForLevel(this.level));
    this.sink.emitChange(this.getSnapshot());
    return this.level;
  }

  getDebugLevel() {
    return this.level;
  }

  shouldLog(level = DEBUG_LEVELS.USER_REPORT) {
    const requested = clampDebugLevel(level);
    return requested > DEBUG_LEVELS.OFF && this.level >= requested;
  }

  setDebugUiVisible(visible) {
    this.uiVisible = !!visible;
    this.sink.emitChange(this.getSnapshot());
    return this.uiVisible;
  }

  isDebugUiVisible() {
    return this.uiVisible;
  }

  setBuildFingerprint(buildFingerprint = {}) {
    this.buildFingerprint = normalizeBuildFingerprint(buildFingerprint);
    this.sink.emitChange(this.getSnapshot());
  }

  pushDebugEvent(level, event = {}) {
    const eventLevel = clampDebugLevel(level);
    if (!this.shouldLog(eventLevel)) return null;

    const rawEvent = {
      schemaVersion: DEFAULT_SCHEMA_VERSION,
      sessionId: this.sessionId,
      seq: ++this.seq,
      timestamp: isoNow(),
      level: eventLevel,
      source: event.source || this.source,
      component: event.component || 'app',
      phase: event.phase || 'runtime',
      event: normalizeEventName(event.event),
      severity: normalizeSeverity(event.severity),
      correlationId: event.correlationId || null,
      display: event.display || '',
      buildFingerprint: this.buildFingerprint,
      data: event.data == null ? null : event.data
    };

    ['fileName', 'status', 'detail'].forEach((key) => {
      if (event[key] !== undefined) rawEvent[key] = event[key];
    });

    const redacted = this.redactor.redact(rawEvent);
    this.rawBuffer.push(redacted);

    if (redacted.display && eventLevel <= DEBUG_LEVELS.SUPPORT_DIAGNOSTICS) {
      const displayEntry = {
        timestamp: redacted.timestamp,
        level: redacted.level,
        source: redacted.source,
        component: redacted.component,
        phase: redacted.phase,
        event: redacted.event,
        severity: redacted.severity,
        display: redacted.display,
        fileName: redacted.fileName || '',
        status: redacted.status || '',
        detail: redacted.detail || ''
      };
      this.displayBuffer.push(displayEntry);
      this.sink.emitDisplay(displayEntry);
    }

    this.sink.emitChange(this.getSnapshot());
    return redacted;
  }

  clearDebugLog() {
    this.rawBuffer.clear();
    this.displayBuffer.clear();
    this.sink.emitChange(this.getSnapshot());
  }

  hasRawEntries() {
    return this.rawBuffer.hasEntries();
  }

  getRawEntries() {
    return this.rawBuffer.getEntries();
  }

  getDisplayEntries() {
    return this.displayBuffer.getEntries();
  }

  buildDebugLogText() {
    const entries = this.getRawEntries();
    if (!entries.length) return '';

    const rawSnapshot = this.rawBuffer.getSnapshot();
    const header = [
      'Auto-HUB Debug Log',
      `schemaVersion=${DEFAULT_SCHEMA_VERSION}`,
      `sessionId=${this.sessionId}`,
      `debugLevel=${this.level}`,
      `source=${this.source}`,
      `generatedAt=${isoNow()}`,
      `truncated=${rawSnapshot.truncated ? 'true' : 'false'}`,
      `buildFingerprint=${JSON.stringify(this.buildFingerprint)}`
    ];

    return header.join('\n') + '\n\n' + entries.map((entry) => JSON.stringify(entry)).join('\n');
  }

  copyDebugLog() {
    return this.buildDebugLogText();
  }

  getSnapshot() {
    return {
      level: this.level,
      uiVisible: this.uiVisible,
      sessionId: this.sessionId,
      raw: this.rawBuffer.getSnapshot(),
      display: this.displayBuffer.getSnapshot()
    };
  }
}

module.exports = { DebugController };
