/**
 * S.A.M - MFE (Micro Frontend) State Tracker
 *
 * Provides Warm storage-based state tracking for federated modules.
 * Tracks loading states, versions, and mount/unmount events.
 *
 * Falls back to in-memory storage if native module is unavailable.
 */
import { Air } from './SideFx';

// Warm instance ID for MFE state tracking
export const MFE_INSTANCE_ID = 'sam-mfe-registry';

// Key prefix for MFE states
export const MFE_KEY_PREFIX = 'mfe.';

// Flag to track if native module is available
let _nativeAvailable: boolean | null = null;

// In-memory fallback store (used when native module unavailable)
const _fallbackStore: Map<string, string | number | boolean> = new Map();

// Listeners for fallback store changes
type FallbackListener = (key: string, value: string | number | boolean | null) => void;
const _fallbackListeners: Set<FallbackListener> = new Set();

/**
 * Check if the native Air module is fully available
 */
function isNativeAvailable(): boolean {
  if (_nativeAvailable !== null) {
    return _nativeAvailable;
  }

  try {
    // Try to call a method to see if native is available
    Air.isWarmInitialized(MFE_INSTANCE_ID);
    _nativeAvailable = true;
    console.log('[SAM] Native Air module is available');
  } catch {
    _nativeAvailable = false;
    console.warn(
      '[SAM] Native Air module not available. ' +
      'Using in-memory fallback store. Rebuild the native app for persistence.'
    );
  }

  return _nativeAvailable;
}

/**
 * Add a listener for fallback store changes (used by useMFEStates when native unavailable)
 */
export function addFallbackListener(listener: FallbackListener): () => void {
  _fallbackListeners.add(listener);
  return () => _fallbackListeners.delete(listener);
}

/**
 * Notify all fallback listeners of a change
 */
function notifyFallbackListeners(key: string, value: string | number | boolean | null): void {
  _fallbackListeners.forEach(listener => {
    try {
      listener(key, value);
    } catch (e) {
      console.error('[SAM] Fallback listener error:', e);
    }
  });
}

/**
 * MFE state values
 * - Empty string: Not loaded
 * - 'loading': Currently loading
 * - 'loaded': Loaded but not mounted
 * - 'mounted': Loaded and mounted (active)
 * - 'error': Failed to load
 * - Version string (e.g., '1.0.0'): Loaded with specific version
 */
export type MFEState = '' | 'loading' | 'loaded' | 'mounted' | 'error' | string;

/**
 * MFE metadata stored alongside state
 */
export interface MFEMetadata {
  state: MFEState;
  version?: string;
  loadedAt?: number;
  mountedAt?: number;
  unmountedAt?: number;
  errorMessage?: string;
  loadTimeMs?: number;
}

// Track if Warm root path has been set
let _warmRootPathSet = false;

/**
 * Set the Warm root path for all S.A.M instances
 * On iOS this is optional (auto-detected), on Android it's required.
 *
 * @param rootPath The directory path for Warm storage files
 *
 * @example
 * ```typescript
 * // Only needed on Android:
 * import { Platform } from 'react-native';
 * if (Platform.OS === 'android') {
 *   setWarmRootPath('/data/data/com.yourapp/files/mmkv');
 * }
 * ```
 */
export function setWarmRootPath(rootPath: string): void {
  if (_warmRootPathSet) {
    console.warn('[SAM] Warm root path already set');
    return;
  }
  Air.setWarmRootPath(rootPath);
  _warmRootPathSet = true;
}

/**
 * Initialize the MFE registry Warm instance
 * Call this early in your app initialization
 *
 * On iOS, Warm path is auto-detected (Library/mmkv)
 * On Android, call setWarmRootPath first if not already done
 *
 * @param warmRootPath Optional root directory for Warm storage (required on Android if not set)
 */
export function initializeMFERegistry(warmRootPath?: string): void {
  if (!isNativeAvailable()) return;

  try {
    // Set Warm root path if provided and not already set
    if (warmRootPath && !_warmRootPathSet) {
      Air.setWarmRootPath(warmRootPath);
      _warmRootPathSet = true;
    }

    if (!Air.isWarmInitialized(MFE_INSTANCE_ID)) {
      const result = Air.initializeWarm(MFE_INSTANCE_ID);
      if (!result.success) {
        console.warn('[SAM] Failed to initialize MFE registry:', result.error);
      }
    }
  } catch (error) {
    console.warn('[SAM] Failed to initialize MFE registry:', error);
  }
}

/**
 * Get the Warm key for an MFE
 */
function getMFEKey(mfeId: string): string {
  return `${MFE_KEY_PREFIX}${mfeId}`;
}

/**
 * Get the metadata key for an MFE
 */
function getMetadataKey(mfeId: string): string {
  return `${MFE_KEY_PREFIX}${mfeId}.meta`;
}

/**
 * Get the current state of an MFE
 * @param mfeId The MFE identifier (e.g., 'demoHome', 'demoSettings')
 * @returns The MFE state or empty string if not tracked
 */
export function getMFEState(mfeId: string): MFEState {
  const key = getMFEKey(mfeId);

  if (!isNativeAvailable()) {
    // Use fallback store
    const value = _fallbackStore.get(key);
    return (value as MFEState) ?? '';
  }

  try {
    initializeMFERegistry();
    const value = Air.getWarm(key, MFE_INSTANCE_ID);
    return (value as MFEState) ?? '';
  } catch {
    return '';
  }
}

/**
 * Get full metadata for an MFE
 * @param mfeId The MFE identifier
 * @returns MFE metadata or null if not found
 */
export function getMFEMetadata(mfeId: string): MFEMetadata | null {
  const metaKey = getMetadataKey(mfeId);

  if (!isNativeAvailable()) {
    // Use fallback store
    const metaJson = _fallbackStore.get(metaKey);
    if (!metaJson || typeof metaJson !== 'string') {
      const state = getMFEState(mfeId);
      return state ? { state } : null;
    }
    try {
      return JSON.parse(metaJson);
    } catch {
      return { state: getMFEState(mfeId) };
    }
  }

  try {
    initializeMFERegistry();
    const metaJson = Air.getWarm(metaKey, MFE_INSTANCE_ID);
    if (!metaJson || typeof metaJson !== 'string') {
      const state = getMFEState(mfeId);
      return state ? { state } : null;
    }
    try {
      return JSON.parse(metaJson);
    } catch {
      return { state: getMFEState(mfeId) };
    }
  } catch {
    return null;
  }
}

/**
 * Set the state of an MFE
 * @param mfeId The MFE identifier
 * @param state The new state
 * @param metadata Optional additional metadata
 */
export function setMFEState(
  mfeId: string,
  state: MFEState,
  metadata?: Partial<MFEMetadata>
): void {
  const stateKey = getMFEKey(mfeId);
  const metaKey = getMetadataKey(mfeId);

  console.log(`[SAM] setMFEState: ${mfeId} -> ${state}`);

  if (!isNativeAvailable()) {
    // Use fallback store
    _fallbackStore.set(stateKey, state);
    notifyFallbackListeners(stateKey, state);

    if (metadata) {
      const existingMeta = getMFEMetadata(mfeId) ?? { state: '' };
      const newMeta: MFEMetadata = {
        ...existingMeta,
        ...metadata,
        state,
      };
      const metaJson = JSON.stringify(newMeta);
      _fallbackStore.set(metaKey, metaJson);
      notifyFallbackListeners(metaKey, metaJson);
    }
    return;
  }

  try {
    initializeMFERegistry();

    // Set the simple state value
    Air.setWarm(stateKey, state, MFE_INSTANCE_ID);

    // Update metadata if provided
    if (metadata) {
      const existingMeta = getMFEMetadata(mfeId) ?? { state: '' };
      const newMeta: MFEMetadata = {
        ...existingMeta,
        ...metadata,
        state,
      };
      Air.setWarm(
        metaKey,
        JSON.stringify(newMeta),
        MFE_INSTANCE_ID
      );
    }
  } catch (error) {
    console.warn('[SAM] Failed to set MFE state:', error);
  }
}

/**
 * Mark an MFE as loading
 * @param mfeId The MFE identifier
 */
export function markMFELoading(mfeId: string): void {
  setMFEState(mfeId, 'loading', {
    loadedAt: Date.now(),
  });
}

/**
 * Mark an MFE as loaded (with optional version)
 * @param mfeId The MFE identifier
 * @param version Optional version string
 */
export function markMFELoaded(mfeId: string, version?: string): void {
  const loadedAt = getMFEMetadata(mfeId)?.loadedAt ?? Date.now();
  const loadTimeMs = Date.now() - loadedAt;

  setMFEState(mfeId, version ?? 'loaded', {
    version,
    loadedAt,
    loadTimeMs,
  });
}

/**
 * Mark an MFE as mounted (active in the UI)
 * @param mfeId The MFE identifier
 */
export function markMFEMounted(mfeId: string): void {
  const existing = getMFEMetadata(mfeId);
  setMFEState(mfeId, 'mounted', {
    ...existing,
    mountedAt: Date.now(),
  });
}

/**
 * Mark an MFE as unmounted (no longer active)
 * @param mfeId The MFE identifier
 * @param keepLoaded If true, state becomes 'loaded' instead of ''
 */
export function markMFEUnmounted(mfeId: string, keepLoaded = true): void {
  const existing = getMFEMetadata(mfeId);
  const newState = keepLoaded ? (existing?.version ?? 'loaded') : '';
  setMFEState(mfeId, newState, {
    ...existing,
    unmountedAt: Date.now(),
  });
}

/**
 * Mark an MFE as failed to load
 * @param mfeId The MFE identifier
 * @param errorMessage Optional error message
 */
export function markMFEError(mfeId: string, errorMessage?: string): void {
  setMFEState(mfeId, 'error', {
    errorMessage,
  });
}

/**
 * Clear the state of an MFE
 * @param mfeId The MFE identifier
 */
export function clearMFEState(mfeId: string): void {
  const stateKey = getMFEKey(mfeId);
  const metaKey = getMetadataKey(mfeId);

  console.log(`[SAM] clearMFEState: ${mfeId}`);

  if (!isNativeAvailable()) {
    // Use fallback store
    _fallbackStore.delete(stateKey);
    _fallbackStore.delete(metaKey);
    notifyFallbackListeners(stateKey, null);
    notifyFallbackListeners(metaKey, null);
    return;
  }

  try {
    initializeMFERegistry();
    Air.deleteWarm(stateKey, MFE_INSTANCE_ID);
    Air.deleteWarm(metaKey, MFE_INSTANCE_ID);
  } catch (error) {
    console.warn('[SAM] Failed to clear MFE state:', error);
  }
}

/**
 * Get all tracked MFE IDs
 * Note: This requires iterating through known MFEs since MMKV doesn't support key listing
 */
export function getTrackedMFEs(knownMFEs: string[]): Record<string, MFEMetadata | null> {
  const result: Record<string, MFEMetadata | null> = {};

  for (const mfeId of knownMFEs) {
    result[mfeId] = getMFEMetadata(mfeId);
  }

  return result;
}

/**
 * Check if native MFE tracking is available
 */
export function isMFETrackingAvailable(): boolean {
  return isNativeAvailable();
}

/**
 * MFE Registry - convenience object for managing MFE states
 */
export const MFERegistry = {
  initialize: initializeMFERegistry,
  getState: getMFEState,
  getMetadata: getMFEMetadata,
  setState: setMFEState,
  loading: markMFELoading,
  loaded: markMFELoaded,
  mounted: markMFEMounted,
  unmounted: markMFEUnmounted,
  error: markMFEError,
  clear: clearMFEState,
  getAll: getTrackedMFEs,
  isAvailable: isMFETrackingAvailable,
  INSTANCE_ID: MFE_INSTANCE_ID,
  KEY_PREFIX: MFE_KEY_PREFIX,
};
