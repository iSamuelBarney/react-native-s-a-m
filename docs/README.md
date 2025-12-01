<p align="center">
  <img src="../assets/logo.jpg" alt="S.A.M Logo" width="120" />
</p>

# S.A.M - Surface-to-Air Missile for State Management

> *"State that persists. Storage that reacts."*

S.A.M is a high-performance Nitro Module that provides reactive listeners for storage changes in React Native applications. It enables your components to automatically respond to changes in Warm storage, Cold storage, and Secure Storage (Keychain/Keystore) without polling or manual refresh.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [Storage Types](#storage-types)
- [React Hooks](#react-hooks)
- [Secure Storage](#secure-storage)
- [MFE State Tracking](#mfe-state-tracking)
- [Low-Level API](#low-level-api)
- [Documentation](#documentation)

## Installation

```bash
# npm
npm install react-native-s-a-m

# yarn
yarn add react-native-s-a-m

# pnpm
pnpm add react-native-s-a-m
```

### Requirements

- React Native >= 0.82.0
- React >= 19.0.0
- react-native-nitro-modules >= 0.31.0

### Optional Dependencies

- `react-native-keychain` >= 9.0.0 (for SecureStorage)

### iOS Setup

```bash
cd ios && pod install
```

## Quick Start

### 1. Initialize Storage

Both default Warm and Cold instances are **auto-initialized** - you can start using them immediately without any setup on iOS:

```typescript
import { Air } from 'react-native-s-a-m';
import { Platform } from 'react-native';

// iOS: No setup needed! Default instances auto-initialize on first use.

// Android: Must set the root path before first use
if (Platform.OS === 'android') {
  // Use your app's files directory + '/mmkv'
  Air.setWarmRootPath('/data/data/com.yourapp/files/mmkv');
}

// Start using Warm storage immediately (no initializeWarm call needed for default)
Air.setWarm('user.name', 'John');

// Start using Cold storage immediately (auto-initializes 'sam_default' database)
Air.executeCold('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)');
Air.executeCold('INSERT INTO users (name) VALUES (?)', ['John']);
const users = Air.queryCold<{id: number, name: string}[]>('SELECT * FROM users');

// Initialize additional instances if needed
Air.initializeWarm('app-settings');
Air.initializeCold('orders-db', '/path/to/orders.db');
```

> **Note:** S.A.M includes MMKVCore natively for Warm storage and does NOT require `react-native-mmkv`. If you use both libraries, they share the same storage files automatically.

### 2. Use React Hooks

```typescript
import { useWarm, useCold, Air } from 'react-native-s-a-m';

// Watch Warm changes
function UserProfile() {
  const { isListening } = useWarm(
    {
      keys: ['user.name', 'user.email'],
    },
    (event) => {
      console.log(`${event.key} changed to ${event.newValue}`);
    }
  );

  const name = Air.getWarm('user.name');
  return <Text>{name ?? 'Guest'}</Text>;
}

// Watch Cold storage changes
function OrdersList() {
  const { lastChange, refresh } = useCold(
    {
      table: 'orders',
      operations: ['INSERT', 'UPDATE', 'DELETE'],
    },
    (event) => {
      console.log(`Order ${event.rowId} was ${event.operation}`);
    }
  );

  const orders = Air.queryCold('SELECT * FROM orders');
  return <OrderList data={orders} />;
}
```

### 3. Direct Storage Access

```typescript
import { Air } from 'react-native-s-a-m';

// Warm operations
Air.setWarm('user.name', 'John');
Air.setWarm('settings.theme', 'dark', 'app-settings'); // custom instance
const name = Air.getWarm('user.name');
Air.deleteWarm('user.name');

// Cold storage operations
Air.executeCold('INSERT INTO users (name) VALUES (?)', ['John']);
const users = Air.queryCold<User[]>('SELECT * FROM users');
```

## Core Concepts

### Warm vs Cold Storage

S.A.M distinguishes between two types of storage:

| Storage Type | Implementation | Use Case | Hook |
|--------------|----------------|----------|------|
| **Warm** | MMKV-backed | Frequently accessed data, user preferences, session state | `useWarm` |
| **Cold** | SQLite | Large datasets, relational data, offline-first data | `useCold` |

### Listener-Based Architecture

Instead of polling or manual refresh, S.A.M uses native listeners that fire when data changes:

```
Storage Change → Native Detection → JS Callback → React Re-render
```

This provides:
- **Zero polling** - No timers or intervals
- **Immediate updates** - Changes propagate instantly
- **Low overhead** - Native C++ implementation
- **Battery friendly** - No background processing

### Conditional Triggers

Listeners can be configured to only fire when specific conditions are met:

```typescript
useWarm({
  keys: ['cart.total'],
  conditions: [
    { type: 'greaterThan', value: 100 }  // Only fire when total > 100
  ]
});
```

### Pattern Matching

Watch multiple keys with glob patterns:

```typescript
useWarm({
  keys: [],
  patterns: [
    'user.*',           // user.name, user.email, user.avatar
    'settings.*.enabled' // settings.notifications.enabled
  ]
});
```

### Rate Limiting

Control callback frequency with throttle and debounce:

```typescript
useWarm({
  keys: ['search.query'],
  options: {
    debounceMs: 300,  // Wait 300ms of inactivity
    throttleMs: 1000  // At most once per second
  }
});
```

## Storage Types

### Warm Storage

Warm storage is ideal for:
- User preferences and settings
- Authentication tokens
- UI state persistence
- Feature flags
- Small, frequently accessed data

```typescript
// Initialize
Air.initializeWarm('default');
Air.initializeWarm('secure-store'); // Multiple instances

// Read/Write
Air.setWarm('key', 'value');
Air.setWarm('key', 123);
Air.setWarm('key', true);
const value = Air.getWarm('key');
Air.deleteWarm('key');
```

### Cold Storage

Cold storage is ideal for:
- Large datasets
- Relational data
- Offline-first applications
- Complex queries
- Data that needs persistence across app restarts

```typescript
// Initialize
Air.initializeCold('mydb', '/path/to/db.sqlite');

// Execute statements
Air.executeCold('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
Air.executeCold('INSERT INTO users (name) VALUES (?)', ['John']);

// Query data
const users = Air.queryCold<User[]>('SELECT * FROM users WHERE active = ?', [true]);
```

## React Hooks

S.A.M provides three React hooks for declarative storage watching:

### useWarm

Watch Warm storage changes:

```typescript
const { isListening, pause, resume, refresh } = useWarm(
  {
    id: 'default',           // MMKV instance ID
    keys: ['user.name'],     // Keys to watch
    patterns: ['settings.*'], // Glob patterns
    conditions: [],          // Conditional triggers
    options: {
      debounceMs: 0,
      throttleMs: 0,
      fireImmediately: true,
      debug: false
    }
  },
  (event) => {
    // Called when watched keys change
    console.log(event.key, event.newValue);
  }
);
```

### useCold

Watch Cold storage changes:

```typescript
const { isListening, lastChange, pause, resume, refresh } = useCold(
  {
    database: 'mydb',
    table: 'orders',
    columns: ['status'],              // Watch specific columns
    operations: ['INSERT', 'UPDATE'], // Watch specific operations
    options: {
      fireImmediately: true
    }
  },
  (event) => {
    console.log(`Row ${event.rowId} was ${event.operation}`);
  }
);
```

### useStorage

Watch both Warm and Cold storage with correlation:

```typescript
const { lastSource, isListening } = useStorage(
  {
    warm: { keys: ['auth.userId'] },
    cold: {
      query: 'SELECT * FROM orders WHERE user_id = ?',
      queryParams: []
    },
    correlation: {
      warmKey: 'auth.userId',
      coldParam: 'user_id'
    },
    logic: 'OR'  // Fire on either change
  },
  (event) => {
    console.log(`Change from ${event.source}`);
  }
);
```

## Secure Storage

S.A.M includes secure storage capabilities via iOS Keychain and Android Keystore integration.

### Requirements

Secure storage requires the optional `react-native-keychain` peer dependency:

```bash
pnpm add react-native-keychain
```

### Direct API

```typescript
import { SecureStorage } from 'react-native-s-a-m';

// Check availability
const isAvailable = SecureStorage.isAvailable();
const biometryType = await SecureStorage.getSupportedBiometryType();

// Store credentials
await SecureStorage.set('username', 'secret-password', {
  service: 'my-app-auth',
  accessible: 'AfterFirstUnlock',
  requireBiometrics: true,
});

// Retrieve credentials
const credentials = await SecureStorage.get({ service: 'my-app-auth' });
if (credentials) {
  console.log(credentials.username, credentials.password);
}

// Check if credentials exist
const hasCredentials = await SecureStorage.has({ service: 'my-app-auth' });

// Delete credentials
await SecureStorage.delete({ service: 'my-app-auth' });

// Internet credentials (server-specific)
await SecureStorage.setInternetCredentials('api.example.com', 'user', 'pass');
const apiCreds = await SecureStorage.getInternetCredentials('api.example.com');
```

### React Hooks

```typescript
import { useSecure, useSecureCredentials } from 'react-native-s-a-m';

// useSecure - Full control with loading states
function LoginScreen() {
  const {
    key,           // Current username
    value,         // Current password
    isLoading,
    error,
    isAvailable,
    biometryType,
    set,           // Save credentials
    get,           // Load credentials
    delete: remove,
  } = useSecure({
    service: 'auth-service',
    autoLoad: true,  // Load on mount
  });

  const handleLogin = async (username: string, password: string) => {
    const success = await set(username, password);
    if (success) {
      navigation.navigate('Home');
    }
  };
}

// useSecureCredentials - Simple credential watching
function AuthProvider({ children }) {
  const { credentials, isLoading, refresh } = useSecureCredentials({
    service: 'auth-service',
  });

  if (isLoading) return <Spinner />;

  return (
    <AuthContext.Provider value={{ credentials, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### Security Options

| Option | Description |
|--------|-------------|
| `service` | Namespace for credentials (default: 'sam-secure') |
| `accessible` | iOS keychain accessibility level |
| `securityLevel` | Android security level (ANY, SECURE_SOFTWARE, SECURE_HARDWARE) |
| `requireBiometrics` | Require biometric auth for access |
| `authenticationPrompt` | Custom biometric prompt text |

## MFE State Tracking

Track micro-frontend (MFE) loading states and lifecycle events through Warm storage.

### State Types

| State | Description |
|-------|-------------|
| `''` | Not tracked / initial state |
| `'loading'` | MFE is being loaded |
| `'loaded'` | MFE code has loaded |
| `'mounted'` | MFE component is mounted |
| `'error'` | MFE failed to load |

### Direct API

```typescript
import {
  initializeMFERegistry,
  markMFELoading,
  markMFELoaded,
  markMFEMounted,
  markMFEUnmounted,
  markMFEError,
  getMFEState,
  getMFEMetadata,
  clearMFEState,
  getTrackedMFEs,
} from 'react-native-s-a-m';

// Initialize registry (call once at app start)
initializeMFERegistry();

// Track MFE lifecycle
markMFELoading('checkout-mfe');
markMFELoaded('checkout-mfe', '1.2.0');  // with version
markMFEMounted('checkout-mfe');
markMFEUnmounted('checkout-mfe', true);  // keepLoaded = true
markMFEError('checkout-mfe', 'Network timeout');

// Query state
const state = getMFEState('checkout-mfe');  // 'loading' | 'loaded' | etc.
const metadata = getMFEMetadata('checkout-mfe');
// { state, version, loadedAt, mountedAt, unmountedAt, errorMessage, loadTimeMs }

// Get all tracked MFEs
const allMFEs = getTrackedMFEs(['checkout-mfe', 'profile-mfe', 'cart-mfe']);
```

### React Hooks

```typescript
import { useMFEState, useMFEStates, useMFEControl } from 'react-native-s-a-m';

// Watch single MFE
function MFELoader({ mfeId }: { mfeId: string }) {
  const { state, metadata, isLoading, isLoaded, isMounted, isError } = useMFEState(mfeId);

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorView message={metadata?.errorMessage} />;
  if (isMounted) return <Text>MFE Active</Text>;
  return <Text>State: {state}</Text>;
}

// Watch multiple MFEs
function MFEDashboard() {
  const {
    states,
    getState,
    getMetadata,
    getMounted,
    getLoading,
    getErrors,
  } = useMFEStates(['checkout', 'profile', 'cart']);

  const loadingMFEs = getLoading();  // ['checkout']
  const errorMFEs = getErrors();      // ['cart']
  const mountedMFEs = getMounted();   // ['profile']

  return (
    <View>
      <Text>Loading: {loadingMFEs.join(', ')}</Text>
      <Text>Errors: {errorMFEs.join(', ')}</Text>
    </View>
  );
}

// Control MFE state from components
function MFEContainer({ mfeId }: { mfeId: string }) {
  const { markLoading, markLoaded, markMounted, markUnmounted, markError } = useMFEControl(mfeId);

  useEffect(() => {
    markMounted();
    return () => markUnmounted();
  }, []);

  return <MFEComponent />;
}
```

### MFE Registry Object

For convenience, all functions are also available on the `MFERegistry` object:

```typescript
import { MFERegistry } from 'react-native-s-a-m';

MFERegistry.initialize();
MFERegistry.markLoading('my-mfe');
MFERegistry.getState('my-mfe');
// etc.
```

## Low-Level API

For advanced use cases, use the Air API directly:

```typescript
import { Air } from 'react-native-s-a-m';

// Add a listener
Air.addListener(
  'my-listener',
  {
    warm: { keys: ['user.name'] },
    options: { fireImmediately: true }
  },
  (event) => console.log('Changed:', event)
);

// Manage listeners
Air.pauseListener('my-listener');
Air.resumeListener('my-listener');
Air.removeListener('my-listener');
Air.removeAllListeners();

// Query listeners
const listeners = Air.getListeners();
const hasListener = Air.hasListener('my-listener');

// Configuration
Air.configure({ debug: true, maxListeners: 100 });
Air.setDebugMode(true);
```

## Documentation

- [API Reference](./API.md) - Complete API documentation
- [React Hooks](./HOOKS.md) - Detailed hooks documentation
- [Conditions](./CONDITIONS.md) - Conditional trigger reference
- [Secure Storage](./SECURE_STORAGE.md) - iOS Keychain / Android Keystore guide
- [MFE State Tracking](./MFE.md) - Micro-frontend state tracking
- [Architecture](./ARCHITECTURE.md) - Technical architecture overview

## License

MIT
