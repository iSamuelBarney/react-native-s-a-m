/**
 * S.A.M - Constants
 *
 * Type-safe constants for state comparisons.
 */

/**
 * Internet state constants for type-safe comparisons.
 *
 * @example
 * ```typescript
 * import { useNetwork, INTERNET_STATE } from 'react-native-s-a-m';
 *
 * function App() {
 *   const { internetState } = useNetwork();
 *
 *   if (internetState === INTERNET_STATE.OFFLINE) {
 *     return <OfflineBanner />;
 *   }
 *
 *   if (internetState === INTERNET_STATE.ONLINE_WEAK) {
 *     return <SlowConnectionWarning />;
 *   }
 *
 *   return <MainApp />;
 * }
 * ```
 */
export const INTERNET_STATE = {
  /** Good internet connectivity, safe to make API calls */
  ONLINE: 'online',
  /** No internet, don't make API calls */
  OFFLINE: 'offline',
  /** Connected but slow (latency > 300ms), warn users */
  ONLINE_WEAK: 'online-weak',
} as const;

/**
 * App state constants for type-safe comparisons.
 *
 * @example
 * ```typescript
 * import { useWarm, APP_STATE, Air } from 'react-native-s-a-m';
 *
 * function App() {
 *   const appState = Air.getWarm('APP_STATE');
 *
 *   if (appState === APP_STATE.BACKGROUND) {
 *     // Pause expensive operations
 *   }
 *
 *   return <MainApp />;
 * }
 * ```
 */
export const APP_STATE = {
  /** App is in the foreground and active */
  ACTIVE: 'active',
  /** App is in the background */
  BACKGROUND: 'background',
  /** App is inactive (transitioning or interrupted) */
  INACTIVE: 'inactive',
} as const;

/**
 * Network quality constants for type-safe comparisons.
 *
 * @example
 * ```typescript
 * import { useNetwork, NETWORK_QUALITY } from 'react-native-s-a-m';
 *
 * function VideoPlayer() {
 *   const { quality } = useNetwork();
 *
 *   if (quality === NETWORK_QUALITY.STRONG) {
 *     return <HDVideo />;
 *   }
 *
 *   return <SDVideo />;
 * }
 * ```
 */
export const NETWORK_QUALITY = {
  /** Strong network connection */
  STRONG: 'strong',
  /** Medium quality connection */
  MEDIUM: 'medium',
  /** Weak connection */
  WEAK: 'weak',
  /** No connection */
  OFFLINE: 'offline',
  /** Quality unknown */
  UNKNOWN: 'unknown',
} as const;

/**
 * Connection type constants for type-safe comparisons.
 *
 * @example
 * ```typescript
 * import { useNetwork, CONNECTION_TYPE } from 'react-native-s-a-m';
 *
 * function App() {
 *   const { type } = useNetwork();
 *
 *   if (type === CONNECTION_TYPE.WIFI) {
 *     // Enable high-bandwidth features
 *   }
 * }
 * ```
 */
export const CONNECTION_TYPE = {
  /** WiFi connection */
  WIFI: 'wifi',
  /** Cellular connection */
  CELLULAR: 'cellular',
  /** Ethernet connection */
  ETHERNET: 'ethernet',
  /** No connection */
  NONE: 'none',
  /** Connection type unknown */
  UNKNOWN: 'unknown',
} as const;

/**
 * Internet quality constants (based on latency measurement).
 */
export const INTERNET_QUALITY = {
  /** Excellent latency (< 100ms) */
  EXCELLENT: 'excellent',
  /** Good latency (100-200ms) */
  GOOD: 'good',
  /** Fair latency (200-300ms) */
  FAIR: 'fair',
  /** Poor latency (> 300ms) */
  POOR: 'poor',
  /** No internet */
  OFFLINE: 'offline',
  /** Quality unknown */
  UNKNOWN: 'unknown',
} as const;

// Type exports for the constant values
export type InternetStateValue = typeof INTERNET_STATE[keyof typeof INTERNET_STATE];
export type AppStateValue = typeof APP_STATE[keyof typeof APP_STATE];
export type NetworkQualityValue = typeof NETWORK_QUALITY[keyof typeof NETWORK_QUALITY];
export type ConnectionTypeValue = typeof CONNECTION_TYPE[keyof typeof CONNECTION_TYPE];
export type InternetQualityValue = typeof INTERNET_QUALITY[keyof typeof INTERNET_QUALITY];
