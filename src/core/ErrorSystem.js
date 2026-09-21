/**
 * N3D Error System
 * Extremely strict error handling. Fatal errors stop the engine immediately.
 * No silent failures. No swallowed errors.
 */

const ERROR_CODES = {
  // GPU / Device
  N3D_GPU_NOT_SUPPORTED: 'N3D_GPU_NOT_SUPPORTED',
  N3D_GPU_ADAPTER_FAILED: 'N3D_GPU_ADAPTER_FAILED',
  N3D_GPU_DEVICE_LOST: 'N3D_GPU_DEVICE_LOST',
  N3D_GPU_DEVICE_CREATION_FAILED: 'N3D_GPU_DEVICE_CREATION_FAILED',
  N3D_GPU_CONTEXT_FAILED: 'N3D_GPU_CONTEXT_FAILED',
  N3D_GPU_FEATURE_UNSUPPORTED: 'N3D_GPU_FEATURE_UNSUPPORTED',

  // Resources
  N3D_INVALID_BUFFER: 'N3D_INVALID_BUFFER',
  N3D_INVALID_TEXTURE: 'N3D_INVALID_TEXTURE',
  N3D_INVALID_SAMPLER: 'N3D_INVALID_SAMPLER',
  N3D_INVALID_BIND_GROUP: 'N3D_INVALID_BIND_GROUP',
  N3D_INVALID_PIPELINE: 'N3D_INVALID_PIPELINE',
  N3D_INVALID_SHADER_MODULE: 'N3D_INVALID_SHADER_MODULE',
  N3D_RESOURCE_DISPOSED: 'N3D_RESOURCE_DISPOSED',
  N3D_RESOURCE_LEAK: 'N3D_RESOURCE_LEAK',

  // Shader
  N3D_SHADER_COMPILATION_FAILED: 'N3D_SHADER_COMPILATION_FAILED',
  N3D_SHADER_VALIDATION_FAILED: 'N3D_SHADER_VALIDATION_FAILED',
  N3D_INVALID_BINDINGS: 'N3D_INVALID_BINDINGS',
  N3D_INVALID_VERTEX_LAYOUT: 'N3D_INVALID_VERTEX_LAYOUT',

  // Geometry / Material / Scene
  N3D_INVALID_GEOMETRY: 'N3D_INVALID_GEOMETRY',
  N3D_INVALID_MATERIAL: 'N3D_INVALID_MATERIAL',
  N3D_INVALID_MESH: 'N3D_INVALID_MESH',
  N3D_INVALID_TRANSFORM: 'N3D_INVALID_TRANSFORM',
  N3D_NAN_INFINITY_DETECTED: 'N3D_NAN_INFINITY_DETECTED',
  N3D_INVALID_SCENE: 'N3D_INVALID_SCENE',

  // Renderer
  N3D_RENDER_PASS_FAILED: 'N3D_RENDER_PASS_FAILED',
  N3D_PIPELINE_CREATION_FAILED: 'N3D_PIPELINE_CREATION_FAILED',
  N3D_COMMAND_ENCODER_FAILED: 'N3D_COMMAND_ENCODER_FAILED',
  N3D_PRESENT_FAILED: 'N3D_PRESENT_FAILED',

  // Assets
  N3D_ASSET_LOAD_FAILED: 'N3D_ASSET_LOAD_FAILED',
  N3D_ASSET_CORRUPTION: 'N3D_ASSET_CORRUPTION',
  N3D_ASSET_UNSUPPORTED: 'N3D_ASSET_UNSUPPORTED',

  // Internal
  N3D_INVARIANT_FAILURE: 'N3D_INVARIANT_FAILURE',
  N3D_NOT_IMPLEMENTED: 'N3D_NOT_IMPLEMENTED',
  N3D_INVALID_STATE: 'N3D_INVALID_STATE',
  N3D_ENGINE_ALREADY_FAILED: 'N3D_ENGINE_ALREADY_FAILED',
  N3D_UNKNOWN: 'N3D_UNKNOWN'
};

/**
 * Custom N3D Error class
 */
export class N3DError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'N3DError';
    this.code = code || ERROR_CODES.N3D_UNKNOWN;
    this.details = details;
    this.timestamp = Date.now();
    this.isFatal = details.fatal === true;
  }
}

/**
 * Global engine failure state. Once set, nothing continues.
 */
let _engineFailed = false;
let _failureInfo = null;
let _onFatalCallbacks = [];

/**
 * Core Error System
 */
export const ErrorSystem = {
  ERROR_CODES,

  /**
   * Register a callback that is invoked on fatal error (before stop).
   */
  onFatal(callback) {
    if (typeof callback === 'function') {
      _onFatalCallbacks.push(callback);
    }
  },

  /**
   * Check if engine is in failed state.
   */
  isFailed() {
    return _engineFailed;
  },

  getFailureInfo() {
    return _failureInfo;
  },

  /**
   * Fatal error - stops everything.
   * This is the primary way to halt the engine on critical failures.
   */
  fatal(code, message, details = {}) {
    if (_engineFailed) {
      // Already failed - still log but do not re-process
      console.error('[N3D] Additional fatal error while already failed:', code, message);
      return;
    }

    const fullDetails = {
      ...details,
      fatal: true,
      frame: details.frame ?? 'unknown',
      pass: details.pass ?? 'unknown',
      resource: details.resource ?? 'unknown',
      subsystem: details.subsystem ?? 'Unknown'
    };

    const error = new N3DError(code, message, fullDetails);
    _engineFailed = true;
    _failureInfo = {
      code,
      message,
      details: fullDetails,
      error,
      stack: new Error().stack
    };

    // Rich console output
    console.group('%c[N3D FATAL ERROR]', 'color: #ff2222; font-weight: bold; font-size: 14px;');
    console.error(`Code: ${code}`);
    console.error(`Subsystem: ${fullDetails.subsystem}`);
    console.error(`Message: ${message}`);
    if (fullDetails.frame !== 'unknown') console.error(`Frame: ${fullDetails.frame}`);
    if (fullDetails.pass !== 'unknown') console.error(`Pass: ${fullDetails.pass}`);
    if (fullDetails.resource !== 'unknown') console.error(`Resource: ${fullDetails.resource}`);
    if (fullDetails.cause) {
      console.error('Cause:', fullDetails.cause);
    }
    console.error('Stack:');
    console.trace();
    console.groupEnd();

    // Notify listeners
    for (const cb of _onFatalCallbacks) {
      try {
        cb(error, _failureInfo);
      } catch (e) {
        console.error('[N3D] Error in fatal callback:', e);
      }
    }

    // Throw so call stack is interrupted
    throw error;
  },

  /**
   * Non-fatal warning. Logged clearly, does not stop engine.
   */
  warn(code, message, details = {}) {
    console.groupCollapsed(`%c[N3D WARNING] ${code}`, 'color: #ffaa00; font-weight: bold;');
    console.warn(message);
    if (Object.keys(details).length > 0) {
      console.warn('Details:', details);
    }
    console.groupEnd();
  },

  /**
   * Informational message.
   */
  info(code, message, details = {}) {
    if (typeof console.info === 'function') {
      console.info(`[N3D INFO] ${code}: ${message}`, details);
    }
  },

  /**
   * Assert an invariant. On failure → fatal.
   */
  assert(condition, code, message, details = {}) {
    if (!condition) {
      this.fatal(code || ERROR_CODES.N3D_INVARIANT_FAILURE, message || 'Invariant failed', {
        ...details,
        subsystem: details.subsystem || 'Core'
      });
    }
  },

  /**
   * Validate that a value is finite (not NaN / Infinity). Used heavily in debug mode.
   */
  assertFinite(value, name, details = {}) {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      this.fatal(ERROR_CODES.N3D_NAN_INFINITY_DETECTED, `Non-finite value detected: ${name} = ${value}`, {
        ...details,
        subsystem: details.subsystem || 'Math',
        value,
        name
      });
    }
  },

  /**
   * Mark that a feature is not implemented. Throws so callers cannot silently continue.
   */
  notImplemented(feature, details = {}) {
    this.fatal(ERROR_CODES.N3D_NOT_IMPLEMENTED, `Feature not implemented: ${feature}`, {
      ...details,
      subsystem: details.subsystem || 'Core',
      feature
    });
  },

  /**
   * Reset failure state. ONLY for explicit recovery path (engine.recover()).
   * Not to be used casually.
   */
  _resetForRecovery() {
    _engineFailed = false;
    _failureInfo = null;
  }
};

export default ErrorSystem;
