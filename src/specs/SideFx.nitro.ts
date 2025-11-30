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
// MMKV (Warm Storage) Types
// ============================================================================

/**
 * MMKV-specific listener configuration
 */
export interface MMKVListenerConfig {
  keys?: string[];
  patterns?: string[];
  conditions?: Condition[];
  instanceId?: string;
}

// ============================================================================
// SQLite (Cold Storage) Types
// ============================================================================

/**
 * SQLite operation types
 */
export type SQLiteOperation = 'INSERT' | 'UPDATE' | 'DELETE';

/**
 * Row condition for SQLite listeners
 */
export interface RowCondition {
  column: string;
  condition: Condition;
}

/**
 * SQLite-specific listener configuration
 */
export interface SQLiteListenerConfig {
  table?: string;
  columns?: string[];
  operations?: SQLiteOperation[];
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
 * Correlation config between MMKV and SQLite
 */
export interface CorrelationConfig {
  mmkvKey: string;
  sqliteParam: string;
}

/**
 * Configuration for cross-storage listeners
 */
export interface CombinedListenerConfig {
  mmkv?: MMKVListenerConfig;
  sqlite?: SQLiteListenerConfig;
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
  mmkv?: MMKVListenerConfig;
  sqlite?: SQLiteListenerConfig;
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
 * Row data from SQLite (simplified for C++ compatibility)
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
   * Get the default root directory for MMKV storage
   * Returns platform-specific path:
   * - iOS: Library/mmkv
   * - Android: files/mmkv
   */
  getDefaultMMKVPath(): string;

  /**
   * Set the root directory for MMKV storage
   * Call this once before initializing any MMKV instances
   * If not called, use getDefaultMMKVPath() to get the platform default
   * @param rootPath The directory path for MMKV storage files
   */
  setMMKVRootPath(rootPath: string): void;

  /**
   * Initialize MMKV adapter
   * Must be called before MMKV listeners will work
   * @param instanceId MMKV instance ID (default: "default")
   */
  initializeMMKV(instanceId?: string): ListenerResult;

  /**
   * Initialize SQLite adapter
   * Must be called before SQLite listeners will work
   * @param databaseName Database name
   * @param databasePath Path to the database file
   */
  initializeSQLite(databaseName: string, databasePath: string): ListenerResult;

  /**
   * Check if MMKV is initialized
   * @param instanceId Optional MMKV instance ID to check
   */
  isMMKVInitialized(instanceId?: string): boolean;

  /**
   * Check if SQLite is initialized
   * @param databaseName Optional specific database to check
   */
  isSQLiteInitialized(databaseName?: string): boolean;

  /**
   * Manually trigger a check for MMKV changes
   * Useful if using a custom MMKV setup
   */
  checkMMKVChanges(): void;

  /**
   * Manually trigger a check for SQLite changes
   * @param databaseName Database to check
   * @param table Optional specific table to check
   */
  checkSQLiteChanges(databaseName: string, table?: string): void;

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
   * Set a value in MMKV storage
   * @param key The key to set
   * @param value The value to set (string, number, boolean)
   * @param instanceId Optional MMKV instance ID (default: "default")
   * @returns Result indicating success or failure
   */
  setMMKV(
    key: string,
    value: string | number | boolean,
    instanceId?: string
  ): ListenerResult;

  /**
   * Get a value from MMKV storage
   * @param key The key to get
   * @param instanceId Optional MMKV instance ID (default: "default")
   * @returns The value or null if not found
   */
  getMMKV(key: string, instanceId?: string): string | number | boolean | null;

  /**
   * Delete a key from MMKV storage
   * @param key The key to delete
   * @param instanceId Optional MMKV instance ID (default: "default")
   * @returns Result indicating success or failure
   */
  deleteMMKV(key: string, instanceId?: string): ListenerResult;

  /**
   * Execute a SQL statement on SQLite storage
   * @param sql The SQL statement to execute
   * @param params Optional parameters for the statement
   * @param databaseName Optional database name (default: "default")
   * @returns Result indicating success or failure
   */
  executeSQLite(
    sql: string,
    params?: Array<string | number | boolean | null>,
    databaseName?: string
  ): ListenerResult;

  /**
   * Query SQLite storage and return results as JSON
   * @param sql The SQL query to execute
   * @param params Optional parameters for the query
   * @param databaseName Optional database name (default: "default")
   * @returns JSON string of query results or null on error
   */
  querySQLite(
    sql: string,
    params?: Array<string | number | boolean | null>,
    databaseName?: string
  ): string | null;
}
