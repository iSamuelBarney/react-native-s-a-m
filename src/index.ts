/**
 * S.A.M - State Awareness Manager
 *
 * Reactive listeners for Warm and Cold storage changes.
 * Provides pattern-based key matching, conditional triggers,
 * and React hooks for seamless component integration.
 */

// Main API
export { Air, SideFx, DEFAULT_COLD_DB_NAME } from './SideFx';

// React Hooks
export { useWarm, useCold, useStorage } from './hooks';

// Types from Nitro spec
export type {
  ConditionType,
  Condition,
  WarmListenerConfig,
  ColdOperation,
  RowCondition,
  ColdListenerConfig,
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
  // Network types
  NetworkStatus,
  ConnectionType,
  CellularGeneration,
  NetworkState,
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
  setWarmRootPath,
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

// Network Monitoring React Hooks
export { useNetwork, useIsOnline, useNetworkQuality } from './useNetwork';
export type {
  UseNetworkResult,
  UseNetworkConfig,
  NetworkQuality,
  InternetQuality,
  InternetState,
} from './useNetwork';

// Constants for type-safe state comparisons
export {
  INTERNET_STATE,
  APP_STATE,
  NETWORK_QUALITY,
  CONNECTION_TYPE,
  INTERNET_QUALITY,
} from './constants';
export type {
  InternetStateValue,
  AppStateValue,
  NetworkQualityValue,
  ConnectionTypeValue,
  InternetQualityValue,
} from './constants';
