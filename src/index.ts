/**
 * S.A.M - State Awareness Manager
 *
 * Reactive listeners for MMKV and SQLite storage changes.
 * Provides pattern-based key matching, conditional triggers,
 * and React hooks for seamless component integration.
 */

// Main API
export { SideFx } from './SideFx';

// React Hooks
export { useWarm, useCold, useStorage } from './hooks';

// Types from Nitro spec
export type {
  ConditionType,
  Condition,
  MMKVListenerConfig,
  SQLiteOperation,
  RowCondition,
  SQLiteListenerConfig,
  CombineLogic,
  CorrelationConfig,
  CombinedListenerConfig,
  ListenerOptions,
  ListenerConfig,
  ChangeSource,
  ChangeOperation,
  RowData,
  ChangeEvent,
  ListenerResult,
  ListenerInfo,
  SAMConfig,
  SideFx as SideFxSpec,
} from './specs/SideFx.nitro';

// Types for hooks
export type {
  UseWarmConfig,
  UseWarmResult,
  WarmChangeEvent,
  UseColdConfig,
  UseColdResult,
  ColdChangeEvent,
  UseStorageConfig,
  UseStorageResult,
  SAMError,
  StorageValue,
  DeepPartial,
} from './types';

export { SAMErrorCode } from './types';

// Callback type
export type { ListenerCallback } from './SideFx';

// MFE (Micro Frontend) State Tracking
export {
  MFERegistry,
  MFE_INSTANCE_ID,
  MFE_KEY_PREFIX,
  setMMKVRootPath,
  initializeMFERegistry,
  getMFEState,
  getMFEMetadata,
  setMFEState,
  markMFELoading,
  markMFELoaded,
  markMFEMounted,
  markMFEUnmounted,
  markMFEError,
  clearMFEState,
  getTrackedMFEs,
  addFallbackListener,
} from './mfe';

export type { MFEState, MFEMetadata } from './mfe';

// MFE React Hooks (for observing state, not component wrapping)
export {
  useMFEState,
  useMFEStates,
  useMFEControl,
} from './useMFE';

// Secure Storage (requires react-native-keychain - optional peer dependency)
export { SecureStorage } from './secure';
export type {
  SecureStorageOptions,
  SecureAccessible,
  SecureSecurityLevel,
  BiometryType,
  SecureResult,
  SecureCredentials,
} from './secure';

// Secure Storage React Hooks
export { useSecure, useSecureCredentials } from './useSecure';
export type { UseSecureConfig, UseSecureResult } from './useSecure';
