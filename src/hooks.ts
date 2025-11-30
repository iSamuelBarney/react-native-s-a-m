/**
 * S.A.M - State Awareness Manager
 * React Hooks for warm (MMKV) and cold (SQLite) storage
 */
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { SideFx } from './SideFx';
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
  SQLiteOperation,
} from './types';

/**
 * Generate unique listener ID
 */
function generateListenerId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// ============================================================================
// useWarm - MMKV (Warm Storage) Hook
// ============================================================================

/**
 * React hook for watching MMKV (warm storage) changes
 *
 * Values are queried on-demand using get() methods, NOT stored as props.
 * The hook triggers re-renders when storage changes, then you query fresh values.
 *
 * @param config Configuration specifying MMKV instance and keys to watch
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
      mmkv: {
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

    // Auto-initialize MMKV if not already done
    if (!SideFx.isMMKVInitialized(config.id)) {
      SideFx.initializeMMKV(config.id);
    }

    const result = SideFx.addListener(
      listenerId,
      listenerConfig,
      memoizedCallback
    );
    setIsListening(result.success);

    if (!result.success) {
      console.error(`[useWarm] Failed to add listener: ${result.error}`);
    }

    return () => {
      SideFx.removeListener(listenerId);
      setIsListening(false);
    };
  }, [listenerConfig, memoizedCallback, config.id]);

  const pause = useCallback(() => {
    SideFx.pauseListener(listenerIdRef.current);
    setIsListening(false);
  }, []);

  const resume = useCallback(() => {
    SideFx.resumeListener(listenerIdRef.current);
    setIsListening(true);
  }, []);

  const refresh = useCallback(() => {
    SideFx.checkMMKVChanges();
    forceUpdate({});
  }, []);

  // Query function - gets value from MMKV on-demand
  const get = useCallback(
    (key: string): T | undefined => {
      const instanceId = config.id ?? 'default';
      const value = SideFx.getMMKV(key, instanceId);
      return value as T | undefined;
    },
    [config.id]
  );

  // Query all watched keys
  const getAll = useCallback((): Record<string, T | undefined> => {
    const result: Record<string, T | undefined> = {};
    const instanceId = config.id ?? 'default';
    for (const key of config.keys) {
      const value = SideFx.getMMKV(key, instanceId);
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
// useCold - SQLite (Cold Storage) Hook
// ============================================================================

/**
 * React hook for watching SQLite (cold storage) changes
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
    operation: SQLiteOperation | null;
    rowId: number | null;
    timestamp: number | null;
  }>({ operation: null, rowId: null, timestamp: null });

  const memoizedCallback = useCallback(
    (event: ChangeEvent) => {
      setLastChange({
        operation: event.operation as SQLiteOperation,
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
          operation: event.operation as SQLiteOperation,
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
      sqlite: {
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
    const dbName = config.database ?? 'default';

    if (!SideFx.isSQLiteInitialized(dbName)) {
      console.warn(
        `[useCold] Database "${dbName}" not initialized. Call SideFx.initializeSQLite() first.`
      );
      return;
    }

    const result = SideFx.addListener(
      listenerId,
      listenerConfig,
      memoizedCallback
    );
    setIsListening(result.success);

    if (!result.success) {
      console.error(`[useCold] Failed to add listener: ${result.error}`);
    }

    return () => {
      SideFx.removeListener(listenerId);
      setIsListening(false);
    };
  }, [listenerConfig, memoizedCallback, config.database]);

  const pause = useCallback(() => {
    SideFx.pauseListener(listenerIdRef.current);
    setIsListening(false);
  }, []);

  const resume = useCallback(() => {
    SideFx.resumeListener(listenerIdRef.current);
    setIsListening(true);
  }, []);

  const refresh = useCallback(() => {
    SideFx.checkSQLiteChanges(config.database ?? 'default', config.table);
    forceUpdate({});
  }, [config.database, config.table]);

  // Query function - queries SQLite on-demand
  const query = useCallback((): T | null => {
    const dbName = config.database ?? 'default';

    // If a custom query is provided, use it
    if (config.query) {
      return SideFx.querySQLite<T>(
        config.query,
        config.queryParams,
        dbName
      );
    }

    // Otherwise, build a SELECT query from table config
    if (config.table) {
      const columns = config.columns?.join(', ') ?? '*';
      let sql = `SELECT ${columns} FROM ${config.table}`;

      if (config.where) {
        sql += ` WHERE ${config.where}`;
      }

      return SideFx.querySQLite<T>(sql, config.queryParams, dbName);
    }

    return null;
  }, [config.database, config.query, config.queryParams, config.table, config.columns, config.where]);

  // Query with override params
  const queryWith = useCallback(
    (params?: Array<string | number | boolean | null>): T | null => {
      const dbName = config.database ?? 'default';

      if (config.query) {
        return SideFx.querySQLite<T>(config.query, params, dbName);
      }

      if (config.table) {
        const columns = config.columns?.join(', ') ?? '*';
        let sql = `SELECT ${columns} FROM ${config.table}`;

        if (config.where) {
          sql += ` WHERE ${config.where}`;
        }

        return SideFx.querySQLite<T>(sql, params, dbName);
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
 * React hook for watching both warm (MMKV) and cold (SQLite) storage
 *
 * Supports correlation between warm and cold storage (e.g., use MMKV user ID
 * as a parameter in SQLite query).
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
        mmkv: config.warm
          ? {
              keys: config.warm.keys,
              patterns: config.warm.patterns,
              conditions: config.warm.conditions,
              instanceId: config.warm.id ?? 'default',
            }
          : undefined,
        sqlite: config.cold
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
              mmkvKey: config.correlation.warmKey,
              sqliteParam: config.correlation.coldParam,
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

    // Initialize storage adapters if needed
    if (config.warm && !SideFx.isMMKVInitialized(config.warm.id)) {
      SideFx.initializeMMKV(config.warm.id);
    }

    const result = SideFx.addListener(
      listenerId,
      listenerConfig,
      memoizedCallback
    );
    setIsListening(result.success);

    if (!result.success) {
      console.error(`[useStorage] Failed to add listener: ${result.error}`);
    }

    return () => {
      SideFx.removeListener(listenerId);
      setIsListening(false);
    };
  }, [listenerConfig, memoizedCallback, config.warm]);

  const pause = useCallback(() => {
    SideFx.pauseListener(listenerIdRef.current);
    setIsListening(false);
  }, []);

  const resume = useCallback(() => {
    SideFx.resumeListener(listenerIdRef.current);
    setIsListening(true);
  }, []);

  const refresh = useCallback(() => {
    SideFx.checkMMKVChanges();
    if (config.cold?.database) {
      SideFx.checkSQLiteChanges(config.cold.database, config.cold.table);
    }
    forceUpdate({});
  }, [config.cold?.database, config.cold?.table]);

  // Query warm storage value
  const getWarm = useCallback((key: string): TWarm | undefined => {
    const instanceId = config.warm?.id ?? 'default';
    const value = SideFx.getMMKV(key, instanceId);
    return value as TWarm | undefined;
  }, [config.warm?.id]);

  // Query cold storage data
  const queryCold = useCallback((): TCold | null => {
    if (!config.cold) return null;

    const dbName = config.cold.database ?? 'default';

    if (config.cold.query) {
      return SideFx.querySQLite<TCold>(
        config.cold.query,
        config.cold.queryParams,
        dbName
      );
    }

    if (config.cold.table) {
      const columns = config.cold.columns?.join(', ') ?? '*';
      const sql = `SELECT ${columns} FROM ${config.cold.table}`;
      return SideFx.querySQLite<TCold>(sql, config.cold.queryParams, dbName);
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
