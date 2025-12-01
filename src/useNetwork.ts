/**
 * S.A.M - useNetwork Hook
 *
 * React hook for subscribing to network state changes.
 * Uses the Warm storage-based network monitoring under the hood.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { Air } from './SideFx';
import type { NetworkState } from './specs/SideFx.nitro';

/**
 * Network quality indicator (combined network + internet quality)
 */
export type NetworkQuality = 'strong' | 'medium' | 'weak' | 'offline' | 'unknown';

/**
 * Internet quality indicator (based on actual latency measurement)
 */
export type InternetQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline' | 'unknown';

/**
 * Internet state - simple indicator similar to APP_STATE
 */
export type InternetState = 'online' | 'offline' | 'online-weak';

/**
 * Return value from useNetwork hook
 */
export interface UseNetworkResult {
  /** Current network state from native */
  state: NetworkState | null;
  /**
   * INTERNET_STATE - Simple state similar to APP_STATE.
   * "offline" | "online" | "online-weak"
   *
   * Use this as the primary indicator for UI display.
   */
  internetState: InternetState;
  /** Network status: "online" | "offline" | "unknown" */
  status: string;
  /** Connection type: "wifi" | "cellular" | "ethernet" | "none" | "unknown" */
  type: string;
  /** Combined quality (network + internet): "strong" | "medium" | "weak" | "offline" | "unknown" */
  quality: NetworkQuality;
  /** Internet quality based on latency: "excellent" | "good" | "fair" | "poor" | "offline" | "unknown" */
  internetQuality: InternetQuality;
  /** Internet latency in milliseconds (-1 if unknown/offline) */
  latencyMs: number;
  /**
   * Boolean for internet reachability.
   * Use internetState for more granular state.
   */
  isInternetReachable: boolean;
  /** Whether the device is connected (hardware level) */
  isConnected: boolean;
  /** Whether the device is online (network status) */
  isOnline: boolean;
  /** Whether the device is offline (network status) */
  isOffline: boolean;
  /** Whether using WiFi */
  isWifi: boolean;
  /** Whether using cellular */
  isCellular: boolean;
  /** Cellular generation if on cellular */
  cellularGeneration: string | null;
  /** Whether network monitoring is active */
  isMonitoring: boolean;
  /** Force refresh network state */
  refresh: () => void;
}

/**
 * Hook configuration
 */
export interface UseNetworkConfig {
  /** Auto-start monitoring on mount (default: true) */
  autoStart?: boolean;
  /** Poll interval in ms for reading Warm values (default: 1000) */
  pollInterval?: number;
}

/**
 * Hook for subscribing to network state changes.
 *
 * This hook automatically starts network monitoring and subscribes to
 * network state changes stored in Warm storage.
 *
 * @param config Optional configuration
 * @returns Network state and helper methods
 *
 * @example
 * ```typescript
 * function NetworkStatus() {
 *   const { isOnline, quality, type, isWifi } = useNetwork();
 *
 *   return (
 *     <View>
 *       <Text>Status: {isOnline ? 'Online' : 'Offline'}</Text>
 *       <Text>Quality: {quality}</Text>
 *       <Text>Type: {type}</Text>
 *       {isWifi && <Text>Connected via WiFi</Text>}
 *     </View>
 *   );
 * }
 * ```
 */
export function useNetwork(config: UseNetworkConfig = {}): UseNetworkResult {
  const { autoStart = true, pollInterval = 1000 } = config;

  // State
  const [state, setState] = useState<NetworkState | null>(null);
  const [status, setStatus] = useState<string>('unknown');
  const [type, setType] = useState<string>('unknown');
  const [quality, setQuality] = useState<NetworkQuality>('unknown');
  const [internetQuality, setInternetQuality] = useState<InternetQuality>('unknown');
  const [latencyMs, setLatencyMs] = useState<number>(-1);
  const [isInternetReachable, setIsInternetReachable] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [cellularGeneration, setCellularGeneration] = useState<string | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  // Track if component is mounted
  const isMounted = useRef(true);

  // Read network state from Warm storage
  const readNetworkState = useCallback(() => {
    if (!isMounted.current) return;

    try {
      // Get native state
      const nativeState = Air.getNetworkState();
      setState(nativeState);

      // Read from Warm storage for string values
      const statusValue = Air.getWarm(Air.NETWORK_KEYS.STATUS, Air.NETWORK_INSTANCE_ID);
      const typeValue = Air.getWarm(Air.NETWORK_KEYS.TYPE, Air.NETWORK_INSTANCE_ID);
      const qualityValue = Air.getWarm(Air.NETWORK_KEYS.QUALITY, Air.NETWORK_INSTANCE_ID);
      const connectedValue = Air.getWarm(Air.NETWORK_KEYS.IS_CONNECTED, Air.NETWORK_INSTANCE_ID);
      const cellGenValue = Air.getWarm(Air.NETWORK_KEYS.CELLULAR_GENERATION, Air.NETWORK_INSTANCE_ID);
      const internetQualityValue = Air.getWarm(Air.NETWORK_KEYS.INTERNET_QUALITY, Air.NETWORK_INSTANCE_ID);
      const latencyValue = Air.getWarm(Air.NETWORK_KEYS.INTERNET_LATENCY_MS, Air.NETWORK_INSTANCE_ID);

      if (statusValue !== null && typeof statusValue === 'string') {
        setStatus(statusValue);
      }
      if (typeValue !== null && typeof typeValue === 'string') {
        setType(typeValue);
      }
      if (qualityValue !== null && typeof qualityValue === 'string') {
        setQuality(qualityValue as NetworkQuality);
      }
      if (connectedValue !== null && typeof connectedValue === 'boolean') {
        setIsConnected(connectedValue);
      }
      if (cellGenValue !== null && typeof cellGenValue === 'string') {
        setCellularGeneration(cellGenValue);
      }
      if (internetQualityValue !== null && typeof internetQualityValue === 'string') {
        setInternetQuality(internetQualityValue as InternetQuality);
      }
      if (latencyValue !== null && typeof latencyValue === 'number') {
        setLatencyMs(latencyValue);
      }

      const reachableValue = Air.getWarm(Air.NETWORK_KEYS.INTERNET_REACHABLE, Air.NETWORK_INSTANCE_ID);
      if (reachableValue !== null && typeof reachableValue === 'boolean') {
        setIsInternetReachable(reachableValue);
      }
    } catch (error) {
      console.warn('[SAM] Failed to read network state:', error);
    }
  }, []);

  // Refresh handler
  const refresh = useCallback(() => {
    Air.refreshNetworkState();
    // Small delay to allow native to update Warm storage
    setTimeout(readNetworkState, 100);
  }, [readNetworkState]);

  // Start/stop monitoring on mount/unmount
  useEffect(() => {
    isMounted.current = true;

    if (autoStart) {
      const result = Air.startNetworkMonitoring();
      if (result.success) {
        setIsMonitoring(true);
        // Initial read
        readNetworkState();
      }
    }

    // Poll for changes (since we're using Warm storage)
    const interval = setInterval(readNetworkState, pollInterval);

    return () => {
      isMounted.current = false;
      clearInterval(interval);

      if (autoStart) {
        Air.stopNetworkMonitoring();
        setIsMonitoring(false);
      }
    };
  }, [autoStart, pollInterval, readNetworkState]);

  // Derived values
  const isOnline = status === 'online';
  const isOffline = status === 'offline';
  const isWifi = type === 'wifi';
  const isCellular = type === 'cellular';

  return {
    state,
    status,
    type,
    quality,
    internetQuality,
    latencyMs,
    isInternetReachable,
    isConnected,
    isOnline,
    isOffline,
    isWifi,
    isCellular,
    cellularGeneration,
    isMonitoring,
    refresh,
  };
}

/**
 * Simple hook that just returns whether the device is online.
 * Lighter weight than useNetwork if you only need connectivity status.
 *
 * @example
 * ```typescript
 * function App() {
 *   const isOnline = useIsOnline();
 *   return isOnline ? <MainApp /> : <OfflineScreen />;
 * }
 * ```
 */
export function useIsOnline(): boolean {
  const { isOnline } = useNetwork();
  return isOnline;
}

/**
 * Simple hook that returns network quality.
 *
 * @example
 * ```typescript
 * function VideoPlayer() {
 *   const quality = useNetworkQuality();
 *   const videoQuality = quality === 'strong' ? 'HD' : 'SD';
 *   return <Video quality={videoQuality} />;
 * }
 * ```
 */
export function useNetworkQuality(): NetworkQuality {
  const { quality } = useNetwork();
  return quality;
}
