/**
 * S.A.M - State Awareness Manager
 * TypeScript type definitions
 */

// ============================================================================
// Condition Types
// ============================================================================

/**
 * Condition types for value matching
 */
export type ConditionType =
  | 'exists'
  | 'notExists'
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'matchesRegex'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'changed'
  | 'in'
  | 'notIn';

/**
 * A single condition for value matching
 */
export interface Condition {
  type: ConditionType;
  value?: string | number | boolean;
  values?: Array<string | number>;
  regex?: string;
}

// ============================================================================
// Warm Storage Types
// ============================================================================

/**
 * Warm storage listener configuration
 */
export interface WarmListenerConfig {
  /** Exact keys to watch */
  keys?: string[];
  /** Glob patterns to match keys */
  patterns?: string[];
  /** Conditions that must be met for the listener to fire */
  conditions?: Condition[];
  /** Warm instance ID (default: "default") */
  instanceId?: string;
}

// ============================================================================
// Cold Storage Types
// ============================================================================

/**
 * Cold storage operation types
 */
export type ColdOperation = 'INSERT' | 'UPDATE' | 'DELETE';

/**
 * Row condition for Cold storage listeners
 */
export interface RowCondition {
  column: string;
  condition: Condition;
}

/**
 * Cold storage listener configuration
 */
export interface ColdListenerConfig {
  /** Table to watch */
  table?: string;
  /** Specific columns to watch */
  columns?: string[];
  /** Operation types to watch */
  operations?: ColdOperation[];
  /** Row-level conditions */
  where?: RowCondition[];
  /** Alternative: watch a query's results */
  query?: string;
  /** Query parameters */
  queryParams?: Array<string | number | null>;
  /** Database name (default: "default") */
  databaseName?: string;
}

// ============================================================================
// Combined Storage Types
// ============================================================================

/**
 * Logic for combining multiple conditions
 */
export type CombineLogic = 'AND' | 'OR';

/**
 * Correlation config between Warm and Cold storage
 */
export interface CorrelationConfig {
  warmKey: string;
  coldParam: string;
}

/**
 * Configuration for cross-storage listeners
 */
export interface CombinedListenerConfig {
  /** Warm conditions */
  warm?: WarmListenerConfig;
  /** Cold storage conditions */
  cold?: ColdListenerConfig;
  /** How to combine conditions */
  logic?: CombineLogic;
  /** Correlation between warm and cold */
  correlation?: CorrelationConfig;
}

// ============================================================================
// Listener Options
// ============================================================================

/**
 * Options for listener behavior
 */
export interface ListenerOptions {
  /**
   * Debounce in milliseconds - wait for inactivity before firing.
   * After a change, wait this long with no new changes before calling callback.
   * Useful for batching rapid changes (e.g., typing in a search field).
   * @example debounceMs: 300 - Wait 300ms of silence before firing
   */
  debounceMs?: number;

  /**
   * Throttle in milliseconds - minimum time between callback invocations.
   * Ensures the callback is not called more frequently than this interval.
   * If a change occurs before the interval has passed since the last call,
   * the callback will be delayed until the interval has elapsed.
   * @example throttleMs: 9000 - At most one callback every 9 seconds
   */
  throttleMs?: number;

  /** Fire immediately with current value on registration */
  fireImmediately?: boolean;

  /** Enable debug logging for this listener */
  debug?: boolean;
}

/**
 * Full listener configuration
 */
export interface ListenerConfig {
  /** Warm-specific configuration */
  warm?: WarmListenerConfig;
  /** Cold storage configuration */
  cold?: ColdListenerConfig;
  /** Combined cross-storage configuration */
  combined?: CombinedListenerConfig;
  /** Behavior options */
  options?: ListenerOptions;
}

// ============================================================================
// Change Event Types
// ============================================================================

/**
 * Source of the change event
 */
export type ChangeSource = 'warm' | 'cold' | 'mmkv' | 'sqlite';

/**
 * Operation type for the change
 */
export type ChangeOperation = 'set' | 'delete' | 'insert' | 'update';

/**
 * Row data from Cold storage (JSON-encoded for cross-platform compatibility)
 */
export interface RowData {
  /** JSON-encoded row data */
  json: string;
}

/**
 * Event data passed to listener callbacks
 */
export interface ChangeEvent {
  /** The ID of the listener that was triggered */
  listenerId: string;
  /** Source of the change */
  source: ChangeSource;
  /** For MMKV: the key that changed */
  key?: string;
  /** For Cold storage: the table that changed */
  table?: string;
  /** For Cold storage: the affected row ID */
  rowId?: number;
  /** Type of operation */
  operation: ChangeOperation;
  /** Previous value (if available) */
  oldValue?: unknown;
  /** New value */
  newValue?: unknown;
  /** For Cold storage: the affected row data (JSON-encoded) */
  row?: RowData;
  /** Timestamp of the change (Unix ms) */
  timestamp: number;
}

/**
 * Callback function type for listeners
 */
export type ListenerCallback = (event: ChangeEvent) => void;

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result of listener operations
 */
export interface ListenerResult {
  success: boolean;
  error?: string;
}

/**
 * Listener info returned by getListeners
 */
export interface ListenerInfo {
  id: string;
  config: ListenerConfig;
  createdAt: number;
  triggerCount: number;
  lastTriggered?: number;
  isPaused: boolean;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * SAM global configuration options
 */
export interface SAMConfig {
  /** Enable debug mode globally */
  debug?: boolean;
  /** Maximum number of listeners */
  maxListeners?: number;
  /** Value cache size limit */
  cacheSize?: number;
}

// ============================================================================
// Hook Types
// ============================================================================

/**
 * Configuration for useWarm hook
 */
export interface UseWarmConfig {
  /** MMKV instance identifier */
  id?: string;
  /** Storage configuration */
  store?: {
    path?: string;
    encryptionKey?: string;
  };
  /** Array of MMKV keys to watch */
  keys: string[];
  /** Optional glob patterns to watch */
  patterns?: string[];
  /** Conditions for when to trigger */
  conditions?: Condition[];
  /** Listener behavior options */
  options?: {
    debounceMs?: number;
    throttleMs?: number;
    fireImmediately?: boolean;
    debug?: boolean;
  };
}

/**
 * Return value from useWarm hook
 */
export interface UseWarmResult<T> {
  /** Query a specific key's value */
  get: (key: string) => T | undefined;
  /** Query all watched keys */
  getAll: () => Record<string, T | undefined>;
  /** Whether the hook is currently listening */
  isListening: boolean;
  /** The internal listener ID */
  listenerId: string;
  /** Pause listening */
  pause: () => void;
  /** Resume listening */
  resume: () => void;
  /** Force refresh */
  refresh: () => void;
}

/**
 * Event passed to useWarm callback
 */
export interface WarmChangeEvent {
  listenerId: string;
  source: 'warm';
  key: string;
  operation: 'set' | 'delete';
  oldValue?: unknown;
  newValue?: unknown;
  timestamp: number;
}

/**
 * Configuration for useCold hook
 */
export interface UseColdConfig {
  /** Database identifier/name */
  database?: string;
  /** Database connection info */
  connection?: {
    path?: string;
    type?: 'sqlite' | 'realm' | 'auto';
  };
  /** Table to watch for changes */
  table?: string;
  /** Specific columns to watch */
  columns?: string[];
  /** Operations to watch */
  operations?: ColdOperation[];
  /** Row conditions */
  where?: RowCondition[];
  /** Alternative: watch a query's results */
  query?: string;
  /** Query parameters */
  queryParams?: Array<string | number | boolean | null>;
  /** Listener options */
  options?: {
    debounceMs?: number;
    throttleMs?: number;
    fireImmediately?: boolean;
    debug?: boolean;
  };
}

/**
 * Return value from useCold hook
 */
export interface UseColdResult<T> {
  /** Query the data */
  query: () => T | null;
  /** Query with override params */
  queryWith: (params?: Array<string | number | boolean | null>) => T | null;
  /** Whether the hook is currently listening */
  isListening: boolean;
  /** The internal listener ID */
  listenerId: string;
  /** Last change info */
  lastChange: {
    operation: ColdOperation | null;
    rowId: number | null;
    timestamp: number | null;
  };
  /** Pause listening */
  pause: () => void;
  /** Resume listening */
  resume: () => void;
  /** Force refresh */
  refresh: () => void;
}

/**
 * Event passed to useCold callback
 */
export interface ColdChangeEvent {
  listenerId: string;
  source: 'cold';
  table: string;
  operation: ColdOperation;
  rowId: number;
  row?: RowData;
  previousRow?: RowData;
  timestamp: number;
  queryResult?: unknown;
}

/**
 * Configuration for useStorage hook
 */
export interface UseStorageConfig {
  warm?: {
    id?: string;
    keys: string[];
    patterns?: string[];
    conditions?: Condition[];
  };
  cold?: {
    database?: string;
    table?: string;
    query?: string;
    queryParams?: Array<string | number | boolean | null>;
    columns?: string[];
    operations?: ColdOperation[];
  };
  /** How to combine triggers */
  logic?: CombineLogic;
  /** Correlation between warm and cold */
  correlation?: {
    warmKey: string;
    coldParam: string;
  };
  options?: {
    debounceMs?: number;
    throttleMs?: number;
    fireImmediately?: boolean;
    debug?: boolean;
  };
}

/**
 * Return value from useStorage hook
 */
export interface UseStorageResult<TWarm, TCold> {
  /** Query warm storage value */
  getWarm: (key: string) => TWarm | undefined;
  /** Query cold storage data */
  queryCold: () => TCold | null;
  /** Which storage type triggered the last change */
  lastSource: 'warm' | 'cold' | null;
  /** Whether listening */
  isListening: boolean;
  /** Listener ID */
  listenerId: string;
  /** Pause listening */
  pause: () => void;
  /** Resume listening */
  resume: () => void;
  /** Force refresh */
  refresh: () => void;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes returned by SAM operations
 */
export enum SAMErrorCode {
  DUPLICATE_LISTENER_ID = 'E101',
  INVALID_LISTENER_ID = 'E102',
  INVALID_CONFIG = 'E103',
  INVALID_PATTERN = 'E104',
  INVALID_CONDITION = 'E105',
  MAX_LISTENERS_REACHED = 'E106',
  WARM_NOT_INITIALIZED = 'E201',
  COLD_NOT_INITIALIZED = 'E202',
  ADAPTER_INIT_FAILED = 'E203',
  LISTENER_NOT_FOUND = 'E301',
  CALLBACK_ERROR = 'E302',
  PATTERN_MATCH_ERROR = 'E303',
  INTERNAL_ERROR = 'E500',
}

/**
 * Error structure
 */
export interface SAMError {
  code: SAMErrorCode;
  message: string;
  suggestion?: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// Network Types
// ============================================================================

/**
 * Network connection status
 */
export type NetworkStatus = 'online' | 'offline' | 'unknown';

/**
 * Network connection type
 */
export type ConnectionType =
  | 'wifi'
  | 'cellular'
  | 'ethernet'
  | 'bluetooth'
  | 'vpn'
  | 'none'
  | 'unknown';

/**
 * Cellular network generation
 */
export type CellularGeneration = '2g' | '3g' | '4g' | '5g' | 'unknown' | null;

/**
 * Network state information
 */
export interface NetworkState {
  /** Overall connection status */
  status: NetworkStatus;
  /** Connection type (wifi, cellular, etc.) */
  type: ConnectionType;
  /** Whether the device has a network connection */
  isConnected: boolean;
  /** Whether the internet is reachable (may be null if unknown) */
  isInternetReachable: boolean | null;
  /** For cellular: the generation (2g, 3g, 4g, 5g) */
  cellularGeneration: CellularGeneration;
  /** WiFi signal strength 0-100 (Android only, -1 if unavailable) */
  wifiStrength: number;
  /** Whether the connection is expensive/metered */
  isConnectionExpensive: boolean;
  /** Timestamp of the last state update */
  timestamp: number;
}

/**
 * Configuration for useNetwork hook
 */
export interface UseNetworkConfig {
  /** Options for the network listener */
  options?: {
    /** Debounce rapid network changes (ms) */
    debounceMs?: number;
    /** Throttle callback frequency (ms) */
    throttleMs?: number;
    /** Fire immediately with current state on mount */
    fireImmediately?: boolean;
    /** Enable debug logging */
    debug?: boolean;
  };
}

/**
 * Return value from useNetwork hook
 */
export interface UseNetworkResult {
  /** Current network state */
  state: NetworkState;
  /** Whether the device is online */
  isOnline: boolean;
  /** Whether the device is offline */
  isOffline: boolean;
  /** Whether using WiFi */
  isWifi: boolean;
  /** Whether using cellular */
  isCellular: boolean;
  /** WiFi signal strength (0-100, -1 if unavailable) */
  wifiStrength: number;
  /** Cellular generation if on cellular */
  cellularGeneration: CellularGeneration;
  /** Force refresh network state */
  refresh: () => void;
}

/**
 * Network change event passed to callbacks
 */
export interface NetworkChangeEvent {
  /** Previous network state */
  previousState: NetworkState;
  /** Current network state */
  currentState: NetworkState;
  /** Timestamp of the change */
  timestamp: number;
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type StorageValue = string | number | boolean | null | undefined;
