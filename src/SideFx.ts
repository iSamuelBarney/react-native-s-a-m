/**
 * S.A.M - State Awareness Manager
 * High-level TypeScript API wrapper
 */
import { NitroModules } from 'react-native-nitro-modules';
import type {
  SideFx as SideFxSpec,
  ListenerConfig,
  ChangeEvent,
  ListenerResult,
  ListenerInfo,
  SAMConfig,
} from './specs/SideFx.nitro';

/**
 * Callback function type for listeners
 */
export type ListenerCallback = (event: ChangeEvent) => void;

// Get the native hybrid object directly
const NativeSideFx = NitroModules.createHybridObject<SideFxSpec>('SideFx');

// Store callbacks in JS (native stores config, JS stores callbacks)
const callbacks = new Map<string, ListenerCallback>();

/**
 * High-level TypeScript API for SideFx
 * Provides reactive listeners for MMKV and SQLite storage changes
 */
export const SideFx = {
  /**
   * Add a listener for storage changes
   *
   * @param id Unique identifier for this listener
   * @param config Configuration specifying what to watch
   * @param callback Function called when changes occur
   * @returns Result with success status
   *
   * @example
   * ```typescript
   * SideFx.addListener(
   *   'user-name-listener',
   *   {
   *     mmkv: {
   *       keys: ['user.name'],
   *       conditions: [{ type: 'exists' }]
   *     }
   *   },
   *   (event) => {
   *     console.log('User name changed:', event.newValue);
   *   }
   * );
   * ```
   */
  addListener(
    id: string,
    config: ListenerConfig,
    callback: ListenerCallback
  ): ListenerResult {
    // Validate ID
    if (!id || typeof id !== 'string') {
      return { success: false, error: 'Invalid listener ID' };
    }

    if (callbacks.has(id)) {
      return {
        success: false,
        error: `Listener with ID "${id}" already exists`,
      };
    }

    // Store callback
    callbacks.set(id, callback);

    // Register with native
    const result = NativeSideFx.addListener(id, config);

    if (!result.success) {
      callbacks.delete(id);
    }

    return result;
  },

  /**
   * Remove a listener by ID
   *
   * @param id The listener ID to remove
   * @returns Result with success status
   */
  removeListener(id: string): ListenerResult {
    callbacks.delete(id);
    return NativeSideFx.removeListener(id);
  },

  /**
   * Remove all listeners
   *
   * @returns Number of listeners removed
   */
  removeAllListeners(): number {
    callbacks.clear();
    return NativeSideFx.removeAllListeners();
  },

  /**
   * Check if a listener exists
   */
  hasListener(id: string): boolean {
    return NativeSideFx.hasListener(id);
  },

  /**
   * Get all active listener IDs
   */
  getListenerIds(): string[] {
    return NativeSideFx.getListenerIds();
  },

  /**
   * Get detailed info about all listeners
   */
  getListeners(): ListenerInfo[] {
    return NativeSideFx.getListeners();
  },

  /**
   * Get info about a specific listener
   */
  getListener(id: string): ListenerInfo | undefined {
    return NativeSideFx.getListener(id);
  },

  /**
   * Pause a listener
   */
  pauseListener(id: string): ListenerResult {
    return NativeSideFx.pauseListener(id);
  },

  /**
   * Resume a paused listener
   */
  resumeListener(id: string): ListenerResult {
    return NativeSideFx.resumeListener(id);
  },

  /**
   * Configure SAM globally
   */
  configure(config: SAMConfig): void {
    NativeSideFx.configure(config);
  },

  /**
   * Get the default MMKV root path for this platform
   * - iOS: Library/mmkv
   * - Android: files/mmkv (must be set via setMMKVRootPath first on Android)
   */
  getDefaultMMKVPath(): string {
    return NativeSideFx.getDefaultMMKVPath();
  },

  /**
   * Set the root directory for MMKV storage
   * Optional on iOS (auto-detected), required on Android
   *
   * @param rootPath The directory path for MMKV storage files
   *
   * @example
   * ```typescript
   * // On Android, you need to set this before initializing MMKV:
   * import { Platform } from 'react-native';
   * if (Platform.OS === 'android') {
   *   // Get path from your file system library or native module
   *   SideFx.setMMKVRootPath('/data/data/com.yourapp/files/mmkv');
   * }
   * ```
   */
  setMMKVRootPath(rootPath: string): void {
    NativeSideFx.setMMKVRootPath(rootPath);
  },

  /**
   * Initialize MMKV adapter
   * On iOS, automatically uses Library/mmkv
   * On Android, call setMMKVRootPath first
   */
  initializeMMKV(instanceId?: string): ListenerResult {
    return NativeSideFx.initializeMMKV(instanceId);
  },

  /**
   * Initialize SQLite adapter
   * Call this after opening your database
   */
  initializeSQLite(databaseName: string, databasePath: string): ListenerResult {
    return NativeSideFx.initializeSQLite(databaseName, databasePath);
  },

  /**
   * Check if MMKV is initialized
   */
  isMMKVInitialized(instanceId?: string): boolean {
    return NativeSideFx.isMMKVInitialized(instanceId);
  },

  /**
   * Check if SQLite is initialized
   */
  isSQLiteInitialized(databaseName?: string): boolean {
    return NativeSideFx.isSQLiteInitialized(databaseName);
  },

  /**
   * Manually trigger MMKV change check
   */
  checkMMKVChanges(): void {
    NativeSideFx.checkMMKVChanges();
  },

  /**
   * Manually trigger SQLite change check
   */
  checkSQLiteChanges(databaseName: string, table?: string): void {
    NativeSideFx.checkSQLiteChanges(databaseName, table);
  },

  /**
   * Enable/disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    NativeSideFx.setDebugMode(enabled);
  },

  /**
   * Get debug mode status
   */
  isDebugMode(): boolean {
    return NativeSideFx.isDebugMode();
  },

  /**
   * Get version
   */
  getVersion(): string {
    return NativeSideFx.getVersion();
  },

  /**
   * Internal: Called from native when a change is detected
   * @internal
   */
  _onChangeEvent(event: ChangeEvent): void {
    const callback = callbacks.get(event.listenerId);
    if (callback) {
      try {
        callback(event);
      } catch (error) {
        console.error(
          `[SAM] Error in listener callback "${event.listenerId}":`,
          error
        );
      }
    }
  },

  // ============================================================================
  // Storage Write/Read Methods
  // ============================================================================

  /**
   * Set a value in MMKV storage
   *
   * @param key The key to set
   * @param value The value to set (string, number, boolean)
   * @param instanceId Optional MMKV instance ID (default: "default")
   * @returns Result indicating success or failure
   *
   * @example
   * ```typescript
   * // Set in default MMKV instance
   * SideFx.setMMKV('user.name', 'John');
   *
   * // Set in specific MMKV instance
   * SideFx.setMMKV('settings.theme', 'dark', 'app-settings');
   * ```
   */
  setMMKV(
    key: string,
    value: string | number | boolean,
    instanceId?: string
  ): ListenerResult {
    return NativeSideFx.setMMKV(key, value, instanceId);
  },

  /**
   * Get a value from MMKV storage
   *
   * @param key The key to get
   * @param instanceId Optional MMKV instance ID (default: "default")
   * @returns The value or null if not found
   *
   * @example
   * ```typescript
   * const name = SideFx.getMMKV('user.name');
   * const theme = SideFx.getMMKV('settings.theme', 'app-settings');
   * ```
   */
  getMMKV(key: string, instanceId?: string): string | number | boolean | null {
    return NativeSideFx.getMMKV(key, instanceId);
  },

  /**
   * Delete a key from MMKV storage
   *
   * @param key The key to delete
   * @param instanceId Optional MMKV instance ID (default: "default")
   * @returns Result indicating success or failure
   */
  deleteMMKV(key: string, instanceId?: string): ListenerResult {
    return NativeSideFx.deleteMMKV(key, instanceId);
  },

  /**
   * Execute a SQL statement on SQLite storage (INSERT, UPDATE, DELETE, CREATE, etc.)
   *
   * @param sql The SQL statement to execute
   * @param params Optional parameters for the statement
   * @param databaseName Optional database name (default: "default")
   * @returns Result indicating success or failure
   *
   * @example
   * ```typescript
   * // Create table
   * SideFx.executeSQLite('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)');
   *
   * // Insert with params
   * SideFx.executeSQLite('INSERT INTO users (name) VALUES (?)', ['John']);
   *
   * // Use specific database
   * SideFx.executeSQLite('INSERT INTO orders (item) VALUES (?)', ['Widget'], 'orders-db');
   * ```
   */
  executeSQLite(
    sql: string,
    params?: Array<string | number | boolean | null>,
    databaseName?: string
  ): ListenerResult {
    return NativeSideFx.executeSQLite(sql, params, databaseName);
  },

  /**
   * Query SQLite storage and return results
   *
   * @param sql The SQL query to execute
   * @param params Optional parameters for the query
   * @param databaseName Optional database name (default: "default")
   * @returns Array of row objects or null on error
   *
   * @example
   * ```typescript
   * const users = SideFx.querySQLite<{id: number, name: string}[]>('SELECT * FROM users');
   * const user = SideFx.querySQLite('SELECT * FROM users WHERE id = ?', [1]);
   * ```
   */
  querySQLite<T = unknown>(
    sql: string,
    params?: Array<string | number | boolean | null>,
    databaseName?: string
  ): T | null {
    const result = NativeSideFx.querySQLite(sql, params, databaseName);
    if (result === null) {
      return null;
    }
    try {
      return JSON.parse(result) as T;
    } catch {
      console.error('[SAM] Failed to parse SQLite query result');
      return null;
    }
  },
};

// Register the event handler with native
// This is called by native code when changes are detected
(globalThis as unknown as Record<string, unknown>).__SAM_onChangeEvent = SideFx._onChangeEvent;
