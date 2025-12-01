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
  NetworkState,
} from './specs/SideFx.nitro';

/**
 * Callback function type for listeners
 */
export type ListenerCallback = (event: ChangeEvent) => void;

// Get the native hybrid object directly
const NativeSideFx = NitroModules.createHybridObject<SideFxSpec>('SideFx');

// Store callbacks in JS (native stores config, JS stores callbacks)
const callbacks = new Map<string, ListenerCallback>();

// Track if default instances have been auto-initialized
let defaultWarmInitialized = false;
let defaultColdInitialized = false;

// Default Cold storage database name (unique to S.A.M)
export const DEFAULT_COLD_DB_NAME = 'sam_default';

/**
 * Safely ensure the default Warm instance is initialized.
 * This handles the case where react-native-mmkv may have already initialized MMKV.
 * @internal
 */
function ensureDefaultWarmInitialized(): void {
  if (defaultWarmInitialized) {
    return;
  }

  try {
    // Check if already initialized (e.g., by react-native-mmkv)
    if (NativeSideFx.isWarmInitialized('default')) {
      defaultWarmInitialized = true;
      return;
    }

    // Try to initialize the default instance
    const result = NativeSideFx.initializeWarm('default');
    if (result.success) {
      defaultWarmInitialized = true;
    }
  } catch {
    // Initialization failed - this is fine if another library handles it
    // or if we're on a platform where MMKV isn't available
  }
}

/**
 * Safely ensure the default Cold storage database is initialized.
 * Creates a SQLite database at the default path using S.A.M's unique database name.
 * @internal
 */
function ensureDefaultColdInitialized(): void {
  if (defaultColdInitialized) {
    return;
  }

  try {
    // Check if already initialized
    if (NativeSideFx.isColdInitialized(DEFAULT_COLD_DB_NAME)) {
      defaultColdInitialized = true;
      return;
    }

    // Get the default path from native (will be in app's documents/data directory)
    // Use the Warm path as a base since it's in a similar location
    const warmPath = NativeSideFx.getDefaultWarmPath();
    // Replace 'mmkv' with 'sam_db' for SQLite storage
    const coldPath = warmPath.replace(/mmkv\/?$/, 'sam_db');
    const dbPath = `${coldPath}/${DEFAULT_COLD_DB_NAME}.db`;

    // Try to initialize the default database
    const result = NativeSideFx.initializeCold(DEFAULT_COLD_DB_NAME, dbPath);
    if (result.success) {
      defaultColdInitialized = true;
    }
  } catch {
    // Initialization failed - Cold storage won't be available until manually initialized
  }
}

/**
 * High-level TypeScript API for Air (S.A.M)
 * Provides reactive listeners for Warm and Cold storage changes
 */
export const Air = {
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
   * Air.addListener(
   *   'user-name-listener',
   *   {
   *     warm: {
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
   * Get the default Warm root path for this platform
   * - iOS: Library/mmkv
   * - Android: files/mmkv (must be set via setWarmRootPath first on Android)
   */
  getDefaultWarmPath(): string {
    return NativeSideFx.getDefaultWarmPath();
  },

  /**
   * Set the root directory for Warm storage
   * Optional on iOS (auto-detected), required on Android
   *
   * @param rootPath The directory path for Warm storage files
   *
   * @example
   * ```typescript
   * // On Android, you need to set this before initializing Warm:
   * import { Platform } from 'react-native';
   * if (Platform.OS === 'android') {
   *   // Get path from your file system library or native module
   *   Air.setWarmRootPath('/data/data/com.yourapp/files/mmkv');
   * }
   * ```
   */
  setWarmRootPath(rootPath: string): void {
    NativeSideFx.setWarmRootPath(rootPath);
  },

  /**
   * Initialize Warm adapter
   * On iOS, automatically uses Library/mmkv
   * On Android, call setWarmRootPath first
   */
  initializeWarm(instanceId?: string): ListenerResult {
    return NativeSideFx.initializeWarm(instanceId);
  },

  /**
   * Initialize Cold storage adapter
   * Call this after opening your database
   */
  initializeCold(databaseName: string, databasePath: string): ListenerResult {
    return NativeSideFx.initializeCold(databaseName, databasePath);
  },

  /**
   * Check if Warm is initialized
   */
  isWarmInitialized(instanceId?: string): boolean {
    return NativeSideFx.isWarmInitialized(instanceId);
  },

  /**
   * Check if Cold storage is initialized
   * @param databaseName Database name to check (default: "sam_default")
   */
  isColdInitialized(databaseName?: string): boolean {
    const dbName = databaseName ?? DEFAULT_COLD_DB_NAME;
    return NativeSideFx.isColdInitialized(dbName);
  },

  /**
   * Manually trigger Warm change check
   */
  checkWarmChanges(): void {
    NativeSideFx.checkWarmChanges();
  },

  /**
   * Manually trigger Cold storage change check
   * @param databaseName Database to check (default: "sam_default")
   * @param table Optional specific table to check
   */
  checkColdChanges(databaseName?: string, table?: string): void {
    const dbName = databaseName ?? DEFAULT_COLD_DB_NAME;
    NativeSideFx.checkColdChanges(dbName, table);
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
   * Set a value in Warm storage
   *
   * @param key The key to set
   * @param value The value to set (string, number, boolean)
   * @param instanceId Optional Warm instance ID (default: "default")
   * @returns Result indicating success or failure
   *
   * @example
   * ```typescript
   * // Set in default Warm instance
   * Air.setWarm('user.name', 'John');
   *
   * // Set in specific Warm instance
   * Air.setWarm('settings.theme', 'dark', 'app-settings');
   * ```
   */
  setWarm(
    key: string,
    value: string | number | boolean,
    instanceId?: string
  ): ListenerResult {
    // Auto-initialize default instance if needed
    if (!instanceId || instanceId === 'default') {
      ensureDefaultWarmInitialized();
    }
    return NativeSideFx.setWarm(key, value, instanceId);
  },

  /**
   * Get a value from Warm storage
   *
   * @param key The key to get
   * @param instanceId Optional Warm instance ID (default: "default")
   * @returns The value or null if not found
   *
   * @example
   * ```typescript
   * const name = Air.getWarm('user.name');
   * const theme = Air.getWarm('settings.theme', 'app-settings');
   * ```
   */
  getWarm(key: string, instanceId?: string): string | number | boolean | null {
    // Auto-initialize default instance if needed
    if (!instanceId || instanceId === 'default') {
      ensureDefaultWarmInitialized();
    }
    return NativeSideFx.getWarm(key, instanceId);
  },

  /**
   * Delete a key from Warm storage
   *
   * @param key The key to delete
   * @param instanceId Optional Warm instance ID (default: "default")
   * @returns Result indicating success or failure
   */
  deleteWarm(key: string, instanceId?: string): ListenerResult {
    // Auto-initialize default instance if needed
    if (!instanceId || instanceId === 'default') {
      ensureDefaultWarmInitialized();
    }
    return NativeSideFx.deleteWarm(key, instanceId);
  },

  /**
   * Execute a SQL statement on Cold storage (INSERT, UPDATE, DELETE, CREATE, etc.)
   *
   * @param sql The SQL statement to execute
   * @param params Optional parameters for the statement
   * @param databaseName Optional database name (default: "sam_default")
   * @returns Result indicating success or failure
   *
   * @example
   * ```typescript
   * // Create table (uses auto-initialized default database)
   * Air.executeCold('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)');
   *
   * // Insert with params
   * Air.executeCold('INSERT INTO users (name) VALUES (?)', ['John']);
   *
   * // Use specific database
   * Air.executeCold('INSERT INTO orders (item) VALUES (?)', ['Widget'], 'orders-db');
   * ```
   */
  executeCold(
    sql: string,
    params?: Array<string | number | boolean | null>,
    databaseName?: string
  ): ListenerResult {
    // Auto-initialize default Cold database if needed
    if (!databaseName || databaseName === DEFAULT_COLD_DB_NAME) {
      ensureDefaultColdInitialized();
      return NativeSideFx.executeCold(sql, params, DEFAULT_COLD_DB_NAME);
    }
    return NativeSideFx.executeCold(sql, params, databaseName);
  },

  /**
   * Query Cold storage and return results
   *
   * @param sql The SQL query to execute
   * @param params Optional parameters for the query
   * @param databaseName Optional database name (default: "sam_default")
   * @returns Array of row objects or null on error
   *
   * @example
   * ```typescript
   * // Query from auto-initialized default database
   * const users = Air.queryCold<{id: number, name: string}[]>('SELECT * FROM users');
   * const user = Air.queryCold('SELECT * FROM users WHERE id = ?', [1]);
   * ```
   */
  queryCold<T = unknown>(
    sql: string,
    params?: Array<string | number | boolean | null>,
    databaseName?: string
  ): T | null {
    // Auto-initialize default Cold database if needed
    const dbName = (!databaseName || databaseName === DEFAULT_COLD_DB_NAME)
      ? (ensureDefaultColdInitialized(), DEFAULT_COLD_DB_NAME)
      : databaseName;

    const result = NativeSideFx.queryCold(sql, params, dbName);
    if (result === null) {
      return null;
    }
    try {
      return JSON.parse(result) as T;
    } catch {
      console.error('[SAM] Failed to parse Cold storage query result');
      return null;
    }
  },

  // ============================================================================
  // Network Monitoring Methods
  // ============================================================================

  /**
   * Start monitoring network status changes.
   * Network state will be automatically stored in Warm storage at:
   * - NETWORK_STATUS: "online" | "offline" | "unknown"
   * - NETWORK_TYPE: "wifi" | "cellular" | "ethernet" | "none" | "unknown"
   * - NETWORK_QUALITY: "strong" | "medium" | "weak" | "offline" | "unknown"
   * - IS_CONNECTED: boolean
   * - CELLULAR_GENERATION: "2g" | "3g" | "4g" | "5g" | "unknown" (when on cellular)
   *
   * Use `useWarm` hook with keys like ['NETWORK_STATUS'] to subscribe to changes.
   *
   * @returns Result indicating success or failure
   *
   * @example
   * ```typescript
   * // Start monitoring
   * Air.startNetworkMonitoring();
   *
   * // Subscribe to network status changes
   * useWarm({
   *   keys: ['NETWORK_STATUS', 'NETWORK_QUALITY'],
   *   instanceId: 'sam-network'
   * }, (event) => {
   *   console.log('Network changed:', event.key, event.newValue);
   * });
   * ```
   */
  startNetworkMonitoring(): ListenerResult {
    return NativeSideFx.startNetworkMonitoring();
  },

  /**
   * Stop monitoring network status changes
   * @returns Result indicating success or failure
   */
  stopNetworkMonitoring(): ListenerResult {
    return NativeSideFx.stopNetworkMonitoring();
  },

  /**
   * Check if network monitoring is currently active
   * @returns True if monitoring is active
   */
  isNetworkMonitoringActive(): boolean {
    return NativeSideFx.isNetworkMonitoringActive();
  },

  /**
   * Get the current network state
   * @returns Current network state information
   */
  getNetworkState(): NetworkState {
    return NativeSideFx.getNetworkState();
  },

  /**
   * Force a refresh of the network state
   * Useful for getting the latest state on demand
   */
  refreshNetworkState(): void {
    NativeSideFx.refreshNetworkState();
  },

  /**
   * Enable or disable active ping mode for internet quality measurement.
   *
   * **Active mode (debug/simulator):** Periodically pings external endpoints
   * (Google, Apple) to measure latency. Useful for testing with Network Link Conditioner.
   *
   * **Passive mode (production default):** Relies on the app to report
   * network latency via `reportNetworkLatency()` from actual API calls.
   * This avoids unnecessary network requests, battery drain, and privacy concerns.
   *
   * @param enabled True to enable active pinging, false for passive mode (default)
   *
   * @example
   * ```typescript
   * // In development/debug builds:
   * if (__DEV__) {
   *   Air.setActivePingMode(true);
   * }
   *
   * // In production, use passive mode (default) and report from your API layer
   * ```
   */
  setActivePingMode(enabled: boolean): void {
    NativeSideFx.setActivePingMode(enabled);
  },

  /**
   * Report observed network latency from app's own network calls.
   *
   * Call this from your networking layer (fetch interceptor, Axios interceptor, etc.)
   * to update internet quality based on actual app traffic.
   *
   * In passive mode (production), this is the primary way to measure internet quality.
   * In active mode, this supplements the periodic pings with real-world data.
   *
   * @param latencyMs The observed latency in milliseconds
   *
   * @example
   * ```typescript
   * // Example with fetch interceptor
   * const originalFetch = fetch;
   * globalThis.fetch = async (input, init) => {
   *   const startTime = Date.now();
   *   const response = await originalFetch(input, init);
   *   const latency = Date.now() - startTime;
   *   Air.reportNetworkLatency(latency);
   *   return response;
   * };
   *
   * // Example with Axios interceptor
   * axios.interceptors.response.use((response) => {
   *   if (response.config.metadata?.startTime) {
   *     const latency = Date.now() - response.config.metadata.startTime;
   *     Air.reportNetworkLatency(latency);
   *   }
   *   return response;
   * });
   * ```
   */
  reportNetworkLatency(latencyMs: number): void {
    NativeSideFx.reportNetworkLatency(latencyMs);
  },

  /**
   * Report a network failure from app's own network calls.
   *
   * Call this when a network request fails due to connectivity issues.
   * This sets INTERNET_REACHABLE to false and triggers offline recovery checks
   * (pinging every 30 seconds until internet is available again).
   *
   * @example
   * ```typescript
   * // Example with fetch interceptor
   * const originalFetch = fetch;
   * globalThis.fetch = async (input, init) => {
   *   try {
   *     const startTime = Date.now();
   *     const response = await originalFetch(input, init);
   *     const latency = Date.now() - startTime;
   *     Air.reportNetworkLatency(latency);
   *     return response;
   *   } catch (error) {
   *     // Check if it's a network error
   *     if (error instanceof TypeError && error.message.includes('Network')) {
   *       Air.reportNetworkFailure();
   *     }
   *     throw error;
   *   }
   * };
   * ```
   */
  reportNetworkFailure(): void {
    NativeSideFx.reportNetworkFailure();
  },

  /**
   * Set custom endpoints for active ping mode.
   *
   * By default, S.A.M pings Google and Apple connectivity check endpoints.
   * Use this to specify your own endpoints (e.g., your API server health endpoint).
   *
   * Requirements for custom endpoints:
   * - Should respond quickly (< 1s ideally)
   * - Should be reliable and always available
   * - Should support HEAD requests
   * - Should return any 2xx status on success
   *
   * @param endpoints Array of URLs to ping. Empty array resets to defaults.
   *
   * @example
   * ```typescript
   * // Use your own API health endpoint
   * Air.setPingEndpoints([
   *   'https://api.myapp.com/health',
   *   'https://api-backup.myapp.com/health',
   * ]);
   *
   * // Reset to default endpoints (Google, Apple)
   * Air.setPingEndpoints([]);
   * ```
   */
  setPingEndpoints(endpoints: string[]): void {
    NativeSideFx.setPingEndpoints(endpoints);
  },

  /**
   * Network Warm storage instance ID
   * Use this when subscribing to network state changes via useWarm
   */
  NETWORK_INSTANCE_ID: 'sam-network' as const,

  /**
   * Network Warm storage keys
   *
   * **IMPORTANT**: Use `INTERNET_STATE` as the primary key for UI display,
   * similar to how `APP_STATE` is used for app lifecycle.
   */
  NETWORK_KEYS: {
    /**
     * INTERNET_STATE - Simple internet state similar to APP_STATE.
     * Values: "offline" | "online" | "online-weak"
     *
     * Use this as the primary indicator for:
     * - Showing offline banners
     * - Deciding whether to attempt network calls
     * - Displaying connection quality warnings
     *
     * "offline" = No internet connectivity
     * "online" = Good internet connectivity
     * "online-weak" = Connected but slow/poor quality (latency > 300ms)
     */
    INTERNET_STATE: 'INTERNET_STATE',
    /** Network status: "online" | "offline" | "unknown" */
    STATUS: 'NETWORK_STATUS',
    /** Connection type: "wifi" | "cellular" | "ethernet" | "none" | "unknown" */
    TYPE: 'NETWORK_TYPE',
    /** Combined quality (network + internet): "strong" | "medium" | "weak" | "offline" | "unknown" */
    QUALITY: 'NETWORK_QUALITY',
    /** Whether device has network connection (hardware level) */
    IS_CONNECTED: 'IS_CONNECTED',
    /** Cellular generation when on cellular: "2g" | "3g" | "4g" | "5g" | "unknown" */
    CELLULAR_GENERATION: 'CELLULAR_GENERATION',
    /** Internet quality based on latency: "excellent" | "good" | "fair" | "poor" | "offline" | "unknown" */
    INTERNET_QUALITY: 'INTERNET_QUALITY',
    /** Internet latency in milliseconds (-1 if unknown/offline) */
    INTERNET_LATENCY_MS: 'INTERNET_LATENCY_MS',
    /**
     * Boolean for internet reachability (true/false).
     * Use INTERNET_STATE for more granular state.
     */
    INTERNET_REACHABLE: 'INTERNET_REACHABLE',
  } as const,
};

// Register the event handler with native
// This is called by native code when changes are detected
(globalThis as unknown as Record<string, unknown>).__SAM_onChangeEvent = Air._onChangeEvent;

// Export SideFx as an alias for backwards compatibility
export const SideFx = Air;
