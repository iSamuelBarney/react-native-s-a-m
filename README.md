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
  <a href="https://github.com/iSamuelBarney/react-native-s-a-m/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/react-native-s-a-m.svg" alt="license" /></a>
</p>

---

A high-performance Nitro Module for React Native that provides reactive listeners for Warm and Cold storage changes. Enables automatic component updates when storage changes — no polling, no boilerplate, just reactive persistence.

## Why S.A.M?

Traditional state managers (Redux, Zustand, Jotai, MobX) were built for web apps where state lives in memory. React Native apps need **persistent state**, **secure storage**, **relational data**, and **native performance**. S.A.M unifies all of this.

### S.A.M Exclusive Features

- **Zero JS bundle** — Native C++ via Nitro
- **Built-in persistence** — No middleware or adapters
- **Secure storage** — Keychain/Keystore with biometrics
- **Reactive SQLite** — Cold storage with change listeners
- **Pattern matching** — Watch `user.*` or `settings.*.enabled`
- **Conditional triggers** — Fire on `greaterThan`, `contains`, etc.
- **Built-in debounce/throttle** — No extra setup
- **Zero hydration delay** — Instant startup

### Storage-Native Approach

```typescript
// Traditional: State + Persistence = Complexity
// Redux: store → redux-persist → storage adapter → rehydration

// S.A.M: Storage IS State
Air.setWarm('user.name', 'John');  // Stored AND reactive — that's it
```

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

### Constants

| Constant | Values | Description |
|----------|--------|-------------|
| `INTERNET_STATE` | `ONLINE`, `OFFLINE`, `ONLINE_WEAK` | Internet connectivity state |
| `APP_STATE` | `ACTIVE`, `BACKGROUND`, `INACTIVE` | App lifecycle state |
| `NETWORK_QUALITY` | `STRONG`, `MEDIUM`, `WEAK`, `OFFLINE`, `UNKNOWN` | Network quality |
| `CONNECTION_TYPE` | `WIFI`, `CELLULAR`, `ETHERNET`, `NONE`, `UNKNOWN` | Connection type |

---

## Network Monitoring

Native C++ network monitoring with reactive state stored in Warm storage.

### Quick Start

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

### INTERNET_STATE Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `INTERNET_STATE.ONLINE` | `"online"` | Good connectivity, safe to make API calls |
| `INTERNET_STATE.OFFLINE` | `"offline"` | No internet, don't make API calls |
| `INTERNET_STATE.ONLINE_WEAK` | `"online-weak"` | Slow connection (latency > 300ms) |

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
npm run build       # Compile TypeScript
npm run codegen     # Generate Nitro bindings
```

---

## Release Automation

PRs merged to `main` automatically bump the patch version and publish to npm via GitHub Actions.

Requires `NPM_TOKEN` secret in repository settings.

---

## License

MIT
