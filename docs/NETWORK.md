# Network Monitoring

S.A.M provides native C++ network monitoring with reactive state stored in Warm (MMKV) storage. This allows your app to subscribe to network changes and make decisions based on actual internet connectivity, not just hardware connection state.

## Quick Start

```typescript
import { useNetwork, INTERNET_STATE } from 'react-native-s-a-m';

function App() {
  const { internetState } = useNetwork();

  if (internetState === INTERNET_STATE.OFFLINE) {
    return <OfflineBanner />;
  }

  if (internetState === INTERNET_STATE.ONLINE_WEAK) {
    return <SlowConnectionWarning />;
  }

  return <MainApp />;
}
```

## Constants

S.A.M exports constants for type-safe comparisons:

```typescript
import { INTERNET_STATE, NETWORK_QUALITY, CONNECTION_TYPE } from 'react-native-s-a-m';

// Internet state
INTERNET_STATE.ONLINE       // "online"
INTERNET_STATE.OFFLINE      // "offline"
INTERNET_STATE.ONLINE_WEAK  // "online-weak"

// Network quality
NETWORK_QUALITY.STRONG      // "strong"
NETWORK_QUALITY.MEDIUM      // "medium"
NETWORK_QUALITY.WEAK        // "weak"
NETWORK_QUALITY.OFFLINE     // "offline"
NETWORK_QUALITY.UNKNOWN     // "unknown"

// Connection type
CONNECTION_TYPE.WIFI        // "wifi"
CONNECTION_TYPE.CELLULAR    // "cellular"
CONNECTION_TYPE.ETHERNET    // "ethernet"
CONNECTION_TYPE.NONE        // "none"
CONNECTION_TYPE.UNKNOWN     // "unknown"
```

## Key Concepts

### INTERNET_STATE vs IS_CONNECTED

| Key | Description | Values |
|-----|-------------|--------|
| `INTERNET_STATE` | **Actual internet reachability** based on latency checks | `"online"`, `"offline"`, `"online-weak"` |
| `IS_CONNECTED` | Hardware network connection (WiFi/Cellular attached) | `true`, `false` |

**Important:** A device can be `IS_CONNECTED: true` but `INTERNET_STATE: "offline"` if:
- Connected to WiFi with no internet access (captive portal, no gateway)
- Cellular signal but no data service
- Network throttled to the point of unusability

**Always use `INTERNET_STATE` for determining whether to make API calls.**

## Warm Storage Keys

All network state is stored in the `sam-network` MMKV instance:

```typescript
Air.NETWORK_KEYS = {
  // Primary key - use this for most decisions
  INTERNET_STATE: 'INTERNET_STATE',     // "online" | "offline" | "online-weak"

  // Detailed metrics
  INTERNET_QUALITY: 'INTERNET_QUALITY', // "excellent" | "good" | "fair" | "poor" | "offline"
  INTERNET_LATENCY_MS: 'INTERNET_LATENCY_MS', // -1 | 0-N milliseconds
  INTERNET_REACHABLE: 'INTERNET_REACHABLE',   // boolean

  // Network layer info
  STATUS: 'NETWORK_STATUS',             // "online" | "offline" | "unknown"
  TYPE: 'NETWORK_TYPE',                 // "wifi" | "cellular" | "ethernet" | "none"
  QUALITY: 'NETWORK_QUALITY',           // Combined quality rating
  IS_CONNECTED: 'IS_CONNECTED',         // boolean (hardware level)
  CELLULAR_GENERATION: 'CELLULAR_GENERATION', // "2g" | "3g" | "4g" | "5g"
};
```

## Monitoring Modes

S.A.M supports two modes for determining internet quality:

### 1. Active Ping Mode (Development/Testing)

Active mode periodically pings external endpoints to measure latency.

**When to use:**
- Development and testing
- Demo apps
- Testing with Network Link Conditioner
- When you need real-time latency monitoring regardless of app activity

**Performance characteristics:**
- HTTP HEAD request every 10 seconds
- ~100-500 bytes per request
- Minimal battery impact in short sessions
- Round-robins between configured endpoints

```typescript
// Enable active ping (typically in development only)
if (__DEV__) {
  Air.setActivePingMode(true);
}
```

#### Custom Ping Endpoints

By default, S.A.M pings Google and Apple connectivity check endpoints. You can configure custom endpoints to ping your own servers instead:

```typescript
// Use your own API health endpoints
Air.setPingEndpoints([
  'https://api.myapp.com/health',
  'https://api-backup.myapp.com/health',
]);

// Reset to default endpoints (Google, Apple)
Air.setPingEndpoints([]);
```

**Requirements for custom endpoints:**
- Should respond quickly (< 1s ideally)
- Should be reliable and always available
- Should support HEAD requests
- Should return any 2xx status on success

**Use cases for custom endpoints:**
- Enterprise apps that can't ping external servers
- Apps that need to verify connectivity to specific backends
- Testing against staging/production API servers

### 2. Passive Mode (Production Recommended)

Passive mode relies on your app's own network calls to determine quality.

**When to use:**
- Production apps
- Apps where battery life is critical
- Apps that already make regular API calls

**Performance characteristics:**
- Zero additional network overhead during normal operation
- Uses latency from your existing API calls
- 30-second recovery checks only when offline (to detect reconnection)

```typescript
// Passive mode is the default - no setup needed
// Just report latency from your network calls:

const originalFetch = fetch;
globalThis.fetch = async (input, init) => {
  const startTime = Date.now();
  try {
    const response = await originalFetch(input, init);
    Air.reportNetworkLatency(Date.now() - startTime);
    return response;
  } catch (error) {
    if (isNetworkError(error)) {
      Air.reportNetworkFailure();
    }
    throw error;
  }
};
```

## Production Integration Patterns

### Pattern 1: Fetch Interceptor

```typescript
// utils/networkFetch.ts
import { Air } from 'react-native-s-a-m';

const originalFetch = globalThis.fetch;

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const startTime = Date.now();

  try {
    const response = await originalFetch(input, init);
    const latency = Date.now() - startTime;

    // Report successful network latency
    Air.reportNetworkLatency(latency);

    return response;
  } catch (error) {
    // Check if it's a network error (not HTTP error)
    if (error instanceof TypeError && error.message.includes('Network')) {
      Air.reportNetworkFailure();
    }
    throw error;
  }
};
```

### Pattern 2: Axios Interceptor

```typescript
// utils/axiosSetup.ts
import axios from 'axios';
import { Air } from 'react-native-s-a-m';

// Request interceptor - record start time
axios.interceptors.request.use((config) => {
  config.metadata = { startTime: Date.now() };
  return config;
});

// Response interceptor - report latency
axios.interceptors.response.use(
  (response) => {
    if (response.config.metadata?.startTime) {
      const latency = Date.now() - response.config.metadata.startTime;
      Air.reportNetworkLatency(latency);
    }
    return response;
  },
  (error) => {
    // Check for network errors (not HTTP errors like 4xx/5xx)
    if (!error.response && error.message?.includes('Network')) {
      Air.reportNetworkFailure();
    }
    return Promise.reject(error);
  }
);
```

### Pattern 3: React Query Integration

```typescript
// utils/queryClient.ts
import { QueryClient } from '@tanstack/react-query';
import { Air, INTERNET_STATE } from 'react-native-s-a-m';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Disable automatic retries when offline
      retry: (failureCount, error) => {
        const internetState = Air.getWarm(
          Air.NETWORK_KEYS.INTERNET_STATE,
          Air.NETWORK_INSTANCE_ID
        );

        // Don't retry if offline
        if (internetState === INTERNET_STATE.OFFLINE) return false;

        // Limit retries on weak connection
        if (internetState === INTERNET_STATE.ONLINE_WEAK) return failureCount < 1;

        return failureCount < 3;
      },
    },
  },
});
```

### Pattern 4: Conditional API Calls

```typescript
import { useNetwork, INTERNET_STATE } from 'react-native-s-a-m';

function DataFetcher() {
  const { internetState } = useNetwork();

  const fetchData = async () => {
    // Skip API call if offline
    if (internetState === INTERNET_STATE.OFFLINE) {
      // Return cached data or show offline message
      return getCachedData();
    }

    // Warn user about slow connection
    if (internetState === INTERNET_STATE.ONLINE_WEAK) {
      showToast('Slow connection detected, this may take a while...');
    }

    return await fetch('/api/data');
  };

  // ...
}
```

## Quality Thresholds

Internet quality is determined by measured latency:

| Quality | Latency | Description |
|---------|---------|-------------|
| `excellent` | < 100ms | Very responsive, ideal for real-time features |
| `good` | 100-300ms | Good for most use cases |
| `fair` | 300-1000ms | Noticeable delays, usable for basic operations |
| `poor` | > 1000ms | Significant delays, may timeout |
| `offline` | N/A | No successful connection |

The `INTERNET_STATE` value is derived from quality:
- `"online"` = `excellent` or `good` quality
- `"online-weak"` = `fair` or `poor` quality
- `"offline"` = No connectivity

## Offline Recovery

When the app enters offline state (either detected or reported via `reportNetworkFailure()`), S.A.M automatically starts recovery checks:

- **Check frequency:** Every 30 seconds
- **Endpoints:** Round-robins between reliable endpoints (Google, Apple)
- **Automatic stop:** Recovery checks stop when internet is restored

This ensures your app can detect when connectivity returns without requiring user interaction.

## React Hooks

### useNetwork

Full network state access:

```typescript
const {
  internetState,      // "online" | "offline" | "online-weak"
  internetQuality,    // "excellent" | "good" | "fair" | "poor" | "offline"
  latencyMs,          // Current latency in ms
  isInternetReachable,// Boolean shorthand
  type,               // "wifi" | "cellular" | "ethernet" | "none"
  isWifi,             // Boolean shorthand
  isCellular,         // Boolean shorthand
  cellularGeneration, // "2g" | "3g" | "4g" | "5g" | null
  refresh,            // Force refresh function
} = useNetwork();
```

### useIsOnline

Simple boolean check:

```typescript
const isOnline = useIsOnline();
// Returns true if internetState !== "offline"
```

### useNetworkQuality

Just the quality rating:

```typescript
const quality = useNetworkQuality();
// Returns "strong" | "medium" | "weak" | "offline" | "unknown"
```

## API Reference

### Air.startNetworkMonitoring()

Start monitoring network state. Called automatically by `useNetwork()`.

```typescript
const result = Air.startNetworkMonitoring();
// { success: true } or { success: false, error: "..." }
```

### Air.stopNetworkMonitoring()

Stop monitoring. Cleans up native resources.

```typescript
Air.stopNetworkMonitoring();
```

### Air.setActivePingMode(enabled: boolean)

Toggle active ping mode.

```typescript
Air.setActivePingMode(true);  // Enable active pings (10s interval)
Air.setActivePingMode(false); // Passive mode (30s offline recovery only)
```

### Air.setPingEndpoints(endpoints: string[])

Set custom endpoints for active ping mode.

```typescript
// Use custom endpoints
Air.setPingEndpoints([
  'https://api.myapp.com/health',
  'https://cdn.myapp.com/ping',
]);

// Reset to defaults (Google, Apple)
Air.setPingEndpoints([]);
```

### Air.reportNetworkLatency(latencyMs: number)

Report observed latency from app network calls.

```typescript
Air.reportNetworkLatency(150); // Reports 150ms latency
```

### Air.reportNetworkFailure()

Report a network failure. Sets `INTERNET_STATE` to `"offline"` and starts recovery checks.

```typescript
Air.reportNetworkFailure();
```

### Air.getNetworkState()

Get current network state object:

```typescript
const state = Air.getNetworkState();
// {
//   status: "online",
//   type: "wifi",
//   isConnected: true,
//   isExpensive: false,
//   cellularGeneration: null,
//   timestamp: 1234567890
// }
```

## Performance Considerations

### Battery Impact

| Mode | Battery Impact | Network Overhead |
|------|---------------|------------------|
| Passive (default) | Negligible | Zero during normal operation |
| Active | Low | ~500 bytes every 10 seconds |
| Offline Recovery | Very Low | ~500 bytes every 30 seconds (only when offline) |

### Memory Usage

- MMKV storage: ~1KB for all network keys
- Native monitoring: ~50KB for NWPathMonitor on iOS

### Recommendations

1. **Use passive mode in production** - Let your existing API calls drive quality measurement
2. **Enable active mode only for testing** - Use `__DEV__` flag to limit to development
3. **Implement fetch interceptor** - One-time setup provides automatic monitoring
4. **Use INTERNET_STATE for decisions** - It's the most reliable indicator of actual usability
5. **Handle online-weak gracefully** - Show warnings rather than blocking functionality

## Testing with Network Link Conditioner

On macOS, use Network Link Conditioner to simulate various network conditions:

1. Open System Preferences > Network Link Conditioner
2. Enable active ping mode: `Air.setActivePingMode(true)`
3. Select a profile:
   - "100% Loss" → `INTERNET_STATE: "offline"`
   - "Very Bad Network" → `INTERNET_STATE: "online-weak"`
   - "Edge" → `INTERNET_STATE: "online-weak"`
   - "3G" → `INTERNET_STATE: "online"`
   - "WiFi" → `INTERNET_STATE: "online"`

The demo app includes test buttons to simulate different latencies without Network Link Conditioner.
