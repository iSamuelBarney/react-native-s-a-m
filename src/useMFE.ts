/**
 * S.A.M - React hooks for MFE state tracking
 *
 * These hooks are for OBSERVING MFE state, not for tracking component lifecycle.
 * MFE loading/fetching should be tracked at the module federation layer.
 */
import { useCallback, useState, useEffect } from 'react';
import { useWarm } from './hooks';
import {
  MFERegistry,
  MFE_INSTANCE_ID,
  MFE_KEY_PREFIX,
  getMFEState,
  getMFEMetadata,
  addFallbackListener,
  type MFEState,
  type MFEMetadata,
} from './mfe';

/**
 * Hook to watch the state of a single MFE
 *
 * @param mfeId The MFE identifier to watch
 * @returns Current state and metadata
 *
 * @example
 * ```tsx
 * function MFEStatus({ mfeId }) {
 *   const { state, metadata, isLoading, isMounted } = useMFEState('demoHome');
 *   return <Text>{state}</Text>;
 * }
 * ```
 */
export function useMFEState(mfeId: string): {
  state: MFEState;
  metadata: MFEMetadata | null;
  isLoading: boolean;
  isLoaded: boolean;
  isMounted: boolean;
  isError: boolean;
} {
  const [state, setState] = useState<MFEState>(() => getMFEState(mfeId));
  const [metadata, setMetadata] = useState<MFEMetadata | null>(() =>
    getMFEMetadata(mfeId)
  );

  const watchKeys = [`${MFE_KEY_PREFIX}${mfeId}`, `${MFE_KEY_PREFIX}${mfeId}.meta`];

  // Watch for changes via native MMKV (if available)
  useWarm(
    {
      id: MFE_INSTANCE_ID,
      keys: watchKeys,
      options: {
        fireImmediately: true,
      },
    },
    () => {
      setState(getMFEState(mfeId));
      setMetadata(getMFEMetadata(mfeId));
    }
  );

  // Also listen to fallback store changes (when native unavailable)
  useEffect(() => {
    const unsubscribe = addFallbackListener((key) => {
      if (watchKeys.includes(key)) {
        setState(getMFEState(mfeId));
        setMetadata(getMFEMetadata(mfeId));
      }
    });
    return unsubscribe;
  }, [mfeId, watchKeys]);

  return {
    state,
    metadata,
    isLoading: state === 'loading',
    isLoaded: state !== '' && state !== 'loading' && state !== 'error',
    isMounted: state === 'mounted',
    isError: state === 'error',
  };
}

/**
 * Hook to watch the state of multiple MFEs
 *
 * @param mfeIds Array of MFE identifiers to watch
 * @returns Map of MFE states and helper functions
 *
 * @example
 * ```tsx
 * function MFEDashboard() {
 *   const { states, getState, getMounted, getLoading } = useMFEStates([
 *     'demoHome',
 *     'demoSettings',
 *     'demoGameMap'
 *   ]);
 *
 *   return (
 *     <View>
 *       {getMounted().map(id => <Text key={id}>{id} is active</Text>)}
 *     </View>
 *   );
 * }
 * ```
 */
export function useMFEStates(mfeIds: string[]): {
  states: Record<string, MFEMetadata | null>;
  getState: (mfeId: string) => MFEState;
  getMetadata: (mfeId: string) => MFEMetadata | null;
  getMounted: () => string[];
  getLoading: () => string[];
  getLoaded: () => string[];
  getErrors: () => string[];
} {
  const [states, setStates] = useState<Record<string, MFEMetadata | null>>(() =>
    MFERegistry.getAll(mfeIds)
  );

  // Build keys to watch
  const watchKeys = mfeIds.flatMap((id) => [
    `${MFE_KEY_PREFIX}${id}`,
    `${MFE_KEY_PREFIX}${id}.meta`,
  ]);

  // Watch for changes via native MMKV (if available)
  useWarm(
    {
      id: MFE_INSTANCE_ID,
      keys: watchKeys,
      options: {
        fireImmediately: true,
      },
    },
    () => {
      setStates(MFERegistry.getAll(mfeIds));
    }
  );

  // Also listen to fallback store changes (when native unavailable)
  useEffect(() => {
    const unsubscribe = addFallbackListener((key) => {
      // Check if this key is one we're watching
      if (watchKeys.includes(key)) {
        setStates(MFERegistry.getAll(mfeIds));
      }
    });
    return unsubscribe;
  }, [mfeIds, watchKeys]);

  const getState = useCallback(
    (mfeId: string): MFEState => {
      return states[mfeId]?.state ?? '';
    },
    [states]
  );

  const getMetadata = useCallback(
    (mfeId: string): MFEMetadata | null => {
      return states[mfeId] ?? null;
    },
    [states]
  );

  const getMounted = useCallback((): string[] => {
    return mfeIds.filter((id) => states[id]?.state === 'mounted');
  }, [mfeIds, states]);

  const getLoading = useCallback((): string[] => {
    return mfeIds.filter((id) => states[id]?.state === 'loading');
  }, [mfeIds, states]);

  const getLoaded = useCallback((): string[] => {
    return mfeIds.filter((id) => {
      const state = states[id]?.state;
      return state && state !== '' && state !== 'loading' && state !== 'error';
    });
  }, [mfeIds, states]);

  const getErrors = useCallback((): string[] => {
    return mfeIds.filter((id) => states[id]?.state === 'error');
  }, [mfeIds, states]);

  return {
    states,
    getState,
    getMetadata,
    getMounted,
    getLoading,
    getLoaded,
    getErrors,
  };
}

/**
 * Hook to control MFE state (for loading components)
 *
 * @param mfeId The MFE identifier
 * @returns Control functions for managing MFE state
 *
 * @example
 * ```tsx
 * function MFELoader({ mfeId, children }) {
 *   const { markLoading, markLoaded, markError } = useMFEControl(mfeId);
 *
 *   useEffect(() => {
 *     markLoading();
 *     loadModule()
 *       .then(() => markLoaded('1.0.0'))
 *       .catch(err => markError(err.message));
 *   }, []);
 *
 *   return children;
 * }
 * ```
 */
export function useMFEControl(mfeId: string): {
  markLoading: () => void;
  markLoaded: (version?: string) => void;
  markMounted: () => void;
  markUnmounted: (keepLoaded?: boolean) => void;
  markError: (message?: string) => void;
  clear: () => void;
} {
  const markLoading = useCallback(() => {
    MFERegistry.loading(mfeId);
  }, [mfeId]);

  const markLoaded = useCallback(
    (version?: string) => {
      MFERegistry.loaded(mfeId, version);
    },
    [mfeId]
  );

  const markMounted = useCallback(() => {
    MFERegistry.mounted(mfeId);
  }, [mfeId]);

  const markUnmounted = useCallback(
    (keepLoaded = true) => {
      MFERegistry.unmounted(mfeId, keepLoaded);
    },
    [mfeId]
  );

  const markError = useCallback(
    (message?: string) => {
      MFERegistry.error(mfeId, message);
    },
    [mfeId]
  );

  const clear = useCallback(() => {
    MFERegistry.clear(mfeId);
  }, [mfeId]);

  return {
    markLoading,
    markLoaded,
    markMounted,
    markUnmounted,
    markError,
    clear,
  };
}
