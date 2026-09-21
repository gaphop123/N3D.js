/**
 * N3D Logger
 * Structured logging with levels. Integrates with ErrorSystem.
 */

const LOG_LEVELS = {
  NONE: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4,
  TRACE: 5
};

let _level = LOG_LEVELS.INFO;
let _prefix = '[N3D]';

export const Logger = {
  LEVELS: LOG_LEVELS,

  setLevel(level) {
    if (typeof level === 'string') {
      _level = LOG_LEVELS[level.toUpperCase()] ?? LOG_LEVELS.INFO;
    } else {
      _level = level;
    }
  },

  getLevel() {
    return _level;
  },

  setPrefix(prefix) {
    _prefix = prefix || '[N3D]';
  },

  error(...args) {
    if (_level >= LOG_LEVELS.ERROR) {
      console.error(_prefix, ...args);
    }
  },

  warn(...args) {
    if (_level >= LOG_LEVELS.WARN) {
      console.warn(_prefix, ...args);
    }
  },

  info(...args) {
    if (_level >= LOG_LEVELS.INFO) {
      console.info(_prefix, ...args);
    }
  },

  debug(...args) {
    if (_level >= LOG_LEVELS.DEBUG) {
      console.debug(_prefix, ...args);
    }
  },

  trace(...args) {
    if (_level >= LOG_LEVELS.TRACE) {
      console.trace(_prefix, ...args);
    }
  },

  group(label) {
    if (_level >= LOG_LEVELS.DEBUG) {
      console.group(`${_prefix} ${label}`);
    }
  },

  groupEnd() {
    if (_level >= LOG_LEVELS.DEBUG) {
      console.groupEnd();
    }
  }
};

export default Logger;
