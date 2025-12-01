/**
 * S.A.M - State Awareness Manager
 * React Hooks for warm and cold storage
 */
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Air } from './SideFx';
import type {
  UseWarmConfig,
  UseWarmResult,
  WarmChangeEvent,
  UseColdConfig,
  UseColdResult,
  ColdChangeEvent,
  UseStorageConfig,
  UseStorageResult,
  ChangeEvent,
  ColdOperation,
} from './types';

/**
 * Generate unique listener ID
 */
function generateListenerId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// ============================================================================
// useWarm - Warm Storage Hook
// ============================================================================

/**
 * React hook for watching warm storage changes
 *
 * Values are queried on-demand using get() methods, NOT stored as props.
 * The hook triggers re-renders when storage changes, then you query fresh values.
 *
 * @param config Configuration specifying Warm instance and keys to watch
 * @param callback Optional callback fired on changes
 * @returns Object with query methods and control functions
 *
 * @example
 * ```typescript
 * // Watch specific keys
 * const { get, getAll } = useWarm({
 *   id: 'default',
 *   keys: ['user.name', 'user.email', 'user.avatar']
 * });
 *
 * // Query values on-demand (NOT stored as props)
 * <Text>{get('user.name') ?? 'Guest'}</Text>
 *
 * // With callback for side effects
 * useWarm(
 *   { keys: ['auth.token'] },
 *   (event) => {
 *     if (event.operation === 'delete') {
 *       navigation.navigate('Login');
 *     }
 *   }
 * );
 * ```
 */
export function useWarm<T = unknown>(
  config: UseWarmConfig,
  callback?: (event: WarmChangeEvent) => void
): UseWarmResult<T> {
  // Store listener ID in ref - persists across renders
  const listenerIdRef = useRef<string>(generateListenerId('warm'));

  // Trigger re-render on changes (but don't store values)
  const [, forceUpdate] = useState({});
  const [isListening, setIsListening] = useState(false);

  // Memoized callback that triggers re-render and calls user callback
  const memoizedCallback = useCallback(
    (event: ChangeEvent) => {
      // Trigger re-render so component can query fresh values
      forceUpdate({});

      // Call user callback if provided
      if (callback) {
        callback({
          listenerId: event.listenerId,
          source: 'warm',
          key: event.key ?? '',
          operation: event.operation as 'set' | 'delete',
          oldValue: event.oldValue,
          newValue: event.newValue,
          timestamp: event.timestamp,
        });
      }
    },
    [callback]
  );

  // Memoize listener config to avoid unnecessary re-registrations
  const listenerConfig = useMemo(
    () => ({
      warm: {
        keys: config.keys,
        patterns: config.patterns,
        conditions: config.conditions,
        instanceId: config.id ?? 'default',
      },
      options: {
        ...config.options,
        fireImmediately: config.options?.fireImmediately ?? true,
      },
    }),
    [
      config.keys,
      config.patterns,
      config.conditions,
      config.id,
      config.options,
    ]
  );

  useEffect(() => {
    const listenerId = listenerIdRef.current;
    const instanceId = config.id ?? 'default';

    // Only initialize non-default instances explicitly
    // Default instance is auto-initialized lazily by Air
    if (instanceId !== 'default' && !Air.isWarmInitialized(instanceId)) {
      Air.initializeWarm(instanceId);
    }

    const result = Air.addListener(
      listenerId,
      listenerConfig,
      memoizedCallback
    );
    setIsListening(result.success);

    if (!result.success) {
      console.error(`[useWarm] Failed to add listener: ${result.error}`);
    }

    return () => {
      Air.removeListener(listenerId);
      setIsListening(false);
    };
  }, [listenerConfig, memoizedCallback, config.id]);

  const pause = useCallback(() => {
    Air.pauseListener(listenerIdRef.current);
    setIsListening(false);
  }, []);

  const resume = useCallback(() => {
    Air.resumeListener(listenerIdRef.current);
    setIsListening(true);
  }, []);

  const refresh = useCallback(() => {
    Air.checkWarmChanges();
    forceUpdate({});
  }, []);

  // Query function - gets value from Warm on-demand
  const get = useCallback(
    (key: string): T | undefined => {
      const instanceId = config.id ?? 'default';
      const value = Air.getWarm(key, instanceId);
      return value as T | undefined;
    },
    [config.id]
  );

  // Query all watched keys
  const getAll = useCallback((): Record<string, T | undefined> => {
    const result: Record<string, T | undefined> = {};
    const instanceId = config.id ?? 'default';
    for (const key of config.keys) {
      const value = Air.getWarm(key, instanceId);
      result[key] = value as T | undefined;
    }
    return result;
  }, [config.keys, config.id]);

  return {
    get,
    getAll,
    isListening,
    listenerId: listenerIdRef.current,
    pause,
    resume,
    refresh,
  };
}

// ============================================================================
// useCold - Cold Storage Hook
// ============================================================================

/**
 * React hook for watching cold storage changes
 *
 * Data is queried on-demand using query() methods, NOT stored as props.
 * The hook triggers re-renders when storage changes, then you query fresh data.
 *
 * @param config Configuration specifying database and table/query to watch
 * @param callback Optional callback fired on changes
 * @returns Object with query methods and control functions
 *
 * @example
 * ```typescript
 * // Watch a table
 * const { query, lastChange } = useCold({
 *   table: 'users',
 *   operations: ['INSERT', 'UPDATE']
 * });
 * const users = query(); // Query on-demand
 *
 * // Watch a query
 * const { query } = useCold({
 *   query: 'SELECT * FROM orders WHERE status = ?',
 *   queryParams: ['pending']
 * });
 * const orders = query(); // NOT stored as prop
 *
 * // With callback
 * useCold(
 *   { table: 'notifications', operations: ['INSERT'] },
 *   (event) => showPushNotification(event.row)
 * );
 * ```
 */
export function useCold<T = unknown>(
  config: UseColdConfig,
  callback?: (event: ColdChangeEvent) => void
): UseColdResult<T> {
  const listenerIdRef = useRef<string>(generateListenerId('cold'));

  // Trigger re-render on changes (but don't store data)
  const [, forceUpdate] = useState({});
  const [isListening, setIsListening] = useState(false);
  const [lastChange, setLastChange] = useState<{
    operation: ColdOperation | null;
    rowId: number | null;
    timestamp: number | null;
  }>({ operation: null, rowId: null, timestamp: null });

  const memoizedCallback = useCallback(
    (event: ChangeEvent) => {
      setLastChange({
        operation: event.operation as ColdOperation,
        rowId: event.rowId ?? null,
        timestamp: event.timestamp,
      });

      // Trigger re-render so component can query fresh data
      forceUpdate({});

      if (callback) {
        callback({
          listenerId: event.listenerId,
          source: 'cold',
          table: event.table ?? '',
          operation: event.operation as ColdOperation,
          rowId: event.rowId ?? 0,
          row: event.row,
          timestamp: event.timestamp,
        });
      }
    },
    [callback]
  );

  const listenerConfig = useMemo(
    () => ({
      cold: {
        table: config.table,
        columns: config.columns,
        operations: config.operations,
        where: config.where,
        query: config.query,
        queryParams: config.queryParams?.map((p) =>
          typeof p === 'boolean' ? (p ? 1 : 0) : p
        ),
        databaseName: config.database ?? 'default',
      },
      options: {
        ...config.options,
        fireImmediately: config.options?.fireImmediately ?? true,
      },
    }),
    [
      config.table,
      config.columns,
      config.operations,
      config.where,
      config.query,
      config.queryParams,
      config.database,
      config.options,
    ]
  );

  useEffect(() => {
    const listenerId = listenerIdRef.current;

    // Non-default databases still need explicit initialization
    // Default database (sam_default) auto-initializes via Air methods
    if (config.database && !Air.isColdInitialized(config.database)) {
      console.warn(
        `[useCold] Database "${config.database}" not initialized. Call Air.initializeCold() first.`
      );
      return;
    }

    const result = Air.addListener(
      listenerId,
      listenerConfig,
      memoizedCallback
    );
    setIsListening(result.success);

    if (!result.success) {
      console.error(`[useCold] Failed to add listener: ${result.error}`);
    }

    return () => {
      Air.removeListener(listenerId);
      setIsListening(false);
    };
  }, [listenerConfig, memoizedCallback, config.database]);

  const pause = useCallback(() => {
    Air.pauseListener(listenerIdRef.current);
    setIsListening(false);
  }, []);

  const resume = useCallback(() => {
    Air.resumeListener(listenerIdRef.current);
    setIsListening(true);
  }, []);

  const refresh = useCallback(() => {
    // Air.checkColdChanges auto-uses default database if none specified
    Air.checkColdChanges(config.database, config.table);
    forceUpdate({});
  }, [config.database, config.table]);

  // Query function - queries Cold storage on-demand
  // Air.queryCold auto-initializes default database if none specified
  const query = useCallback((): T | null => {
    // If a custom query is provided, use it
    if (config.query) {
      return Air.queryCold<T>(
        config.query,
        config.queryParams,
        config.database
      );
    }

    // Otherwise, build a SELECT query from table config
    if (config.table) {
      const columns = config.columns?.join(', ') ?? '*';
      let sql = `SELECT ${columns} FROM ${config.table}`;

      if (config.where) {
        sql += ` WHERE ${config.where}`;
      }

      return Air.queryCold<T>(sql, config.queryParams, config.database);
    }

    return null;
  }, [config.database, config.query, config.queryParams, config.table, config.columns, config.where]);

  // Query with override params
  const queryWith = useCallback(
    (params?: Array<string | number | boolean | null>): T | null => {
      if (config.query) {
        return Air.queryCold<T>(config.query, params, config.database);
      }

      if (config.table) {
        const columns = config.columns?.join(', ') ?? '*';
        let sql = `SELECT ${columns} FROM ${config.table}`;

        if (config.where) {
          sql += ` WHERE ${config.where}`;
        }

        return Air.queryCold<T>(sql, params, config.database);
      }

      return null;
    },
    [config.database, config.query, config.table, config.columns, config.where]
  );

  return {
    query,
    queryWith,
    isListening,
    listenerId: listenerIdRef.current,
    lastChange,
    pause,
    resume,
    refresh,
  };
}

// ============================================================================
// useStorage - Combined Warm + Cold Hook
// ============================================================================

/**
 * React hook for watching both warm and cold storage
 *
 * Supports correlation between warm and cold storage (e.g., use warm user ID
 * as a parameter in cold storage query).
 *
 * @param config Configuration for both storage types
 * @param callback Optional callback fired on any change
 * @returns Object with query methods for both storage types
 *
 * @example
 * ```typescript
 * // Watch current user's orders (correlated)
 * const { getWarm, queryCold } = useStorage<string, Order[]>({
 *   warm: { keys: ['auth.userId'] },
 *   cold: { query: 'SELECT * FROM orders WHERE user_id = ?' },
 *   correlation: { warmKey: 'auth.userId', coldParam: 'user_id' },
 * });
 * const userId = getWarm('auth.userId');  // Query on-demand
 * const orders = queryCold();              // NOT stored as props
 * ```
 */
export function useStorage<TWarm = unknown, TCold = unknown>(
  config: UseStorageConfig,
  callback?: (event: ChangeEvent) => void
): UseStorageResult<TWarm, TCold> {
  const listenerIdRef = useRef<string>(generateListenerId('storage'));

  const [, forceUpdate] = useState({});
  const [lastSource, setLastSource] = useState<'warm' | 'cold' | null>(null);
  const [isListening, setIsListening] = useState(false);

  const memoizedCallback = useCallback(
    (event: ChangeEvent) => {
      // Determine source based on event properties
      const source =
        event.source === 'mmkv' || event.source === 'warm' ? 'warm' : 'cold';
      setLastSource(source);

      // Trigger re-render
      forceUpdate({});

      callback?.(event);
    },
    [callback]
  );

  const listenerConfig = useMemo(
    () => ({
      combined: {
        warm: config.warm
          ? {
              keys: config.warm.keys,
              patterns: config.warm.patterns,
              conditions: config.warm.conditions,
              instanceId: config.warm.id ?? 'default',
            }
          : undefined,
        cold: config.cold
          ? {
              table: config.cold.table,
              columns: config.cold.columns,
              operations: config.cold.operations,
              query: config.cold.query,
              queryParams: config.cold.queryParams?.map((p) =>
                typeof p === 'boolean' ? (p ? 1 : 0) : p
              ),
              databaseName: config.cold.database ?? 'default',
            }
          : undefined,
        logic: config.logic ?? 'OR',
        correlation: config.correlation
          ? {
              warmKey: config.correlation.warmKey,
              coldParam: config.correlation.coldParam,
            }
          : undefined,
      },
      options: {
        ...config.options,
        fireImmediately: config.options?.fireImmediately ?? true,
      },
    }),
    [config]
  );

  useEffect(() => {
    const listenerId = listenerIdRef.current;
    const warmInstanceId = config.warm?.id ?? 'default';

    // Only initialize non-default Warm instances explicitly
    // Default instance is auto-initialized lazily by Air
    if (config.warm && warmInstanceId !== 'default' && !Air.isWarmInitialized(warmInstanceId)) {
      Air.initializeWarm(warmInstanceId);
    }

    const result = Air.addListener(
      listenerId,
      listenerConfig,
      memoizedCallback
    );
    setIsListening(result.success);

    if (!result.success) {
      console.error(`[useStorage] Failed to add listener: ${result.error}`);
    }

    return () => {
      Air.removeListener(listenerId);
      setIsListening(false);
    };
  }, [listenerConfig, memoizedCallback, config.warm]);

  const pause = useCallback(() => {
    Air.pauseListener(listenerIdRef.current);
    setIsListening(false);
  }, []);

  const resume = useCallback(() => {
    Air.resumeListener(listenerIdRef.current);
    setIsListening(true);
  }, []);

  const refresh = useCallback(() => {
    Air.checkWarmChanges();
    // Air.checkColdChanges auto-uses default database if none specified
    if (config.cold) {
      Air.checkColdChanges(config.cold.database, config.cold.table);
    }
    forceUpdate({});
  }, [config.cold?.database, config.cold?.table]);

  // Query warm storage value
  const getWarm = useCallback((key: string): TWarm | undefined => {
    const instanceId = config.warm?.id ?? 'default';
    const value = Air.getWarm(key, instanceId);
    return value as TWarm | undefined;
  }, [config.warm?.id]);

  // Query cold storage data
  // Air.queryCold auto-initializes default database if none specified
  const queryCold = useCallback((): TCold | null => {
    if (!config.cold) return null;

    if (config.cold.query) {
      return Air.queryCold<TCold>(
        config.cold.query,
        config.cold.queryParams,
        config.cold.database
      );
    }

    if (config.cold.table) {
      const columns = config.cold.columns?.join(', ') ?? '*';
      const sql = `SELECT ${columns} FROM ${config.cold.table}`;
      return Air.queryCold<TCold>(sql, config.cold.queryParams, config.cold.database);
    }

    return null;
  }, [config.cold]);

  return {
    getWarm,
    queryCold,
    lastSource,
    isListening,
    listenerId: listenerIdRef.current,
    pause,
    resume,
    refresh,
  };
}
