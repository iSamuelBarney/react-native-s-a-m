<p align="center">
  <img src="./assets/logo.jpg" alt="S.A.M Logo" />
</p>

<h1 align="center">react-native-s-a-m</h1>

<p align="center">
  <strong>S.A.M</strong> — Surface-to-Air Missile for State Management
</p>

<p align="center">
  Launch with Confidence. Adapt to your state. Never miss a change.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/react-native-s-a-m"><img src="https://img.shields.io/npm/v/react-native-s-a-m.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/react-native-s-a-m"><img src="https://img.shields.io/npm/dm/react-native-s-a-m.svg" alt="npm downloads" /></a>
  <a href="https://github.com/module-federation/metro/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/react-native-s-a-m.svg" alt="license" /></a>
</p>

---

A high-performance Nitro Module for React Native that provides reactive listeners for Warm and Cold storage changes. Enables automatic component updates when storage changes — no polling, no boilerplate, just reactive persistence.

## Capabilities Checklist

| Capability | Redux | Zustand | Jotai | MobX | Recoil | S.A.M |
|:-----------|:-----:|:-------:|:-----:|:----:|:------:|:-----:|
| React hooks API | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Persistent storage built-in | | | | | | ✅ |
| TypeScript support | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Secure storage (Keychain/Keystore) | | | | | | ✅ |
| Atomic updates | | | ✅ | | ✅ | ✅ |
| Biometric authentication | | | | | | ✅ |
| No provider/wrapper required | | ✅ | ✅ | | | ✅ |
| Cold storage reactive queries | | | | | | ✅ |
| Fine-grained reactivity | | | ✅ | ✅ | ✅ | ✅ |
| Key pattern matching (`user.*`) | | | | | | ✅ |
| Minimal boilerplate | | ✅ | ✅ | | | ✅ |
| Conditional triggers | | | | | | ✅ |
| Computed/derived state | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Native C++ performance | | | | | | ✅ |
| Async actions built-in | | ✅ | ✅ | ✅ | ✅ | ✅ |
| Zero hydration delay | | | | | | ✅ |
| Immer integration | ✅ | ✅ | ✅ | | | ✅ |
| Cross-instance sync | | | | | | ✅ |
| Built-in debounce/throttle | | | | | | ✅ |
| Observable patterns | | | | ✅ | | ✅ |
| Warm + Cold storage unified | | | | | | ✅ |
| Selector support | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Zero JS bundle overhead | | | | | | ✅ |
| React Native native-first | | | | ✅ | | ✅ |

> **All the features you expect from modern state managers, plus 14 exclusive capabilities for React Native.**

## Why S.A.M?

### The Problem with Traditional State Management

Redux, Zustand, Jotai, and MobX were designed for **web apps** where state lives in memory. But React Native apps need:

- **Persistent state** that survives app restarts
- **Secure storage** for tokens and credentials
- **Relational data** that belongs in SQLite
- **Native performance** for 60fps scrolling

S.A.M was built from the ground up for **mobile-first, storage-native** state management.

### Head-to-Head Comparison

| Feature | Redux | Zustand | Jotai | MobX | S.A.M |
|---------|-------|---------|-------|------|-------|
| **Bundle Size** | ~15KB | ~1KB | ~1.2KB | ~7KB | 0KB (native) |
| **Persistence** | redux-persist middleware | persist middleware | atomWithStorage | manual | **Built-in** |
| **Setup Complexity** | High (actions, reducers, store) | Low | Low | Medium | **Zero config** |
| **Secure Storage** | Separate library | Separate library | Separate library | Separate library | **Built-in Keychain/Keystore** |
| **Biometric Auth** | DIY | DIY | DIY | DIY | **Built-in Face ID/Touch ID** |
| **Cold Storage Support** | No | No | No | No | **Yes, reactive queries** |
| **Pattern Matching** | No | No | No | No | **Yes (`user.*`, `settings.*.enabled`)** |
| **Conditional Triggers** | No | No | No | No | **Yes (greaterThan, contains, etc.)** |
| **Native Performance** | JS bridge | JS bridge | JS bridge | JS bridge | **C++ via Nitro** |
| **Cross-Instance Sync** | Manual | Manual | Manual | Manual | **Automatic** |
| **Debounce/Throttle** | Middleware | DIY | DIY | DIY | **Built-in** |
| **React Native Focus** | Afterthought | Afterthought | Limited DevTools | Good | **Native-first** |

### Why Storage-Native Wins

```typescript
// ❌ Traditional: State + Persistence = Complexity
// Redux: Create store → Add redux-persist → Configure storage → Handle rehydration
// Zustand: Create store → Add persist middleware → Configure storage adapter
// Result: State and storage are separate concerns you must sync

// ✅ S.A.M: Storage IS State
Air.setWarm('user.name', 'John');  // Stored AND reactive
// That's it. Components automatically update. Persists across restarts.
```

### Real-World Scenarios

| Scenario | Traditional Approach | S.A.M Approach |
|----------|---------------------|----------------|
| **Auth Token Storage** | AsyncStorage + state sync + separate secure storage lib | `SecureStorage.set()` with biometrics |
| **Shopping Cart** | Redux slice + persist middleware + rehydration logic | `Air.setWarm('cart', data)` — done |
| **Offline-First Data** | Complex saga/thunk + SQLite lib + manual sync | `useCold({ table: 'orders' })` — reactive |
| **User Preferences** | Context + AsyncStorage + manual persistence | `useWarm({ keys: ['settings.*'] })` |
| **Search with Debounce** | useState + useEffect + setTimeout cleanup | `options: { debounceMs: 300 }` |
| **Feature Flags** | Separate system + polling | `conditions: [{ type: 'equals', value: true }]` |

### Performance Advantage

| Metric | JS State Managers | S.A.M |
|--------|------------------|-------|
| **Storage Read** | Async (JS → Bridge → Native → Bridge → JS) | Sync C++ direct access |
| **Change Detection** | JS diffing algorithms | Native change notifications |
| **Memory** | JS heap + serialized storage copy | Single native storage |
| **Startup** | Rehydration delay | Instant (no hydration needed) |
| **Large Lists** | Re-render entire tree risk | Fine-grained native updates |

## Features

- **Reactive Storage** — Automatic notifications on Warm and SQLite changes
- **Pattern Matching** — Watch keys with glob patterns (`user.*`, `settings.*.enabled`)
- **Conditional Triggers** — Fire only when conditions are met (equals, greaterThan, contains, etc.)
- **Rate Limiting** — Built-in debounce and throttle support
- **React Hooks** — `useWarm`, `useCold`, `useStorage`, `useSecure` for declarative usage
- **Secure Storage** — iOS Keychain / Android Keystore integration with biometric auth
- **Native Performance** — C++ implementation via [Nitro Modules](https://github.com/mrousavy/nitro)

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Warm Storage](#warm-storage)
- [Cold Storage](#cold-storage)
- [Secure Storage](#secure-storage)
- [React Hooks](#react-hooks)
- [API Overview](#api-overview)
- [Documentation](#documentation)

---

## Installation

```bash
npm install react-native-s-a-m react-native-nitro-modules
# or
pnpm add react-native-s-a-m react-native-nitro-modules
# or
yarn add react-native-s-a-m react-native-nitro-modules
```

### Requirements

- React Native >= 0.82.0
- React >= 19.0.0
- react-native-nitro-modules >= 0.31.0

### Optional Dependencies

```bash
# For Secure Storage (iOS Keychain / Android Keystore)
npm install react-native-keychain

# For shared storage with react-native-mmkv v4
npm install react-native-mmkv
```

### iOS Setup

```bash
cd ios && pod install
```

For Face ID support, add to `Info.plist`:
```xml
<key>NSFaceIDUsageDescription</key>
<string>Authenticate to access secure data</string>
```

### Android Setup

No additional setup required — auto-links with React Native.

---

## Quick Start

### Initialize Storage

Both default Warm and Cold storage instances are **auto-initialized** on first use — no setup required on iOS!

```typescript
import { Air } from 'react-native-s-a-m';
import { Platform } from 'react-native';

// Android requires setting the Warm path first
if (Platform.OS === 'android') {
  Air.setWarmRootPath('/data/data/com.yourapp/files/mmkv');
}

// Start using Warm immediately — no initialization needed!
Air.setWarm('user.name', 'John');

// Start using Cold storage immediately — also auto-initializes!
Air.executeCold('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)');
Air.executeCold('INSERT INTO users (name) VALUES (?)', ['John']);
const users = Air.queryCold<{id: number, name: string}[]>('SELECT * FROM users');

// Initialize additional instances if needed
Air.initializeWarm('app-settings');
Air.initializeCold('orders-db', '/path/to/orders.db');
```

> **Note:** S.A.M uses MMKVCore directly for Warm storage and does NOT require `react-native-mmkv`. However, if you also use `react-native-mmkv` v4, both libraries share the same storage files for seamless integration.

---

## Warm Storage

Fast key-value storage for frequently accessed data.

### Basic Operations

```typescript
import { Air } from 'react-native-s-a-m';

// Set values (string, number, or boolean)
Air.setWarm('user.name', 'John Doe');
Air.setWarm('user.age', 28);
Air.setWarm('user.premium', true);
Air.setWarm('settings.theme', 'dark');

// Get values
const name = Air.getWarm('user.name');      // 'John Doe'
const age = Air.getWarm('user.age');        // 28
const isPremium = Air.getWarm('user.premium'); // true

// Delete values
Air.deleteWarm('user.name');

// Use named instances
Air.initializeWarm('secure');
Air.setWarm('api.token', 'abc123', 'secure');
```

### Reactive Listeners

```typescript
import { Air } from 'react-native-s-a-m';

// Watch specific keys
Air.addListener(
  'user-watcher',
  {
    warm: {
      keys: ['user.name', 'user.email', 'user.avatar'],
    },
  },
  (event) => {
    console.log(`${event.key} changed from ${event.oldValue} to ${event.newValue}`);
  }
);

// Watch with glob patterns
Air.addListener(
  'settings-watcher',
  {
    warm: {
      patterns: ['settings.*', 'preferences.*.enabled'],
    },
  },
  (event) => {
    console.log(`Setting changed: ${event.key}`);
  }
);

// Watch with conditions
Air.addListener(
  'cart-total-watcher',
  {
    warm: {
      keys: ['cart.total'],
      conditions: [
        { type: 'greaterThan', value: 100 }
      ],
    },
  },
  (event) => {
    // Only fires when cart total exceeds $100
    showFreeShippingBanner();
  }
);

// With debounce for rapid changes
Air.addListener(
  'search-watcher',
  {
    warm: {
      keys: ['search.query'],
    },
    options: {
      debounceMs: 300,  // Wait 300ms after last change
    },
  },
  (event) => {
    performSearch(event.newValue as string);
  }
);

// Remove listener when done
Air.removeListener('user-watcher');
```

---

## Cold Storage

Persistent relational data with SQL queries.

### Basic Operations

```typescript
import { Air } from 'react-native-s-a-m';

// Create tables
Air.executeCold(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

Air.executeCold(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    total REAL,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Insert data
Air.executeCold(
  'INSERT INTO users (name, email) VALUES (?, ?)',
  ['John Doe', 'john@example.com']
);

// Query data with TypeScript
interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

const users = Air.queryCold<User[]>('SELECT * FROM users');

const user = Air.queryCold<User[]>(
  'SELECT * FROM users WHERE id = ?',
  [1]
)?.[0];

// Update data
Air.executeCold(
  'UPDATE users SET name = ? WHERE id = ?',
  ['Jane Doe', 1]
);

// Delete data
Air.executeCold('DELETE FROM users WHERE id = ?', [1]);
```

### Reactive Listeners

```typescript
import { Air } from 'react-native-s-a-m';

// Watch all changes to a table
Air.addListener(
  'users-watcher',
  {
    cold: {
      table: 'users',
      operations: ['INSERT', 'UPDATE', 'DELETE'],
    },
  },
  (event) => {
    console.log(`${event.operation} on row ${event.rowId}`);
    refreshUserList();
  }
);

// Watch specific columns
Air.addListener(
  'order-status-watcher',
  {
    cold: {
      table: 'orders',
      columns: ['status'],
      operations: ['UPDATE'],
    },
  },
  (event) => {
    notifyOrderStatusChange(event.rowId);
  }
);

// Watch with row conditions
Air.addListener(
  'high-value-orders',
  {
    cold: {
      table: 'orders',
      operations: ['INSERT'],
      where: [
        {
          column: 'total',
          condition: { type: 'greaterThan', value: 1000 }
        }
      ],
    },
  },
  (event) => {
    alertSalesTeam(event.rowId);
  }
);
```

---

## Secure Storage

iOS Keychain and Android Keystore integration for sensitive data.

**Requires:** `npm install react-native-keychain`

### Basic Usage

```typescript
import { SecureStorage } from 'react-native-s-a-m';

// Store credentials
await SecureStorage.set('admin', 'super-secret-password', {
  service: 'my-app-auth',
});

// Retrieve credentials
const credentials = await SecureStorage.get({ service: 'my-app-auth' });
if (credentials) {
  console.log(`User: ${credentials.username}`);
  console.log(`Pass: ${credentials.password}`);
}

// Check if credentials exist
const hasCredentials = await SecureStorage.has({ service: 'my-app-auth' });

// Delete credentials
await SecureStorage.delete({ service: 'my-app-auth' });
```

### With Biometric Authentication

```typescript
import { SecureStorage } from 'react-native-s-a-m';

// Check biometry support
const biometryType = await SecureStorage.getSupportedBiometryType();
// Returns: 'FaceID' | 'TouchID' | 'Fingerprint' | 'Face' | 'Iris' | null

// Store with biometric protection
await SecureStorage.set('user@example.com', 'password123', {
  service: 'biometric-auth',
  requireBiometrics: true,
  accessible: 'WhenPasscodeSetThisDeviceOnly',
  authenticationPrompt: {
    title: 'Save Credentials',
    subtitle: 'Protect your login with biometrics',
  },
});

// Retrieve with biometric prompt
const credentials = await SecureStorage.get({
  service: 'biometric-auth',
  authenticationPrompt: {
    title: 'Login',
    subtitle: 'Verify your identity to continue',
  },
});
```

### React Hook

```typescript
import { useSecure } from 'react-native-s-a-m';

function LoginScreen() {
  const {
    key,              // stored username
    value,            // stored password
    isLoading,
    error,
    biometryType,
    set,
    get,
    delete: remove,
  } = useSecure({
    service: 'auth-credentials',
    autoLoad: true,
    requireBiometrics: true,
  });

  const handleLogin = async (username: string, password: string) => {
    const success = await set(username, password);
    if (success) {
      navigation.navigate('Home');
    }
  };

  const handleBiometricLogin = async () => {
    await get();  // Triggers biometric prompt
    if (key && value) {
      await loginWithCredentials(key, value);
    }
  };

  if (isLoading) return <ActivityIndicator />;

  return (
    <View>
      {biometryType && (
        <Button
          title={`Login with ${biometryType}`}
          onPress={handleBiometricLogin}
        />
      )}
      <LoginForm onSubmit={handleLogin} />
    </View>
  );
}
```

---

## React Hooks

### useWarm — Watch Warm Changes

```typescript
import { useWarm, Air } from 'react-native-s-a-m';

function UserProfile() {
  // Re-renders when any watched key changes
  const { isListening, pause, resume } = useWarm(
    {
      keys: ['user.name', 'user.email', 'user.avatar'],
      options: {
        fireImmediately: true,
        debounceMs: 100,
      },
    },
    (event) => {
      console.log(`${event.key} changed to ${event.newValue}`);
    }
  );

  const name = Air.getWarm('user.name');
  const email = Air.getWarm('user.email');

  return (
    <View>
      <Text>{name ?? 'Guest'}</Text>
      <Text>{email ?? 'No email'}</Text>
      <Button
        title={isListening ? 'Pause' : 'Resume'}
        onPress={isListening ? pause : resume}
      />
    </View>
  );
}
```

### useCold — Watch Cold Storage Changes

```typescript
import { useCold, Air } from 'react-native-s-a-m';

function OrdersList() {
  const { lastChange, refresh } = useCold(
    {
      table: 'orders',
      operations: ['INSERT', 'UPDATE', 'DELETE'],
    },
    (event) => {
      // Refresh list when orders change
      console.log(`Order ${event.rowId} ${event.operation}`);
    }
  );

  const orders = Air.queryCold<Order[]>(
    'SELECT * FROM orders ORDER BY created_at DESC'
  );

  return (
    <FlatList
      data={orders}
      renderItem={({ item }) => <OrderRow order={item} />}
      refreshing={false}
      onRefresh={refresh}
    />
  );
}
```

### useStorage — Watch Both Warm and Cold

```typescript
import { useStorage, Air } from 'react-native-s-a-m';

function UserOrders() {
  const { lastSource } = useStorage(
    {
      warm: {
        keys: ['auth.userId'],
      },
      cold: {
        table: 'orders',
        operations: ['INSERT', 'UPDATE'],
      },
      logic: 'OR',  // Fire on either change
      correlation: {
        warmKey: 'auth.userId',
        coldParam: 'user_id',
      },
    },
    (event) => {
      console.log(`Change from ${event.source}`);
    }
  );

  const userId = Air.getWarm('auth.userId');
  const orders = Air.queryCold<Order[]>(
    'SELECT * FROM orders WHERE user_id = ?',
    [userId]
  );

  return <OrderList orders={orders} />;
}
```

---

## API Overview

### Core Storage

| Method | Description |
|--------|-------------|
| `Air.initializeWarm(id?)` | Initialize Warm instance (default auto-initializes) |
| `Air.initializeCold(name, path)` | Initialize Cold storage database (default auto-initializes) |
| `Air.setWarm(key, value, id?)` | Set Warm value (auto-inits default) |
| `Air.getWarm(key, id?)` | Get Warm value (auto-inits default) |
| `Air.deleteWarm(key, id?)` | Delete Warm key (auto-inits default) |
| `Air.executeCold(sql, params?, db?)` | Execute SQL statement (auto-inits default) |
| `Air.queryCold<T>(sql, params?, db?)` | Query Cold storage with types (auto-inits default) |

### Listeners

| Method | Description |
|--------|-------------|
| `Air.addListener(id, config, callback)` | Add storage listener |
| `Air.removeListener(id)` | Remove listener |
| `Air.pauseListener(id)` | Pause listener |
| `Air.resumeListener(id)` | Resume listener |
| `Air.getListeners()` | Get all listener info |

### React Hooks

| Hook | Description |
|------|-------------|
| `useWarm` | Watch Warm changes |
| `useCold` | Watch Cold storage changes |
| `useStorage` | Watch both with correlation |
| `useNetwork` | Network state and quality |
| `useIsOnline` | Simple online/offline boolean |
| `useSecure` | Manage secure storage |
| `useSecureCredentials` | Watch credential changes |

### Secure Storage

| Method | Description |
|--------|-------------|
| `SecureStorage.set(key, value, options?)` | Store credentials |
| `SecureStorage.get(options?)` | Retrieve credentials |
| `SecureStorage.has(options?)` | Check if exists |
| `SecureStorage.delete(options?)` | Delete credentials |
| `SecureStorage.getSupportedBiometryType()` | Get biometry type |

---

## Network Monitoring

Native C++ network monitoring with reactive state stored in Warm storage.

### Quick Start

```typescript
import { useNetwork } from 'react-native-s-a-m';

function App() {
  const { internetState } = useNetwork();

  if (internetState === 'offline') {
    return <OfflineBanner />;
  }

  if (internetState === 'online-weak') {
    return <SlowConnectionWarning />;
  }

  return <MainApp />;
}
```

### INTERNET_STATE — Single Source of Truth

| Value | Description |
|-------|-------------|
| `"online"` | Good internet connectivity, safe to make API calls |
| `"offline"` | No internet, don't make API calls |
| `"online-weak"` | Connected but slow (latency > 300ms), warn users |

### Production Integration

```typescript
// Report latency from your network calls
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

For complete documentation including production patterns, custom endpoints, and performance considerations, see **[Network Monitoring Guide](./docs/NETWORK.md)**.

---

## Documentation

| Document | Description |
|----------|-------------|
| [API Reference](./docs/API.md) | Complete API documentation |
| [React Hooks](./docs/HOOKS.md) | Detailed hooks documentation |
| [Conditions](./docs/CONDITIONS.md) | Conditional trigger reference |
| [Secure Storage](./docs/SECURE_STORAGE.md) | Keychain/Keystore guide |
| [Network Monitoring](./docs/NETWORK.md) | Network state and quality guide |
| [MFE State Tracking](./docs/MFE.md) | Micro-frontend state tracking |
| [Architecture](./docs/ARCHITECTURE.md) | Technical architecture overview |

---

## Building

```bash
pnpm build
```

This will:
1. Run `nitro-codegen` to generate platform-specific bindings
2. Compile TypeScript to JavaScript

---

## Release automation

- Conventional commits (`feat:`, `fix:`, `chore:` etc.) merged to `main` are picked up by release-please, which opens and auto-updates a release PR with the next version, changelog, and tags.
- Publishing runs automatically on every published GitHub release via `.github/workflows/publish.yml`, building the package and running `npm publish`.
- Secrets: add `NPM_TOKEN` (npm automation token with publish rights) to **Settings → Secrets and variables → Actions** so the publish job can authenticate.
- If no `package-lock.json` is present, the workflow falls back to `npm install` before building.

---

## License

MIT
