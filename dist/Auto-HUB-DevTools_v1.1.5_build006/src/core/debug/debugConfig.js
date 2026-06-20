'use strict';

const DEBUG_LEVELS = {
  OFF: 0,
  USER_REPORT: 1,
  SUPPORT_DIAGNOSTICS: 2,
  DEVELOPER_TRACE: 3
};

const DEFAULT_SCHEMA_VERSION = 1;
const DEFAULT_SOURCE = 'app';

const RAW_LIMITS_STANDARD = {
  maxEntries: 1000,
  maxBytes: 1024 * 1024
};

const RAW_LIMITS_TRACE = {
  maxEntries: 5000,
  maxBytes: 5 * 1024 * 1024
};

const DISPLAY_LIMITS = {
  maxEntries: 1000,
  maxBytes: 512 * 1024
};

function clampDebugLevel(level) {
  const parsed = Number(level);
  if (!Number.isFinite(parsed)) return DEBUG_LEVELS.OFF;
  if (parsed <= DEBUG_LEVELS.OFF) return DEBUG_LEVELS.OFF;
  if (parsed >= DEBUG_LEVELS.DEVELOPER_TRACE) return DEBUG_LEVELS.DEVELOPER_TRACE;
  return Math.floor(parsed);
}

function getRawLimitsForLevel(level) {
  return clampDebugLevel(level) >= DEBUG_LEVELS.DEVELOPER_TRACE
    ? { ...RAW_LIMITS_TRACE }
    : { ...RAW_LIMITS_STANDARD };
}

function createDebugSessionId(prefix = 'debug') {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${time}-${rand}`;
}

function normalizeBuildFingerprint(fingerprint = {}) {
  return {
    appVersion: fingerprint.appVersion || null,
    frontendBuild: fingerprint.frontendBuild || null,
    backendVersion: fingerprint.backendVersion || null,
    apiVersion: fingerprint.apiVersion || null,
    dbSchemaVersion: fingerprint.dbSchemaVersion || null,
    nativeShellVersion: fingerprint.nativeShellVersion || null,
    protocolVersion: fingerprint.protocolVersion || null,
    packageBuildId: fingerprint.packageBuildId || null,
    runtimeLoadedPath: fingerprint.runtimeLoadedPath || null
  };
}

module.exports = {
  DEBUG_LEVELS,
  DEFAULT_SCHEMA_VERSION,
  DEFAULT_SOURCE,
  DISPLAY_LIMITS,
  clampDebugLevel,
  createDebugSessionId,
  getRawLimitsForLevel,
  normalizeBuildFingerprint
};
