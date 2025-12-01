/**
 * S.A.M - State Awareness Manager
 * Nitro Module Interface Specification
 */
import type { HybridObject } from 'react-native-nitro-modules';

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
  keys?: string[];
  patterns?: string[];
  conditions?: Condition[];
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
  table?: string;
  columns?: string[];
  operations?: ColdOperation[];
  where?: RowCondition[];
  query?: string;
  queryParams?: Array<string | number | null>;
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
  warm?: WarmListenerConfig;
  cold?: ColdListenerConfig;
  logic?: CombineLogic;
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
   */
  debounceMs?: number;

  /**
   * Throttle in milliseconds - minimum time between callback invocations.
   * Ensures the callback is not called more frequently than this interval.
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
  warm?: WarmListenerConfig;
  cold?: ColdListenerConfig;
  combined?: CombinedListenerConfig;
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
 * Row data from Cold storage (simplified for C++ compatibility)
 */
export interface RowData {
  json: string; // JSON-encoded row data
}

/**
 * Event data passed to listener callbacks
 */
export interface ChangeEvent {
  listenerId: string;
  source: ChangeSource;
  key?: string;
  table?: string;
  rowId?: number;
  operation: ChangeOperation;
  oldValue?: string | number | boolean | null;
  newValue?: string | number | boolean | null;
  row?: RowData;
  timestamp: number;
}

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
  debug?: boolean;
  maxListeners?: number;
  cacheSize?: number;
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
export type CellularGeneration = '2g' | '3g' | '4g' | '5g' | 'unknown';

/**
 * Network state information returned from native
 */
export interface NetworkState {
  /** Overall connection status */
  status: NetworkStatus;
  /** Connection type (wifi, cellular, etc.) */
  type: ConnectionType;
  /** Whether the device has a network connection */
  isConnected: boolean;
  /** Whether the internet is reachable (-1 = unknown, 0 = no, 1 = yes) */
  isInternetReachable: number;
  /** For cellular: the generation (2g, 3g, 4g, 5g, unknown) */
  cellularGeneration: CellularGeneration;
  /** WiFi signal strength 0-100 (-1 if unavailable) */
  wifiStrength: number;
  /** Whether the connection is expensive/metered */
  isConnectionExpensive: boolean;
  /** Timestamp of the last state update (Unix ms) */
  timestamp: number;
}

// ============================================================================
// Main SideFx Hybrid Object Interface
// ============================================================================

/**
 * Main SideFx Hybrid Object interface
 * This is the Nitro Module specification for S.A.M
 */
export interface SideFx extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  /**
   * Add a new listener
   * @param id Unique identifier for this listener (provided by caller)
   * @param config Listener configuration
   * @returns Result indicating success or failure
   */
  addListener(id: string, config: ListenerConfig): ListenerResult;

  /**
   * Remove a listener by ID
   * @param id The listener ID to remove
   * @returns Result indicating success or failure
   */
  removeListener(id: string): ListenerResult;

  /**
   * Remove all listeners
   * @returns Number of listeners removed
   */
  removeAllListeners(): number;

  /**
   * Check if a listener exists
   * @param id The listener ID to check
   * @returns True if listener exists
   */
  hasListener(id: string): boolean;

  /**
   * Get all active listener IDs
   * @returns Array of listener IDs
   */
  getListenerIds(): string[];

  /**
   * Get detailed info about all listeners
   * @returns Array of listener info objects
   */
  getListeners(): ListenerInfo[];

  /**
   * Get info about a specific listener
   * @param id The listener ID
   * @returns Listener info or undefined if not found
   */
  getListener(id: string): ListenerInfo | undefined;

  /**
   * Pause a listener (stop receiving events)
   * @param id The listener ID
   * @returns Result indicating success or failure
   */
  pauseListener(id: string): ListenerResult;

  /**
   * Resume a paused listener
   * @param id The listener ID
   * @returns Result indicating success or failure
   */
  resumeListener(id: string): ListenerResult;

  /**
   * Configure SAM globally
   * @param config Configuration options
   */
  configure(config: SAMConfig): void;

  /**
   * Get the default root directory for Warm storage
   * Returns platform-specific path:
   * - iOS: Library/mmkv
   * - Android: files/mmkv
   */
  getDefaultWarmPath(): string;

  /**
   * Set the root directory for Warm storage
   * Call this once before initializing any Warm instances
   * If not called, use getDefaultWarmPath() to get the platform default
   * @param rootPath The directory path for Warm storage files
   */
  setWarmRootPath(rootPath: string): void;

  /**
   * Initialize Warm adapter
   * Must be called before Warm listeners will work
   * @param instanceId Warm instance ID (default: "default")
   */
  initializeWarm(instanceId?: string): ListenerResult;

  /**
   * Initialize Cold storage adapter
   * Must be called before Cold storage listeners will work
   * @param databaseName Database name
   * @param databasePath Path to the database file
   */
  initializeCold(databaseName: string, databasePath: string): ListenerResult;

  /**
   * Check if Warm storage is initialized
   * @param instanceId Optional Warm instance ID to check
   */
  isWarmInitialized(instanceId?: string): boolean;

  /**
   * Check if Cold storage is initialized
   * @param databaseName Optional specific database to check
   */
  isColdInitialized(databaseName?: string): boolean;

  /**
   * Manually trigger a check for Warm storage changes
   * Useful if using a custom Warm setup
   */
  checkWarmChanges(): void;

  /**
   * Manually trigger a check for Cold storage changes
   * @param databaseName Database to check
   * @param table Optional specific table to check
   */
  checkColdChanges(databaseName: string, table?: string): void;

  /**
   * Get current debug mode status
   */
  isDebugMode(): boolean;

  /**
   * Set debug mode
   * @param enabled Enable or disable debug logging
   */
  setDebugMode(enabled: boolean): void;

  /**
   * Get version information
   */
  getVersion(): string;

  // ============================================================================
  // Storage Write Methods
  // ============================================================================

  /**
   * Set a value in Warm storage
   * @param key The key to set
   * @param value The value to set (string, number, boolean)
   * @param instanceId Optional Warm instance ID (default: "default")
   * @returns Result indicating success or failure
   */
  setWarm(
    key: string,
    value: string | number | boolean,
    instanceId?: string
  ): ListenerResult;

  /**
   * Get a value from Warm storage
   * @param key The key to get
   * @param instanceId Optional Warm instance ID (default: "default")
   * @returns The value or null if not found
   */
  getWarm(key: string, instanceId?: string): string | number | boolean | null;

  /**
   * Delete a key from Warm storage
   * @param key The key to delete
   * @param instanceId Optional Warm instance ID (default: "default")
   * @returns Result indicating success or failure
   */
  deleteWarm(key: string, instanceId?: string): ListenerResult;

  /**
   * Execute a SQL statement on Cold storage
   * @param sql The SQL statement to execute
   * @param params Optional parameters for the statement
   * @param databaseName Optional database name (default: "default")
   * @returns Result indicating success or failure
   */
  executeCold(
    sql: string,
    params?: Array<string | number | boolean | null>,
    databaseName?: string
  ): ListenerResult;

  /**
   * Query Cold storage and return results as JSON
   * @param sql The SQL query to execute
   * @param params Optional parameters for the query
   * @param databaseName Optional database name (default: "default")
   * @returns JSON string of query results or null on error
   */
  queryCold(
    sql: string,
    params?: Array<string | number | boolean | null>,
    databaseName?: string
  ): string | null;

  // ============================================================================
  // Network Monitoring Methods
  // ============================================================================

  /**
   * Start monitoring network status changes
   * Must be called before network listeners will receive updates
   * @returns Result indicating success or failure
   */
  startNetworkMonitoring(): ListenerResult;

  /**
   * Stop monitoring network status changes
   * @returns Result indicating success or failure
   */
  stopNetworkMonitoring(): ListenerResult;

  /**
   * Check if network monitoring is active
   * @returns True if monitoring is active
   */
  isNetworkMonitoringActive(): boolean;

  /**
   * Get the current network state
   * @returns Current network state information
   */
  getNetworkState(): NetworkState;

  /**
   * Force a refresh of the network state
   * Useful for getting the latest state on demand
   */
  refreshNetworkState(): void;

  /**
   * Enable or disable active ping mode for internet quality measurement
   *
   * In ACTIVE mode (debug/simulator): Periodically pings external endpoints
   * to measure latency. Uses multiple endpoints (Google, Apple) in round-robin.
   *
   * In PASSIVE mode (production default): Relies on the app to report
   * network latency via reportNetworkLatency() from actual API calls.
   * This avoids unnecessary network requests and privacy concerns.
   *
   * @param enabled True to enable active pinging, false for passive mode
   */
  setActivePingMode(enabled: boolean): void;

  /**
   * Report observed network latency from app's own network calls
   *
   * Call this from your networking layer (fetch interceptor, Axios interceptor, etc.)
   * to update internet quality based on actual app traffic.
   *
   * In passive mode (production), this is the primary way to measure internet quality.
   * In active mode, this supplements the periodic pings with real-world data.
   *
   * @param latencyMs The observed latency in milliseconds
   */
  reportNetworkLatency(latencyMs: number): void;

  /**
   * Report a network failure from app's own network calls
   *
   * Call this when a network request fails due to connectivity issues.
   * This sets INTERNET_REACHABLE to false and triggers offline recovery checks.
   *
   * @example
   * ```typescript
   * try {
   *   await fetch('/api/data');
   * } catch (error) {
   *   if (isNetworkError(error)) {
   *     Air.reportNetworkFailure();
   *   }
   * }
   * ```
   */
  reportNetworkFailure(): void;

  /**
   * Set custom endpoints for active ping mode.
   *
   * By default, S.A.M pings Google and Apple connectivity check endpoints.
   * Use this to specify your own endpoints (e.g., your API server health endpoint).
   *
   * Requirements for endpoints:
   * - Should respond quickly (< 1s ideally)
   * - Should be reliable and always available
   * - Should support HEAD requests
   * - Should return any 2xx status on success
   *
   * @param endpoints Array of URLs to ping. Empty array resets to defaults.
   */
  setPingEndpoints(endpoints: string[]): void;
}
